package com.sociallink.service;

import com.sociallink.common.ApiException;
import com.sociallink.common.AuthPrincipal;
import com.sociallink.domain.EntitlementService;
import com.sociallink.domain.ScheduleTimes;
import com.sociallink.store.AuthStore;
import com.sociallink.store.TenantStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
public class ClientService {
    private final TenantStore tenants;
    private final WorkspaceService workspaces;
    private final AuthStore authStore;
    private final EntitlementService entitlements = new EntitlementService();

    public ClientService(TenantStore tenants, WorkspaceService workspaces, AuthStore authStore) {
        this.tenants = tenants;
        this.workspaces = workspaces;
        this.authStore = authStore;
    }

    @Transactional
    public TenantStore.ClientRow create(AuthPrincipal actor, String name, String timezone, String notes) {
        var role = workspaces.requireRole(actor);
        if (!role.canManageClients()) {
            throw new ApiException(403, "forbidden", "You cannot add client profiles.");
        }
        try {
            ScheduleTimes.zoneOrThrow(timezone);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "invalid_timezone", "Choose a valid timezone.");
        }
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isBlank()) {
            throw new ApiException(400, "invalid_name", "Enter a client name.");
        }
        var limits = workspaces.activeLimits(actor.workspaceId());
        entitlements.checkCapacity("Client profiles", limits.clientProfiles(), tenants.countClients(actor.workspaceId()), 1);
        UUID id = tenants.insertClient(actor.workspaceId(), trimmed, timezone, notes == null ? null : notes.trim());
        return tenants.findClient(actor.workspaceId(), id).orElseThrow();
    }

    public java.util.List<TenantStore.ClientRow> list(AuthPrincipal actor) {
        var role = workspaces.requireRole(actor);
        return tenants.listClients(actor.workspaceId(), actor.userId(), role.canViewAllClients());
    }

    public TenantStore.ClientRow get(AuthPrincipal actor, UUID clientId) {
        var role = workspaces.requireRole(actor);
        var client = tenants.findClient(actor.workspaceId(), clientId).orElseThrow(com.sociallink.domain.TenantGuard.NotFoundException::new);
        if (!role.canViewAllClients() && tenants.listClients(actor.workspaceId(), actor.userId(), false).stream().noneMatch(row -> row.id().equals(clientId))) {
            throw new com.sociallink.domain.TenantGuard.NotFoundException();
        }
        return client;
    }

    @Transactional
    public void addMember(AuthPrincipal actor, String email, String roleName) {
        var role = workspaces.requireRole(actor);
        if (!role.canManageMembers()) {
            throw new ApiException(403, "forbidden", "You cannot manage members.");
        }
        checkAssignable(role, roleName);
        var user = authStore.findUserByEmail(email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ApiException(404, "user_not_found", "That person needs an SR Social hub account before they can be added."));
        boolean alreadyMember = tenants.memberRole(actor.workspaceId(), user.id()).isPresent();
        if (!alreadyMember) {
            var limits = workspaces.activeLimits(actor.workspaceId());
            entitlements.checkCapacity("Team members", limits.teamMembers(), tenants.countMembers(actor.workspaceId()), 1);
        }
        tenants.addMember(actor.workspaceId(), user.id(), roleName);
    }

    private static void checkAssignable(com.sociallink.domain.RolePermissions actorRole, String roleName) {
        var next = com.sociallink.domain.RolePermissions.parse(roleName);
        if (next == com.sociallink.domain.RolePermissions.OWNER && !actorRole.canAssignOwner()) {
            throw new ApiException(403, "forbidden", "Only an owner can assign the owner role.");
        }
    }
}
