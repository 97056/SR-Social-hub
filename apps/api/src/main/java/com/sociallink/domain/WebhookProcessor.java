package com.sociallink.domain;

import java.util.function.Consumer;

public final class WebhookProcessor {
    public enum ProcessResult {
        APPLIED,
        DUPLICATE,
        REJECTED
    }

    public record Notice(String providerEventId, String eventType, boolean signatureVerified, String payloadReference) {
    }

    public interface Store {
        boolean insertIfAbsent(Notice notice);
    }

    public ProcessResult process(Notice notice, Store store, Consumer<Notice> apply) {
        if (notice == null || !notice.signatureVerified() || notice.providerEventId() == null || notice.providerEventId().isBlank()) {
            return ProcessResult.REJECTED;
        }
        if (!store.insertIfAbsent(notice)) {
            return ProcessResult.DUPLICATE;
        }
        apply.accept(notice);
        return ProcessResult.APPLIED;
    }
}
