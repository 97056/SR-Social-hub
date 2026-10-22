package com.sociallink.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sociallink.common.ApiException;
import com.sociallink.config.AppProperties;
import com.sociallink.config.SecurityConfig;
import com.sociallink.domain.CheckoutGuard;
import com.sociallink.domain.EmailTemplateRenderer;
import com.sociallink.domain.EntitlementService;
import com.sociallink.domain.PlanLimits;
import com.sociallink.domain.RolePermissions;
import com.sociallink.domain.ScheduleTimes;
import com.sociallink.domain.SlidingWindowRateLimiter;
import com.sociallink.domain.ThemeValidator;
import com.sociallink.store.AdminStore;
import com.sociallink.store.AuthStore;
import com.sociallink.store.BillingStore;
import com.sociallink.store.TenantStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CatalogService {
    private final BillingStore billing;
    private final AdminStore admin;
    private final TenantStore tenants;
    private final AuthStore authStore;
    private final AppProperties properties;
    private final SecurityConfig.SecretBox secretBox;
    private final ObjectMapper mapper;
    private final ThemeValidator themes = new ThemeValidator();
    private final EntitlementService entitlements = new EntitlementService();
    private final SlidingWindowRateLimiter rateLimiter = new SlidingWindowRateLimiter();

    public CatalogService(BillingStore billing, AdminStore admin, TenantStore tenants, AuthStore authStore, AppProperties properties,
                          SecurityConfig.SecretBox secretBox, ObjectMapper mapper) {
        this.billing = billing;
        this.admin = admin;
        this.tenants = tenants;
        this.authStore = authStore;
        this.properties = properties;
        this.secretBox = secretBox;
        this.mapper = mapper;
    }

    public List<Map<String, Object>> publicPlans() {
        return billing.activePlans().stream().map(this::planView).toList();
    }

    public Map<String, Object> theme() {
        var row = admin.theme();
        var tokens = themes.validate(new ThemeValidator.Input(row.brandName(), row.logoUrl(), row.faviconUrl(), row.primaryColor(),
                row.secondaryColor(), row.accentColor(), row.backgroundColor(), row.surfaceColor(), row.textColor(), row.fontFamily(),
                row.fontSizeBase(), row.radius(), row.buttonStyle(), row.colorMode()));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("brandName", tokens.brandName());
        body.put("logoUrl", tokens.logoUrl());
        body.put("faviconUrl", tokens.faviconUrl());
        body.put("primaryColor", tokens.primaryColor());
        body.put("secondaryColor", tokens.secondaryColor());
        body.put("accentColor", tokens.accentColor());
        body.put("backgroundColor", tokens.backgroundColor());
        body.put("surfaceColor", tokens.surfaceColor());
        body.put("textColor", tokens.textColor());
        body.put("fontFamily", tokens.fontFamily());
        body.put("fontSizeBase", tokens.fontSizeBase());
        body.put("radius", tokens.radius());
        body.put("buttonStyle", tokens.buttonStyle());
        body.put("colorMode", tokens.colorMode());
        body.put("primaryForeground", tokens.primaryForeground());
        body.put("secondaryForeground", tokens.secondaryForeground());
        body.put("accentForeground", tokens.accentForeground());
        return body;
    }

    @Transactional
    public Map<String, Object> saveTheme(UUID actorId, ThemeValidator.Input input) {
        var tokens = themes.validate(input);
        admin.saveTheme(new AdminStore.ThemeRow(tokens.brandName(), tokens.logoUrl(), tokens.faviconUrl(), tokens.primaryColor(),
                tokens.secondaryColor(), tokens.accentColor(), tokens.backgroundColor(), tokens.surfaceColor(), tokens.textColor(),
                tokens.fontFamily(), tokens.fontSizeBase(), tokens.radius(), tokens.buttonStyle(), tokens.colorMode()), actorId);
        admin.audit(actorId, null, "theme.update", "theme_settings", "1", "{}");
        return theme();
    }

    public Map<String, Object> status() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("publishingMode", properties.getPublishing().isSandbox() ? "sandbox" : "live");
        body.put("publishingNote", properties.getPublishing().isSandbox()
                ? "Sandbox mode is on. Posts are marked sandbox and no external network call is made."
                : "Live mode does not mean a provider is approved. Unverified connectors stay unavailable.");
        boolean emailKey = properties.getEmail().getApiKey() != null && !properties.getEmail().getApiKey().isBlank();
        body.put("emailDelivery", emailKey ? "provider_key_present" : "outbox");
        body.put("storage", properties.getStorage().configured() ? "configured" : "not_configured");
        body.put("payments", properties.getRazorpay().credentialsPresent() ? "configured" : "not_configured");
        body.put("maintenance", Map.of("enabled", admin.maintenanceEnabled(), "config", admin.maintenanceMessage()));
        return body;
    }

    public List<Map<String, Object>> customerIntegrations() {
        return admin.integrations().stream().map(row -> {
            String state = "verified".equals(row.verificationStatus()) ? "verified" : "coming_soon";
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("provider", row.provider());
            item.put("displayName", row.displayName());
            item.put("state", state);
            item.put("docsUrl", row.docsUrl());
            return item;
        }).toList();
    }

    public List<Map<String, Object>> adminIntegrations() {
        return admin.integrations().stream().map(this::adminIntegration).toList();
    }

    @Transactional
    public Map<String, Object> saveIntegration(UUID actorId, String provider, boolean enabled, String clientId, String secret,
                                              String redirectUri, String scopes, String apiVersion, String environment) {
        var existing = admin.integration(provider).orElseThrow(() -> new ApiException(404, "not_found", "Unknown provider."));
        if (environment != null && !environment.equals("test") && !environment.equals("live")) {
            throw new ApiException(400, "invalid_environment", "Environment must be test or live.");
        }
        if (redirectUri != null && !redirectUri.isBlank() && !redirectUri.startsWith("https://") && !redirectUri.startsWith("http://localhost")) {
            throw new ApiException(400, "invalid_redirect", "Use an https callback URL, or http://localhost for development.");
        }
        boolean replaceSecret = secret != null && !secret.isBlank();
        String ciphertext = replaceSecret ? secretBox.encrypt(secret) : null;
        boolean secretSet = replaceSecret || existing.secretSet();
        boolean configured = clientId != null && !clientId.isBlank() && secretSet;
        admin.updateIntegration(provider, enabled, blankToNull(clientId), ciphertext, replaceSecret, blankToNull(redirectUri),
                scopes == null ? "" : scopes, blankToNull(apiVersion), environment == null ? existing.environment() : environment,
                configured ? "configured" : "unverified", actorId);
        admin.audit(actorId, null, "integration.update", "social_integrations", provider,
                "{\"secretUpdated\":" + replaceSecret + "}");
        return adminIntegration(admin.integration(provider).orElseThrow());
    }

    public Map<String, Object> health(String provider) {
        var row = admin.integration(provider).orElseThrow(() -> new ApiException(404, "not_found", "Unknown provider."));
        String message = row.secretSet() && row.clientId() != null
                ? "Credentials are stored. No live provider call was made. Verification requires an authorized end-to-end test."
                : "Credentials are missing. No live provider call was made.";
        admin.recordHealth(provider, message);
        return Map.of("provider", provider, "status", "unverified", "message", message);
    }

    @Transactional
    public Map<String, Object> quote(String ip, UUID workspaceId, String source, String company, String contactName, String email, String phone,
                                     Integer clientCount, Integer accountCount, Integer monthlyVolume, String platforms, String notes) {
        if (!rateLimiter.allow(source + ":" + ip, admin.publicFormLimit(), Duration.ofHours(1).toMillis())) {
            throw new ApiException(429, "rate_limited", "Too many requests. Wait and try again.");
        }
        String normalized = email.trim().toLowerCase();
        if (!normalized.contains("@") || contactName == null || contactName.isBlank()) {
            throw new ApiException(400, "validation_failed", "Enter a contact name and email.");
        }
        String limits = mapper.createObjectNode()
                .put("clientCount", clientCount == null ? 0 : clientCount)
                .put("accountCount", accountCount == null ? 0 : accountCount)
                .put("monthlyVolume", monthlyVolume == null ? 0 : monthlyVolume)
                .toString();
        UUID id = admin.insertQuote(workspaceId, source, blankToNull(company), contactName.trim(), normalized, blankToNull(phone),
                clientCount, accountCount, monthlyVolume, blankToNull(platforms), blankToNull(notes), limits);
        Map<String, String> values = Map.of("name", contactName.trim(), "email", normalized, "brand", authStore.brandName(), "link", properties.getBaseUrl());
        authStore.insertOutbox(normalized, EmailTemplateRenderer.render(authStore.template("quote_received", "subject"), values),
                EmailTemplateRenderer.render(authStore.template("quote_received", "body"), values));
        admin.audit(null, workspaceId, "quote.create", "quote_requests", id.toString(), "{\"source\":\"" + source + "\"}");
        return Map.of("id", id, "status", "new");
    }

    public Map<String, Object> billingSummary(UUID workspaceId, RolePermissions role) {
        if (!role.canManageBilling() && role != RolePermissions.ADMIN && role != RolePermissions.ANALYST) {
            throw new ApiException(403, "forbidden", "You do not have access to billing.");
        }
        var workspace = tenants.findWorkspace(workspaceId).orElseThrow(() -> new ApiException(404, "not_found", "Not found."));
        ZoneId zone = ScheduleTimes.zoneOrThrow(workspace.timezone());
        var period = YearMonth.from(Instant.now().atZone(zone));
        var subscription = billing.openSubscription(workspaceId).orElse(null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("subscription", subscription == null ? null : Map.of(
                "status", subscription.status(),
                "planCode", subscription.planCode(),
                "periodEnd", subscription.periodEnd(),
                "chargeCount", subscription.chargeCount()
        ));
        PlanLimits limits = null;
        if (subscription != null && "active".equals(subscription.status())) {
            limits = entitlements.resolve(billing.findPlanByCode(subscription.planCode()).orElseThrow().limits(), subscription.override());
        }
        body.put("limits", limits);
        body.put("usage", Map.of(
                "clientProfiles", tenants.countClients(workspaceId),
                "connectedAccounts", tenants.countAccounts(workspaceId),
                "teamMembers", tenants.countMembers(workspaceId),
                "postTargets", billing.usage(workspaceId, period.toString(), "post_targets")
        ));
        body.put("pricesIncludeTax", false);
        body.put("taxNote", "Prices exclude taxes unless the plan says they are included. Confirm the tax treatment before publishing checkout.");
        return body;
    }

    public Map<String, Object> checkout(String planCode) {
        var plan = billing.findPlanByCode(planCode).orElseThrow(() -> new ApiException(404, "not_found", "Unknown plan."));
        String rejection = CheckoutGuard.rejection(properties.getRazorpay().credentialsPresent(), plan.negotiated(), plan.providerPlanId());
        if (rejection != null) {
            String message = switch (rejection) {
                case "custom_plan_requires_quote" -> "Custom plans start with a quote. No checkout was created.";
                case "payment_provider_not_configured" -> "Razorpay is not configured. No payment was created.";
                default -> "This plan is not linked to a Razorpay plan yet. No payment was created.";
            };
            throw new ApiException(409, rejection, message);
        }
        throw new ApiException(409, "checkout_not_completed", "Provider credentials exist, but subscription creation is not marked ready until a signed webhook test passes.");
    }

    @Transactional
    public Map<String, Object> savePlan(UUID actorId, String code, Map<String, Object> body) {
        var existing = billing.findPlanByCode(code).orElseThrow(() -> new ApiException(404, "not_found", "Unknown plan."));
        try {
            String limitsJson = mapper.writeValueAsString(body.getOrDefault("limits", existing.limits()));
            mapper.readValue(limitsJson, PlanLimits.class);
            String featuresJson = mapper.writeValueAsString(body.getOrDefault("features", mapper.readTree(existing.featuresJson())));
            String upgradeJson = mapper.writeValueAsString(body.getOrDefault("upgradeRules", mapper.readTree(existing.upgradeRulesJson())));
            billing.updatePlan(code,
                    String.valueOf(body.getOrDefault("name", existing.name())),
                    String.valueOf(body.getOrDefault("description", existing.description())),
                    body.get("pricePaise") == null ? existing.pricePaise() : ((Number) body.get("pricePaise")).intValue(),
                    body.get("annualPricePaise") == null ? existing.annualPricePaise() : ((Number) body.get("annualPricePaise")).intValue(),
                    body.get("pricesIncludeTax") == null ? existing.pricesIncludeTax() : Boolean.TRUE.equals(body.get("pricesIncludeTax")),
                    body.get("displayOrder") == null ? existing.displayOrder() : ((Number) body.get("displayOrder")).intValue(),
                    limitsJson, featuresJson, upgradeJson,
                    body.get("active") == null ? existing.active() : Boolean.TRUE.equals(body.get("active")),
                    body.get("providerPlanId") == null ? existing.providerPlanId() : String.valueOf(body.get("providerPlanId")));
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(400, "invalid_plan", "Plan details could not be saved. Check prices, limits, and features.");
        }
        admin.audit(actorId, null, "plan.update", "plans", code, "{}");
        return planView(billing.findPlanByCode(code).orElseThrow());
    }

    public Map<String, Object> planView(BillingStore.PlanRow plan) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("code", plan.code());
        view.put("name", plan.name());
        view.put("description", plan.description());
        view.put("pricePaise", plan.pricePaise());
        view.put("annualPricePaise", plan.annualPricePaise());
        view.put("currency", "INR");
        view.put("pricesIncludeTax", plan.pricesIncludeTax());
        view.put("displayOrder", plan.displayOrder());
        view.put("limits", plan.limits());
        view.put("active", plan.active());
        try {
            view.put("features", mapper.readTree(plan.featuresJson()));
            view.put("upgradeRules", mapper.readTree(plan.upgradeRulesJson()));
        } catch (Exception ex) {
            view.put("features", List.of());
            view.put("upgradeRules", Map.of());
        }
        return view;
    }

    private Map<String, Object> adminIntegration(AdminStore.IntegrationRow row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("provider", row.provider());
        item.put("displayName", row.displayName());
        item.put("enabled", row.enabled());
        item.put("clientId", row.clientId());
        item.put("secretSet", row.secretSet());
        item.put("redirectUri", row.redirectUri());
        item.put("scopes", row.scopes());
        item.put("apiVersion", row.apiVersion());
        item.put("environment", row.environment());
        item.put("consoleUrl", row.consoleUrl());
        item.put("docsUrl", row.docsUrl());
        item.put("verificationStatus", row.verificationStatus());
        item.put("lastHealthAt", row.lastHealthAt());
        item.put("lastHealthMessage", row.lastHealthMessage());
        return item;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public List<String> downgradeBlockers(UUID workspaceId, String planCode) {
        var plan = billing.findPlanByCode(planCode).orElseThrow(() -> new ApiException(404, "not_found", "Unknown plan."));
        var usage = new EntitlementService.UsageSnapshot(tenants.countClients(workspaceId), tenants.countAccounts(workspaceId), tenants.countMembers(workspaceId));
        return new ArrayList<>(entitlements.downgradeBlockers(usage, plan.limits()));
    }
}
