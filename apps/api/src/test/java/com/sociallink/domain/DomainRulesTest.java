package com.sociallink.domain;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DomainRulesTest {
    private final EntitlementService entitlements = new EntitlementService();
    private final ApprovalPolicy approvals = new ApprovalPolicy();
    private final PublishPolicy publishing = new PublishPolicy();

    @Test
    void agencyPlanStopsAtSixClientProfiles() {
        PlanLimits agency = new PlanLimits(6, 15, 300, 10, 10L, true, false);
        entitlements.checkCapacity("Client profiles", agency.clientProfiles(), 5, 1);
        LimitException ex = assertThrows(LimitException.class,
                () -> entitlements.checkCapacity("Client profiles", agency.clientProfiles(), 6, 1));
        assertEquals("limit_exceeded", ex.code());
    }

    @Test
    void starterAndGrowthCapsAreEnforced() {
        assertThrows(LimitException.class, () -> entitlements.checkCapacity("Connected accounts", 5, 5, 1));
        entitlements.checkCapacity("Post targets", 150, 149, 1);
        assertThrows(LimitException.class, () -> entitlements.checkCapacity("Team members", 2, 2, 1));
    }

    @Test
    void negotiatedPlanWithoutOverrideIsBlocked() {
        PlanLimits custom = new PlanLimits(null, null, null, null, null, false, true);
        assertThrows(LimitException.class, () -> entitlements.resolve(custom, null));
        PlanLimits agreed = new PlanLimits(12, 40, 1000, 25, 50L, false, false);
        assertEquals(12, entitlements.resolve(custom, agreed).clientProfiles());
    }

    @Test
    void downgradeIsBlockedWhenUsageExceedsTarget() {
        var usage = new EntitlementService.UsageSnapshot(5, 2, 2);
        List<String> blockers = entitlements.downgradeBlockers(usage, new PlanLimits(3, 5, 60, 2, 1L, false, false));
        assertEquals(List.of("client_profiles"), blockers);
        assertTrue(entitlements.downgradeBlockers(usage, new PlanLimits(6, 15, 300, 10, 1L, true, false)).isEmpty());
    }

    @Test
    void unapprovedPostCannotPublishAndEditsInvalidateApproval() {
        assertFalse(approvals.mayPublish(true, "pending", null, 1));
        assertFalse(approvals.mayPublish(true, "approved", 1, 2));
        assertTrue(approvals.mayPublish(true, "approved", 2, 2));
        assertTrue(approvals.mayPublish(false, "pending", null, 1));
        var approved = new ApprovalPolicy.ContentSnapshot("Hello", "#a", "m1", "acc1");
        assertTrue(approvals.materialChangeInvalidates(approved, new ApprovalPolicy.ContentSnapshot("Hello!", "#a", "m1", "acc1")));
        assertFalse(approvals.materialChangeInvalidates(approved, new ApprovalPolicy.ContentSnapshot("Hello", "#a", "m1", "acc1")));
    }

    @Test
    void lateApprovalDoesNotPublishSilently() {
        Instant scheduled = Instant.parse("2026-10-22T08:00:00Z");
        Instant later = Instant.parse("2026-10-22T09:00:00Z");
        assertEquals(ApprovalPolicy.LateApprovalDecision.BLOCK_RESCHEDULE, approvals.onApprove(scheduled, later, true));
        assertEquals(ApprovalPolicy.LateApprovalDecision.ALLOW, approvals.onApprove(later, scheduled, true));
    }

    @Test
    void partialTargetResultsStayDistinct() {
        assertEquals("published", PostRollup.summarize(List.of("published", "published")));
        assertEquals("partially_failed", PostRollup.summarize(List.of("published", "failed")));
        assertEquals("scheduled", PostRollup.summarize(List.of("published", "scheduled")));
        assertEquals("failed", PostRollup.summarize(List.of("failed", "failed")));
        assertEquals("needs_reconnect", PostRollup.summarize(List.of("needs_reconnect")));
        assertEquals("sandbox_published", PostRollup.summarize(List.of("sandbox_published")));
        assertEquals("draft", PostRollup.summarize(List.of()));
    }

    @Test
    void uncertainPublishIsReconciledBeforeRetry() {
        var job = sampleJob(true);
        assertTrue(publishing.beforeCall(job) instanceof PublishPolicy.Decision.Publish);
        var uncertain = publishing.afterResult(
                new PublishPolicy.Result(PublishPolicy.Outcome.UNCERTAIN, null, "timeout", "The provider did not confirm the post.", false),
                1,
                Instant.parse("2026-10-22T00:00:00Z"),
                0
        );
        var update = (PublishPolicy.Decision.Update) uncertain;
        assertEquals("needs_reconcile", update.jobStatus());
        assertEquals("needs_reconcile", update.targetStatus());
        assertFalse(update.countUsage());
    }

    @Test
    void inactiveSubscriptionAndMissingApprovalDoNotPublish() {
        var inactive = new PublishPolicy.JobView(UUID.randomUUID(), UUID.randomUUID(), 0, null, false, null, null, 1, "facebook", false);
        var blocked = (PublishPolicy.Decision.Update) publishing.beforeCall(inactive);
        assertEquals("subscription_inactive", blocked.errorCode());

        var pending = new PublishPolicy.JobView(UUID.randomUUID(), UUID.randomUUID(), 0, null, true, "pending", null, 1, "facebook", true);
        var approval = (PublishPolicy.Decision.Update) publishing.beforeCall(pending);
        assertEquals("approval_pending", approval.errorCode());
        assertEquals("cancelled", approval.jobStatus());
    }

    @Test
    void liveAdapterNeverReportsASuccessfulPublish() {
        var result = PublishAdapters.dispatch("facebook", UUID.randomUUID(), false);
        assertEquals(PublishPolicy.Outcome.PERMANENT, result.outcome());
        assertEquals(null, result.externalId());
        var sandbox = PublishAdapters.dispatch("facebook", UUID.randomUUID(), true);
        assertTrue(sandbox.sandbox());
        assertTrue(sandbox.externalId().startsWith("sandbox:"));
    }

    @Test
    void sandboxSuccessDoesNotCountAsARealPostTarget() {
        var result = publishing.afterResult(
                new PublishPolicy.Result(PublishPolicy.Outcome.SUCCESS, "sandbox:1", "sandbox", "Sandbox adapter. No external API was called.", true),
                0,
                Instant.parse("2026-10-22T00:00:00Z"),
                0
        );
        var update = (PublishPolicy.Decision.Update) result;
        assertEquals("sandbox_published", update.targetStatus());
        assertFalse(update.countUsage());
    }

    @Test
    void transientRetryUsesBackoffAndJitter() {
        var result = (PublishPolicy.Decision.Update) publishing.afterResult(
                new PublishPolicy.Result(PublishPolicy.Outcome.TRANSIENT, null, "rate_limited", "The platform asked us to wait.", false),
                1,
                Instant.parse("2026-10-22T00:00:00Z"),
                5_000
        );
        assertEquals(Instant.parse("2026-10-22T00:01:05Z"), result.nextRun());
        assertEquals("pending", result.jobStatus());
    }

    @Test
    void scheduleIsStoredFromTheSelectedTimezone() {
        ZoneId kolkata = ZoneId.of("Asia/Kolkata");
        Instant utc = ScheduleTimes.toUtc(LocalDateTime.of(2026, 10, 22, 18, 30), kolkata);
        assertEquals(Instant.parse("2026-10-22T13:00:00Z"), utc);
        assertEquals("2026-11", ScheduleTimes.billingPeriod(Instant.parse("2026-10-31T20:00:00Z"), kolkata));
        assertEquals("2026-10", ScheduleTimes.billingPeriod(Instant.parse("2026-10-31T20:00:00Z"), ZoneId.of("UTC")));
    }

    @Test
    void duplicateWebhookDoesNotApplyTwice() {
        AtomicInteger applied = new AtomicInteger();
        var store = new WebhookProcessor.Store() {
            private String seen;

            @Override
            public boolean insertIfAbsent(WebhookProcessor.Notice notice) {
                if (notice.providerEventId().equals(seen)) {
                    return false;
                }
                seen = notice.providerEventId();
                return true;
            }
        };
        var processor = new WebhookProcessor();
        var notice = new WebhookProcessor.Notice("evt_1", "subscription.charged", true, "ref");
        assertEquals(WebhookProcessor.ProcessResult.APPLIED, processor.process(notice, store, n -> applied.incrementAndGet()));
        assertEquals(WebhookProcessor.ProcessResult.DUPLICATE, processor.process(notice, store, n -> applied.incrementAndGet()));
        assertEquals(WebhookProcessor.ProcessResult.REJECTED, processor.process(
                new WebhookProcessor.Notice("evt_2", "subscription.charged", false, "ref"),
                store,
                n -> applied.incrementAndGet()
        ));
        assertEquals(1, applied.get());
    }

    @Test
    void webhookSignatureRejectsTampering() {
        String secret = "whsec_test";
        byte[] body = "{\"a\":1}".getBytes();
        String signature = hmac(secret, body);
        assertTrue(WebhookSignatureVerifier.matches(secret, body, signature));
        assertFalse(WebhookSignatureVerifier.matches(secret, "{\"a\":2}".getBytes(), signature));
        assertFalse(WebhookSignatureVerifier.matches("", body, signature));
        assertFalse(WebhookSignatureVerifier.matches(secret, body, "zz"));
    }

    @Test
    void tenantGuardHidesOtherWorkspaces() {
        UUID one = UUID.randomUUID();
        UUID two = UUID.randomUUID();
        TenantGuard.sameWorkspace(one, one);
        assertThrows(TenantGuard.NotFoundException.class, () -> TenantGuard.sameWorkspace(one, two));
        assertThrows(TenantGuard.NotFoundException.class, () -> TenantGuard.sameWorkspace(null, one));
    }

    @Test
    void rolesMatchTheProductMatrix() {
        assertTrue(RolePermissions.OWNER.canManageBilling());
        assertFalse(RolePermissions.ADMIN.canManageBilling());
        assertTrue(RolePermissions.ADMIN.canManageClients());
        assertFalse(RolePermissions.CREATOR.canManageClients());
        assertTrue(RolePermissions.CREATOR.canCreateContent());
        assertFalse(RolePermissions.CREATOR.canPublish());
        assertTrue(RolePermissions.APPROVER.canApprove());
        assertFalse(RolePermissions.APPROVER.canCreateContent());
        assertTrue(RolePermissions.ANALYST.canViewAllClients());
        assertFalse(RolePermissions.ANALYST.canCreateContent());
        assertEquals(RolePermissions.OWNER, RolePermissions.parse("owner"));
    }

    @Test
    void checkoutStaysHonestWithoutProviderSetup() {
        assertEquals("custom_plan_requires_quote", CheckoutGuard.rejection(true, true, "plan_1"));
        assertEquals("payment_provider_not_configured", CheckoutGuard.rejection(false, false, "plan_1"));
        assertEquals("plan_not_linked", CheckoutGuard.rejection(true, false, " "));
        assertEquals(null, CheckoutGuard.rejection(true, false, "plan_1"));
    }

    @Test
    void themeRejectsWeakContrastAndMarkup() {
        var validator = new ThemeValidator();
        var good = validator.validate(seedInput());
        assertEquals("#FFFFFF", good.primaryForeground());
        assertThrows(ThemeValidator.ThemeValidationException.class, () -> validator.validate(new ThemeValidator.Input(
                "SocialLink", null, null, "#EEEEEE", "#115E59", "#9A3412", "#FFFFFF", "#FFFFFF", "#FFFFFF",
                "Source Sans 3", "16px", "0.75rem", "solid", "light"
        )));
        assertThrows(ThemeValidator.ThemeValidationException.class, () -> validator.validate(new ThemeValidator.Input(
                "<script>", null, null, "#0F3D3E", "#115E59", "#9A3412", "#F4F0E8", "#FFFDF9", "#1C1917",
                "Source Sans 3", "16px", "0.75rem", "solid", "light"
        )));
    }

    @Test
    void templatesAndPasswordsRejectUnsafeValues() {
        assertEquals("Hello Ada", EmailTemplateRenderer.render("Hello {{name}}", Map.of("name", "Ada")));
        assertThrows(IllegalArgumentException.class, () -> EmailTemplateRenderer.render("Hello <b>{{name}}</b>", Map.of("name", "Ada")));
        assertThrows(IllegalArgumentException.class, () -> PasswordPolicy.check("short"));
        PasswordPolicy.check("correct-horse-1");
    }

    @Test
    void rateLimiterTripsInsideTheWindow() {
        var clock = new long[]{1_000L};
        var limiter = new SlidingWindowRateLimiter(() -> clock[0]);
        assertTrue(limiter.allow("login", 2, 1_000));
        assertTrue(limiter.allow("login", 2, 1_000));
        assertFalse(limiter.allow("login", 2, 1_000));
        clock[0] = 2_500L;
        assertTrue(limiter.allow("login", 2, 1_000));
    }

    private static ThemeValidator.Input seedInput() {
        return new ThemeValidator.Input(
                "SocialLink", null, null, "#0F3D3E", "#115E59", "#9A3412", "#F4F0E8", "#FFFDF9", "#1C1917",
                "Source Sans 3", "16px", "0.75rem", "solid", "light"
        );
    }

    private static PublishPolicy.JobView sampleJob(boolean active) {
        return new PublishPolicy.JobView(UUID.randomUUID(), UUID.randomUUID(), 0, null, false, null, null, 1, "facebook", active);
    }

    private static String hmac(String secret, byte[] body) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(), "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(body));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
