package com.sociallink.domain;

import java.util.ArrayList;
import java.util.List;

public final class EntitlementService {
    public PlanLimits resolve(PlanLimits plan, PlanLimits override) {
        if (plan.negotiated()) {
            if (override == null) {
                throw new LimitException(
                        "custom_plan_unconfigured",
                        "This workspace is on a negotiated plan. An admin must apply the agreed limits before use."
                );
            }
            return override;
        }
        return plan;
    }

    public void checkCapacity(String metric, Integer max, long current, long additional) {
        if (max == null) {
            throw new LimitException("limit_not_set", "The " + metric + " limit is not configured.");
        }
        if (current + additional > max) {
            throw new LimitException(
                    "limit_exceeded",
                    metric + " limit reached (" + max + ")."
            );
        }
    }

    public List<String> downgradeBlockers(UsageSnapshot usage, PlanLimits target) {
        PlanLimits effective = target.negotiated() ? null : target;
        List<String> blockers = new ArrayList<>();
        if (effective == null) {
            return blockers;
        }
        if (exceeds(usage.clientProfiles(), effective.clientProfiles())) {
            blockers.add("client_profiles");
        }
        if (exceeds(usage.connectedAccounts(), effective.connectedAccounts())) {
            blockers.add("connected_accounts");
        }
        if (exceeds(usage.teamMembers(), effective.teamMembers())) {
            blockers.add("team_members");
        }
        return List.copyOf(blockers);
    }

    private static boolean exceeds(long used, Integer max) {
        return max != null && used > max;
    }

    public record UsageSnapshot(long clientProfiles, long connectedAccounts, long teamMembers) {
    }
}
