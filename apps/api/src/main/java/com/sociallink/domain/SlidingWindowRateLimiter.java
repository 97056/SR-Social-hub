package com.sociallink.domain;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

public final class SlidingWindowRateLimiter {
    private final LongSupplier clock;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter() {
        this(System::currentTimeMillis);
    }

    public SlidingWindowRateLimiter(LongSupplier clock) {
        this.clock = clock;
    }

    public boolean allow(String key, int max, long windowMillis) {
        long now = clock.getAsLong();
        long cutoff = now - windowMillis;
        Deque<Long> deque = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) {
                deque.pollFirst();
            }
            if (deque.size() >= max) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }
}
