package com.sociallink.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanLimits(
        Integer clientProfiles,
        Integer connectedAccounts,
        Integer postTargetsPerMonth,
        Integer teamMembers,
        Long storageBytes,
        boolean exactClientCap,
        boolean negotiated
) {
    public PlanLimits {
        if (clientProfiles != null && clientProfiles < 0) {
            throw new IllegalArgumentException("clientProfiles cannot be negative");
        }
        if (connectedAccounts != null && connectedAccounts < 0) {
            throw new IllegalArgumentException("connectedAccounts cannot be negative");
        }
        if (postTargetsPerMonth != null && postTargetsPerMonth < 0) {
            throw new IllegalArgumentException("postTargetsPerMonth cannot be negative");
        }
        if (teamMembers != null && teamMembers < 0) {
            throw new IllegalArgumentException("teamMembers cannot be negative");
        }
        if (storageBytes != null && storageBytes < 0) {
            throw new IllegalArgumentException("storageBytes cannot be negative");
        }
    }
}
