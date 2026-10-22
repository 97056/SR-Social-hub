package com.sociallink.domain;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

public final class PostRollup {
    private PostRollup() {
    }

    public static String summarize(Collection<String> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return "draft";
        }
        Set<String> set = new HashSet<>(statuses);
        if (set.contains("publishing")) {
            return "publishing";
        }
        boolean anyPublished = set.contains("published") || set.contains("sandbox_published");
        boolean allPublished = statuses.stream().allMatch(status -> "published".equals(status) || "sandbox_published".equals(status));
        if (allPublished && set.contains("sandbox_published") && !set.contains("published")) {
            return "sandbox_published";
        }
        if (allPublished) {
            return "published";
        }
        if (anyPublished && set.stream().anyMatch(PostRollup::isTerminalProblem)) {
            return "partially_failed";
        }
        if (anyPublished && (set.contains("scheduled") || set.contains("approved"))) {
            return "scheduled";
        }
        if (set.contains("needs_reconcile")) {
            return "needs_reconcile";
        }
        if (set.contains("needs_reconnect")) {
            return "needs_reconnect";
        }
        if (set.contains("failed")) {
            return "failed";
        }
        if (set.contains("scheduled")) {
            return "scheduled";
        }
        if (set.contains("approved")) {
            return "approved";
        }
        if (set.contains("awaiting_approval")) {
            return "awaiting_approval";
        }
        if (statuses.stream().allMatch("cancelled"::equals)) {
            return "cancelled";
        }
        return "draft";
    }

    private static boolean isTerminalProblem(String status) {
        return "failed".equals(status) || "cancelled".equals(status) || "needs_reconnect".equals(status) || "needs_reconcile".equals(status);
    }
}
