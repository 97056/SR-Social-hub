package com.sociallink.service;

import com.sociallink.common.ApiException;
import com.sociallink.common.AuthPrincipal;
import com.sociallink.domain.EntitlementService;
import com.sociallink.domain.PlanLimits;
import com.sociallink.domain.RolePermissions;
import com.sociallink.domain.ScheduleTimes;
import com.sociallink.store.AuthStore;
import com.sociallink.store.BillingStore;
import com.sociallink.store.TenantStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class WorkspaceService {
    private final TenantStore tenants;
    private final BillingStore billing;
    private final AuthStore authStore;
    private final EntitlementService entitlements = new EntitlementService();

    public WorkspaceService(TenantStore tenants, BillingStore billing, AuthStore authStore) {
        this.tenants = tenants;
        this.billing = billing;
        this.authStore = authStore;
    }

    @Transactional
    public UUID create(AuthPrincipal actor, String name, String workspaceType, String timezone) {
        if (!actor.emailVerified()) {
            throw new ApiException(403, "email_unverified", "Verify your email before creating a workspace.");
        }
        if (!"business".equals(workspaceType) && !"agency".equals(workspaceType)) {
            throw new ApiException(400, "invalid_workspace_type", "Choose Business or Agency.");
        }
        try {
            ScheduleTimes.zoneOrThrow(timezone);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "invalid_timezone", "Choose a valid timezone.");
        }
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isBlank() || trimmed.length() > 200) {
            throw new ApiException(400, "invalid_name", "Enter a workspace name.");
        }
        return tenants.insertWorkspace(actor.userId(), trimmed, workspaceType, timezone);
    }

    public PlanLimits activeLimits(UUID workspaceId) {
        var subscription = billing.openSubscription(workspaceId).filter(row -> "active".equals(row.status())).orElse(null);
        if (subscription == null) {
            throw new ApiException(402, "subscription_required", "Choose a plan before using this workspace.");
        }
        var plan = billing.findPlanByCode(subscription.planCode()).orElseThrow();
        return entitlements.resolve(plan.limits(), subscription.override());
    }

    public RolePermissions requireRole(AuthPrincipal actor) {
        if (actor.workspaceId() == null || actor.workspaceRole() == null) {
            throw new ApiException(409, "workspace_required", "Create or select a workspace first.");
        }
        return RolePermissions.parse(actor.workspaceRole());
    }

    public void bindSession(String tokenHash, UUID workspaceId) {
        authStore.bindWorkspace(tokenHash, workspaceId);
    }
}
