package com.sociallink.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sociallink.domain.PlanLimits;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class BillingStore {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public BillingStore(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public record PlanRow(
            UUID id, String code, String name, String description, Integer pricePaise, Integer annualPricePaise,
            boolean pricesIncludeTax, int displayOrder, PlanLimits limits, String featuresJson, String upgradeRulesJson,
            boolean active, String providerPlanId, boolean negotiated
    ) {
    }

    public record SubscriptionRow(
            UUID id, UUID workspaceId, UUID planId, String planCode, String status, PlanLimits override,
            Instant periodStart, Instant periodEnd, int chargeCount, String providerSubscriptionId
    ) {
    }

    public List<PlanRow> activePlans() {
        return jdbc.query("SELECT * FROM plans WHERE active = TRUE ORDER BY display_order", params(), (rs, row) -> plan(rs));
    }

    public List<PlanRow> allPlans() {
        return jdbc.query("SELECT * FROM plans ORDER BY display_order", params(), (rs, row) -> plan(rs));
    }

    public Optional<PlanRow> findPlanByCode(String code) {
        return jdbc.query("SELECT * FROM plans WHERE code = :code", params().addValue("code", code), (rs, row) -> plan(rs)).stream().findFirst();
    }

    public Optional<SubscriptionRow> openSubscription(UUID workspaceId) {
        return jdbc.query("""
                SELECT s.id, s.workspace_id, s.plan_id, p.code, s.status, s.limits_override_json, s.period_start, s.period_end,
                       s.charge_count, s.provider_subscription_id
                FROM subscriptions s JOIN plans p ON p.id = s.plan_id
                WHERE s.workspace_id = :workspaceId AND s.status IN ('incomplete', 'active', 'past_due')
                ORDER BY s.created_at DESC LIMIT 1
                """, params().addValue("workspaceId", workspaceId), (rs, row) -> subscription(rs)).stream().findFirst();
    }

    public boolean insertEvent(String eventId, String eventType, UUID workspaceId, String payloadReference) {
        int inserted = jdbc.update("""
                INSERT INTO payment_events (id, provider, provider_event_id, event_type, workspace_id, payload_reference, signature_verified, processed_at, created_at)
                VALUES (:id, 'razorpay', :eventId, :eventType, :workspaceId, :payloadReference, TRUE, now(), now())
                ON CONFLICT (provider_event_id) DO NOTHING
                """, params().addValue("id", UUID.randomUUID()).addValue("eventId", eventId).addValue("eventType", eventType)
                .addValue("workspaceId", workspaceId).addValue("payloadReference", payloadReference));
        return inserted == 1;
    }

    public void applySubscription(UUID workspaceId, UUID planId, String providerSubscriptionId, String status, Instant periodStart, Instant periodEnd, boolean countCharge) {
        var existing = openSubscription(workspaceId);
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO subscriptions (id, workspace_id, plan_id, provider, provider_subscription_id, status, period_start, period_end, charge_count, created_at, updated_at)
                    VALUES (:id, :workspaceId, :planId, 'razorpay', :providerSubscriptionId, :status, :periodStart, :periodEnd, :charges, now(), now())
                    """, params().addValue("id", UUID.randomUUID()).addValue("workspaceId", workspaceId).addValue("planId", planId)
                    .addValue("providerSubscriptionId", providerSubscriptionId).addValue("status", status)
                    .addValue("periodStart", periodStart == null ? null : java.sql.Timestamp.from(periodStart))
                    .addValue("periodEnd", periodEnd == null ? null : java.sql.Timestamp.from(periodEnd))
                    .addValue("charges", countCharge ? 1 : 0));
            return;
        }
        jdbc.update("""
                UPDATE subscriptions
                SET plan_id = :planId, provider_subscription_id = COALESCE(:providerSubscriptionId, provider_subscription_id),
                    status = :status, period_start = COALESCE(:periodStart, period_start), period_end = COALESCE(:periodEnd, period_end),
                    charge_count = charge_count + :delta, updated_at = now()
                WHERE id = :id
                """, params().addValue("id", existing.get().id()).addValue("planId", planId)
                .addValue("providerSubscriptionId", providerSubscriptionId).addValue("status", status)
                .addValue("periodStart", periodStart == null ? null : java.sql.Timestamp.from(periodStart))
                .addValue("periodEnd", periodEnd == null ? null : java.sql.Timestamp.from(periodEnd))
                .addValue("delta", countCharge ? 1 : 0));
    }

    public int chargeCount(UUID workspaceId) {
        Integer count = jdbc.query("""
                SELECT COALESCE(max(charge_count), 0) AS charge_count FROM subscriptions WHERE workspace_id = :workspaceId
                """, params().addValue("workspaceId", workspaceId), rs -> rs.next() ? rs.getInt("charge_count") : 0);
        return count == null ? 0 : count;
    }

    public long postTargetsInPeriod(UUID workspaceId, Instant start, Instant end) {
        Long count = jdbc.queryForObject("""
                SELECT count(*) FROM post_targets t
                JOIN posts p ON p.id = t.post_id
                JOIN clients c ON c.id = p.client_id
                WHERE c.workspace_id = :workspaceId AND t.sandbox = FALSE
                  AND t.status IN ('scheduled', 'publishing', 'published')
                  AND COALESCE(t.published_at, p.scheduled_at) >= :start
                  AND COALESCE(t.published_at, p.scheduled_at) < :end
                """, params().addValue("workspaceId", workspaceId)
                .addValue("start", java.sql.Timestamp.from(start))
                .addValue("end", java.sql.Timestamp.from(end)), Long.class);
        return count == null ? 0 : count;
    }

    public void incrementPostTargets(UUID workspaceId, String period) {
        jdbc.update("""
                INSERT INTO usage_counters (workspace_id, billing_period, metric, count)
                VALUES (:workspaceId, :period, 'post_targets', 1)
                ON CONFLICT (workspace_id, billing_period, metric)
                DO UPDATE SET count = usage_counters.count + 1
                """, params().addValue("workspaceId", workspaceId).addValue("period", period));
    }

    public int usage(UUID workspaceId, String period, String metric) {
        List<Integer> values = jdbc.query("""
                SELECT count FROM usage_counters WHERE workspace_id = :workspaceId AND billing_period = :period AND metric = :metric
                """, params().addValue("workspaceId", workspaceId).addValue("period", period).addValue("metric", metric),
                (rs, row) -> rs.getInt("count"));
        return values.stream().findFirst().orElse(0);
    }

    public void updatePlan(String code, String name, String description, Integer pricePaise, Integer annualPricePaise,
                           boolean includeTax, int displayOrder, String limitsJson, String featuresJson, String upgradeRulesJson,
                           boolean active, String providerPlanId) {
        jdbc.update("""
                UPDATE plans SET name = :name, description = :description, price_paise = :pricePaise, annual_price_paise = :annualPricePaise,
                    prices_include_tax = :includeTax, display_order = :displayOrder, limits_json = :limitsJson, features_json = :featuresJson,
                    upgrade_rules_json = :upgradeRulesJson, active = :active, provider_plan_id = :providerPlanId, updated_at = now()
                WHERE code = :code
                """, params().addValue("code", code).addValue("name", name).addValue("description", description)
                .addValue("pricePaise", pricePaise).addValue("annualPricePaise", annualPricePaise).addValue("includeTax", includeTax)
                .addValue("displayOrder", displayOrder).addValue("limitsJson", limitsJson).addValue("featuresJson", featuresJson)
                .addValue("upgradeRulesJson", upgradeRulesJson).addValue("active", active).addValue("providerPlanId", providerPlanId));
    }

    private PlanRow plan(java.sql.ResultSet rs) throws java.sql.SQLException {
        PlanLimits limits = readLimits(rs.getString("limits_json"));
        return new PlanRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"), rs.getString("description"),
                (Integer) rs.getObject("price_paise"), (Integer) rs.getObject("annual_price_paise"), rs.getBoolean("prices_include_tax"),
                rs.getInt("display_order"), limits, rs.getString("features_json"), rs.getString("upgrade_rules_json"),
                rs.getBoolean("active"), rs.getString("provider_plan_id"), limits.negotiated());
    }

    private SubscriptionRow subscription(java.sql.ResultSet rs) throws java.sql.SQLException {
        String override = rs.getString("limits_override_json");
        return new SubscriptionRow(rs.getObject("id", UUID.class), rs.getObject("workspace_id", UUID.class), rs.getObject("plan_id", UUID.class),
                rs.getString("code"), rs.getString("status"), override == null ? null : readLimits(override),
                rs.getTimestamp("period_start") == null ? null : rs.getTimestamp("period_start").toInstant(),
                rs.getTimestamp("period_end") == null ? null : rs.getTimestamp("period_end").toInstant(),
                rs.getInt("charge_count"), rs.getString("provider_subscription_id"));
    }

    private PlanLimits readLimits(String json) {
        try {
            return mapper.readValue(json, PlanLimits.class);
        } catch (Exception ex) {
            throw new IllegalStateException("Stored plan limits are invalid.");
        }
    }

    private static MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }
}
