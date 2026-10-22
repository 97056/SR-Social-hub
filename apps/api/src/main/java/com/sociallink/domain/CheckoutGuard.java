package com.sociallink.domain;

public final class CheckoutGuard {
    private CheckoutGuard() {
    }

    public static String rejection(boolean credentialsPresent, boolean negotiatedPlan, String providerPlanId) {
        if (negotiatedPlan) {
            return "custom_plan_requires_quote";
        }
        if (!credentialsPresent) {
            return "payment_provider_not_configured";
        }
        if (providerPlanId == null || providerPlanId.isBlank()) {
            return "plan_not_linked";
        }
        return null;
    }
}
