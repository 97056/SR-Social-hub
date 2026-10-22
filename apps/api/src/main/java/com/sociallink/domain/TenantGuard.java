package com.sociallink.domain;

import java.util.UUID;

public final class TenantGuard {
    private TenantGuard() {
    }

    public static void sameWorkspace(UUID actorWorkspace, UUID resourceWorkspace) {
        if (actorWorkspace == null || resourceWorkspace == null || !actorWorkspace.equals(resourceWorkspace)) {
            throw new NotFoundException();
        }
    }

    public static final class NotFoundException extends RuntimeException {
        public NotFoundException() {
            super("Not found.");
        }
    }
}
