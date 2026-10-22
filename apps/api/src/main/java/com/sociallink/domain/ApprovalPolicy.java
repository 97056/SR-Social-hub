package com.sociallink.domain;

import java.time.Instant;
import java.util.Objects;

public final class ApprovalPolicy {
    public enum LateApprovalDecision {
        ALLOW,
        BLOCK_RESCHEDULE
    }

    public record ContentSnapshot(String caption, String hashtags, String mediaKey, String targetKey) {
        public boolean materiallyDiffersFrom(ContentSnapshot other) {
            return !Objects.equals(caption, other.caption)
                    || !Objects.equals(hashtags, other.hashtags)
                    || !Objects.equals(mediaKey, other.mediaKey)
                    || !Objects.equals(targetKey, other.targetKey);
        }
    }

    public boolean mayPublish(boolean approvalRequired, String approvalStatus, Integer approvedVersion, int contentVersion) {
        if (!approvalRequired) {
            return true;
        }
        return "approved".equals(approvalStatus)
                && approvedVersion != null
                && approvedVersion == contentVersion;
    }

    public boolean materialChangeInvalidates(ContentSnapshot approved, ContentSnapshot next) {
        return approved.materiallyDiffersFrom(next);
    }

    public LateApprovalDecision onApprove(Instant scheduledAt, Instant now, boolean wasPending) {
        if (wasPending && scheduledAt != null && !scheduledAt.isAfter(now)) {
            return LateApprovalDecision.BLOCK_RESCHEDULE;
        }
        return LateApprovalDecision.ALLOW;
    }
}
