package com.sociallink.domain;

import java.util.Locale;

public enum RolePermissions {
    OWNER,
    ADMIN,
    CREATOR,
    APPROVER,
    ANALYST;

    public static RolePermissions parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Unknown role.");
        }
        try {
            return RolePermissions.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown role.");
        }
    }

    public boolean canManageBilling() {
        return this == OWNER;
    }

    public boolean canManageMembers() {
        return this == OWNER || this == ADMIN;
    }

    public boolean canAssignOwner() {
        return this == OWNER;
    }

    public boolean canManageClients() {
        return this == OWNER || this == ADMIN;
    }

    public boolean canCreateContent() {
        return this == OWNER || this == ADMIN || this == CREATOR;
    }

    public boolean canApprove() {
        return this == OWNER || this == ADMIN || this == APPROVER;
    }

    public boolean canViewAllClients() {
        return this == OWNER || this == ADMIN || this == ANALYST;
    }

    public boolean canPublish() {
        return this == OWNER || this == ADMIN;
    }

    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
