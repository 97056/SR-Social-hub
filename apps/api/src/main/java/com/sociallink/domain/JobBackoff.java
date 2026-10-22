package com.sociallink.domain;

import java.time.Duration;

public final class JobBackoff {
    private static final long BASE_MILLIS = 30_000L;
    private static final long MAX_MILLIS = Duration.ofHours(6).toMillis();

    private JobBackoff() {
    }

    public static Duration backoff(int attempt, long jitterMillis) {
        int shift = Math.min(Math.max(attempt, 0), 6);
        long exp = BASE_MILLIS << shift;
        long jitter = Math.floorMod(jitterMillis, BASE_MILLIS);
        return Duration.ofMillis(Math.min(exp + jitter, MAX_MILLIS));
    }
}
