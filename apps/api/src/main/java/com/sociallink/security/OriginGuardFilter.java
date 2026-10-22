package com.sociallink.security;

import com.sociallink.common.HttpResponses;
import com.sociallink.config.AppProperties;
import com.sociallink.store.AdminStore;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Locale;

@Component
public class OriginGuardFilter extends OncePerRequestFilter {
    private final AppProperties properties;
    private final AdminStore adminStore;

    public OriginGuardFilter(AppProperties properties, AdminStore adminStore) {
        this.properties = properties;
        this.adminStore = adminStore;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        boolean mutating = method.equals("POST") || method.equals("PUT") || method.equals("PATCH") || method.equals("DELETE");
        String path = request.getRequestURI();
        if (mutating && path.startsWith("/api/") && !path.startsWith("/api/webhooks/")) {
            if (!"sociallink".equals(request.getHeader("X-Requested-With"))) {
                HttpResponses.write(response, 403, "csrf_rejected", "Missing required request header.");
                return;
            }
            String origin = request.getHeader("Origin");
            if (origin != null && !origin.isBlank() && !allowed(origin)) {
                HttpResponses.write(response, 403, "origin_rejected", "This origin is not allowed.");
                return;
            }
        }
        var principal = SessionAuthFilter.currentOrNull();
        if (principal != null && path.startsWith("/api/admin/") && !principal.mfaEnabled() && adminStore.mfaRequiredForAdmins()) {
            HttpResponses.write(response, 403, "mfa_enrollment_required", "Turn on an authenticator before using the admin console.");
            return;
        }
        if (principal != null && "suspended".equals(principal.workspaceStatus()) && path.startsWith("/api/")
                && !path.startsWith("/api/auth/") && !path.startsWith("/api/admin/") && !path.startsWith("/api/billing")) {
            HttpResponses.write(response, 403, "workspace_suspended", "This workspace is suspended.");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean allowed(String origin) {
        if (origin.equals(properties.getBaseUrl())) {
            return true;
        }
        return Arrays.stream(adminStore.allowedOrigins().split(","))
                .map(String::trim)
                .anyMatch(origin::equals);
    }
}
