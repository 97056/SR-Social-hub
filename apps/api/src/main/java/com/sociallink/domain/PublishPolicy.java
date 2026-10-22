package com.sociallink.domain;

import java.time.Instant;
import java.util.UUID;

public final class PublishPolicy {
    public enum Outcome {
        SUCCESS,
        PERMANENT,
        TRANSIENT,
        UNCERTAIN
    }

    public record Result(Outcome outcome, String externalId, String errorCode, String safeMessage, boolean sandbox) {
    }

    public record JobView(
            UUID jobId,
            UUID targetId,
            int attempt,
            String externalPostId,
            boolean approvalRequired,
            String approvalStatus,
            Integer approvedVersion,
            int contentVersion,
            String platform,
            boolean subscriptionActive
    ) {
    }

    public sealed interface Decision permits Decision.Publish, Decision.Update {
        record Publish() implements Decision {
        }

        record Update(
                String jobStatus,
                String targetStatus,
                Instant nextRun,
                String externalId,
                boolean sandbox,
                String errorCode,
                String safeMessage,
                boolean countUsage
        ) implements Decision {
        }
    }

    public Decision beforeCall(JobView job) {
        if (!job.subscriptionActive()) {
            return new Decision.Update(
                    "cancelled",
                    "failed",
                    null,
                    null,
                    false,
                    "subscription_inactive",
                    "Publishing is paused because the subscription is not active. Content was not deleted.",
                    false
            );
        }
        if (job.externalPostId() != null && !job.externalPostId().isBlank()) {
            return blockReconcile("external_id_present", "This target already has an external post id. Reconcile it before retrying.");
        }
        if (job.approvalRequired()
                && !new ApprovalPolicy().mayPublish(true, job.approvalStatus(), job.approvedVersion(), job.contentVersion())) {
            String status = "pending".equals(job.approvalStatus()) ? "awaiting_approval" : "draft";
            String code = "pending".equals(job.approvalStatus()) ? "approval_pending" : "approval_required";
            String message = "pending".equals(job.approvalStatus())
                    ? "Approval is still pending. The post was not published."
                    : "This post is not approved for publishing.";
            return new Decision.Update("cancelled", status, null, null, false, code, message, false);
        }
        return new Decision.Publish();
    }

    public Decision afterResult(Result result, int attempt, Instant now, long jitterMillis) {
        return switch (result.outcome()) {
            case SUCCESS -> new Decision.Update(
                    "done",
                    result.sandbox() ? "sandbox_published" : "published",
                    null,
                    result.externalId(),
                    result.sandbox(),
                    result.errorCode(),
                    result.safeMessage(),
                    !result.sandbox()
            );
            case PERMANENT -> new Decision.Update(
                    "failed", "failed", null, null, false, result.errorCode(), result.safeMessage(), false
            );
            case UNCERTAIN -> blockReconcile(
                    result.errorCode() == null ? "uncertain_outcome" : result.errorCode(),
                    result.safeMessage() == null
                            ? "The publish result is uncertain. Reconcile it before any retry."
                            : result.safeMessage()
            );
            case TRANSIENT -> new Decision.Update(
                    "pending",
                    "scheduled",
                    now.plus(JobBackoff.backoff(attempt, jitterMillis)),
                    null,
                    false,
                    result.errorCode(),
                    result.safeMessage(),
                    false
            );
        };
    }

    private static Decision.Update blockReconcile(String code, String message) {
        return new Decision.Update("needs_reconcile", "needs_reconcile", null, null, false, code, message, false);
    }
}
