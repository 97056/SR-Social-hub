package com.sociallink.domain;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;

public final class ScheduleTimes {
    private ScheduleTimes() {
    }

    public static Instant toUtc(LocalDateTime local, ZoneId zone) {
        return local.atZone(zone).toInstant();
    }

    public static LocalDateTime toLocal(Instant utc, ZoneId zone) {
        return LocalDateTime.ofInstant(utc, zone);
    }

    public static String billingPeriod(Instant instant, ZoneId zone) {
        return YearMonth.from(instant.atZone(zone)).toString();
    }

    public static ZoneId zoneOrThrow(String timezone) {
        try {
            return ZoneId.of(timezone);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Unknown timezone.");
        }
    }
}
