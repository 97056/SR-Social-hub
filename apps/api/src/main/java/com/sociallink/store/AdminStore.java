package com.sociallink.store;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminStore {
    private final NamedParameterJdbcTemplate jdbc;

    public AdminStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record ThemeRow(
            String brandName, String logoUrl, String faviconUrl, String primaryColor, String secondaryColor, String accentColor,
            String backgroundColor, String surfaceColor, String textColor, String fontFamily, String fontSizeBase, String radius,
            String buttonStyle, String colorMode
    ) {
    }

    public record IntegrationRow(
            String provider, String displayName, boolean enabled, String clientId, boolean secretSet, String redirectUri,
            String scopes, String apiVersion, String environment, String consoleUrl, String docsUrl, String verificationStatus,
            Instant lastHealthAt, String lastHealthMessage
    ) {
    }

    public record QuoteRow(
            UUID id, String source, String company, String contactName, String email, String phone, Integer clientCount,
            Integer accountCount, Integer monthlyVolume, String platforms, String notes, String status, UUID assignedAdmin, Instant createdAt
    ) {
    }

    public record LegalRow(String slug, String title, String body, String reviewStatus, Instant updatedAt) {
    }

    public ThemeRow theme() {
        return jdbc.queryForObject("""
                SELECT brand_name, logo_url, favicon_url, primary_color, secondary_color, accent_color, background_color,
                       surface_color, text_color, font_family, font_size_base, radius, button_style, color_mode
                FROM theme_settings WHERE id = 1
                """, params(), (rs, row) -> new ThemeRow(
                rs.getString("brand_name"), rs.getString("logo_url"), rs.getString("favicon_url"), rs.getString("primary_color"),
                rs.getString("secondary_color"), rs.getString("accent_color"), rs.getString("background_color"), rs.getString("surface_color"),
                rs.getString("text_color"), rs.getString("font_family"), rs.getString("font_size_base"), rs.getString("radius"),
                rs.getString("button_style"), rs.getString("color_mode")));
    }

    public void saveTheme(ThemeRow theme, UUID actorId) {
        jdbc.update("""
                UPDATE theme_settings SET brand_name = :brandName, logo_url = :logoUrl, favicon_url = :faviconUrl,
                    primary_color = :primaryColor, secondary_color = :secondaryColor, accent_color = :accentColor,
                    background_color = :backgroundColor, surface_color = :surfaceColor, text_color = :textColor,
                    font_family = :fontFamily, font_size_base = :fontSizeBase, radius = :radius, button_style = :buttonStyle,
                    color_mode = :colorMode, updated_by = :actorId, updated_at = now()
                WHERE id = 1
                """, params().addValue("brandName", theme.brandName()).addValue("logoUrl", theme.logoUrl()).addValue("faviconUrl", theme.faviconUrl())
                .addValue("primaryColor", theme.primaryColor()).addValue("secondaryColor", theme.secondaryColor()).addValue("accentColor", theme.accentColor())
                .addValue("backgroundColor", theme.backgroundColor()).addValue("surfaceColor", theme.surfaceColor()).addValue("textColor", theme.textColor())
                .addValue("fontFamily", theme.fontFamily()).addValue("fontSizeBase", theme.fontSizeBase()).addValue("radius", theme.radius())
                .addValue("buttonStyle", theme.buttonStyle()).addValue("colorMode", theme.colorMode()).addValue("actorId", actorId));
    }

    public List<IntegrationRow> integrations() {
        return jdbc.query("""
                SELECT provider, display_name, enabled, client_id, secret_ciphertext, redirect_uri, scopes, api_version,
                       environment, console_url, docs_url, verification_status, last_health_at, last_health_message
                FROM social_integrations ORDER BY provider
                """, params(), (rs, row) -> integration(rs));
    }

    public Optional<IntegrationRow> integration(String provider) {
        return jdbc.query("""
                SELECT provider, display_name, enabled, client_id, secret_ciphertext, redirect_uri, scopes, api_version,
                       environment, console_url, docs_url, verification_status, last_health_at, last_health_message
                FROM social_integrations WHERE provider = :provider
                """, params().addValue("provider", provider), (rs, row) -> integration(rs)).stream().findFirst();
    }

    public void updateIntegration(String provider, boolean enabled, String clientId, String secretCiphertext, boolean replaceSecret,
                                  String redirectUri, String scopes, String apiVersion, String environment, String verificationStatus, UUID actorId) {
        jdbc.update("""
                UPDATE social_integrations
                SET enabled = :enabled, client_id = :clientId,
                    secret_ciphertext = CASE WHEN :replaceSecret THEN :secretCiphertext ELSE secret_ciphertext END,
                    redirect_uri = :redirectUri, scopes = :scopes, api_version = :apiVersion, environment = :environment,
                    verification_status = :verificationStatus, updated_by = :actorId, updated_at = now()
                WHERE provider = :provider
                """, params().addValue("provider", provider).addValue("enabled", enabled).addValue("clientId", clientId)
                .addValue("replaceSecret", replaceSecret).addValue("secretCiphertext", secretCiphertext)
                .addValue("redirectUri", redirectUri).addValue("scopes", scopes).addValue("apiVersion", apiVersion)
                .addValue("environment", environment).addValue("verificationStatus", verificationStatus).addValue("actorId", actorId));
    }

    public void recordHealth(String provider, String message) {
        jdbc.update("""
                UPDATE social_integrations SET last_health_at = now(), last_health_message = :message, updated_at = now()
                WHERE provider = :provider
                """, params().addValue("provider", provider).addValue("message", message));
    }

    public UUID insertQuote(UUID workspaceId, String source, String company, String contactName, String email, String phone,
                            Integer clientCount, Integer accountCount, Integer monthlyVolume, String platforms, String notes, String limitsJson) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO quote_requests (id, workspace_id, source, company, contact_name, email, phone, client_count, account_count,
                    monthly_volume, platforms, notes, requested_limits_json, status, created_at, updated_at)
                VALUES (:id, :workspaceId, :source, :company, :contactName, :email, :phone, :clientCount, :accountCount,
                    :monthlyVolume, :platforms, :notes, :limitsJson, 'new', now(), now())
                """, params().addValue("id", id).addValue("workspaceId", workspaceId).addValue("source", source).addValue("company", company)
                .addValue("contactName", contactName).addValue("email", email).addValue("phone", phone).addValue("clientCount", clientCount)
                .addValue("accountCount", accountCount).addValue("monthlyVolume", monthlyVolume).addValue("platforms", platforms)
                .addValue("notes", notes).addValue("limitsJson", limitsJson));
        return id;
    }

    public List<QuoteRow> quotes() {
        return jdbc.query("""
                SELECT id, source, company, contact_name, email, phone, client_count, account_count, monthly_volume, platforms, notes, status, assigned_admin, created_at
                FROM quote_requests ORDER BY created_at DESC LIMIT 200
                """, params(), (rs, row) -> quote(rs));
    }

    public void updateQuote(UUID id, String status, UUID assignedAdmin) {
        jdbc.update("""
                UPDATE quote_requests SET status = :status, assigned_admin = :assignedAdmin, updated_at = now() WHERE id = :id
                """, params().addValue("id", id).addValue("status", status).addValue("assignedAdmin", assignedAdmin));
    }

    public Optional<LegalRow> legal(String slug) {
        return jdbc.query("""
                SELECT slug, title, body_markdown, review_status, updated_at FROM legal_documents WHERE slug = :slug
                """, params().addValue("slug", slug), (rs, row) -> new LegalRow(
                rs.getString("slug"), rs.getString("title"), rs.getString("body_markdown"), rs.getString("review_status"),
                rs.getTimestamp("updated_at").toInstant())).stream().findFirst();
    }

    public void audit(UUID actorId, UUID workspaceId, String action, String entityType, String entityId, String metadata) {
        jdbc.update("""
                INSERT INTO audit_logs (id, actor_id, workspace_id, action, entity_type, entity_id, metadata_json, created_at)
                VALUES (:id, :actorId, :workspaceId, :action, :entityType, :entityId, :metadata, now())
                """, params().addValue("id", UUID.randomUUID()).addValue("actorId", actorId).addValue("workspaceId", workspaceId)
                .addValue("action", action).addValue("entityType", entityType).addValue("entityId", entityId).addValue("metadata", metadata));
    }

    public List<java.util.Map<String, Object>> recentAudit() {
        return jdbc.query("""
                SELECT id, actor_id, workspace_id, action, entity_type, entity_id, created_at
                FROM audit_logs ORDER BY created_at DESC LIMIT 100
                """, params(), (rs, row) -> {
            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("id", rs.getObject("id", UUID.class));
            item.put("actorId", rs.getObject("actor_id", UUID.class));
            item.put("workspaceId", rs.getObject("workspace_id", UUID.class));
            item.put("action", rs.getString("action"));
            item.put("entityType", rs.getString("entity_type"));
            item.put("entityId", rs.getString("entity_id"));
            item.put("createdAt", rs.getTimestamp("created_at").toInstant().toString());
            return item;
        });
    }

    public boolean mfaRequiredForAdmins() {
        Boolean required = jdbc.queryForObject("SELECT mfa_required_for_admins FROM security_settings WHERE id = 1", params(), Boolean.class);
        return Boolean.TRUE.equals(required);
    }

    public String allowedOrigins() {
        return jdbc.queryForObject("SELECT allowed_origins FROM security_settings WHERE id = 1", params(), String.class);
    }

    public int loginMaxAttempts() {
        Integer value = jdbc.queryForObject("SELECT login_max_attempts FROM security_settings WHERE id = 1", params(), Integer.class);
        return value == null ? 8 : value;
    }

    public int loginWindowMinutes() {
        Integer value = jdbc.queryForObject("SELECT login_window_minutes FROM security_settings WHERE id = 1", params(), Integer.class);
        return value == null ? 15 : value;
    }

    public int publicFormLimit() {
        Integer value = jdbc.queryForObject("SELECT public_form_limit_per_hour FROM security_settings WHERE id = 1", params(), Integer.class);
        return value == null ? 20 : value;
    }

    public int sessionDays() {
        Integer value = jdbc.queryForObject("SELECT session_days FROM security_settings WHERE id = 1", params(), Integer.class);
        return value == null ? 14 : value;
    }

    public boolean maintenanceEnabled() {
        Boolean enabled = jdbc.queryForObject("SELECT enabled FROM feature_flags WHERE key = 'maintenance.banner'", params(), Boolean.class);
        return Boolean.TRUE.equals(enabled);
    }

    public String maintenanceMessage() {
        return jdbc.queryForObject("SELECT config_json FROM feature_flags WHERE key = 'maintenance.banner'", params(), String.class);
    }

    public java.util.Map<String, Object> overview() {
        java.util.Map<String, Object> overview = new java.util.LinkedHashMap<>();
        overview.put("users", count("SELECT count(*) FROM users"));
        overview.put("workspaces", count("SELECT count(*) FROM workspaces"));
        overview.put("activeSubscriptions", count("SELECT count(*) FROM subscriptions WHERE status = 'active'"));
        overview.put("failedJobs", count("SELECT count(*) FROM scheduled_jobs WHERE status IN ('failed', 'needs_reconcile')"));
        overview.put("openQuotes", count("SELECT count(*) FROM quote_requests WHERE status = 'new'"));
        Integer mrr = jdbc.queryForObject("""
                SELECT COALESCE(sum(p.price_paise), 0) FROM subscriptions s
                JOIN plans p ON p.id = s.plan_id WHERE s.status = 'active' AND p.price_paise IS NOT NULL
                """, params(), Integer.class);
        overview.put("mrrPaise", mrr == null ? 0 : mrr);
        return overview;
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, params(), Long.class);
        return value == null ? 0 : value;
    }

    private static IntegrationRow integration(ResultSet rs) throws SQLException {
        String secret = rs.getString("secret_ciphertext");
        return new IntegrationRow(rs.getString("provider"), rs.getString("display_name"), rs.getBoolean("enabled"), rs.getString("client_id"),
                secret != null && !secret.isBlank(), rs.getString("redirect_uri"), rs.getString("scopes"), rs.getString("api_version"),
                rs.getString("environment"), rs.getString("console_url"), rs.getString("docs_url"), rs.getString("verification_status"),
                rs.getTimestamp("last_health_at") == null ? null : rs.getTimestamp("last_health_at").toInstant(), rs.getString("last_health_message"));
    }

    private static QuoteRow quote(ResultSet rs) throws SQLException {
        return new QuoteRow(rs.getObject("id", UUID.class), rs.getString("source"), rs.getString("company"), rs.getString("contact_name"),
                rs.getString("email"), rs.getString("phone"), (Integer) rs.getObject("client_count"), (Integer) rs.getObject("account_count"),
                (Integer) rs.getObject("monthly_volume"), rs.getString("platforms"), rs.getString("notes"), rs.getString("status"),
                rs.getObject("assigned_admin", UUID.class), rs.getTimestamp("created_at").toInstant());
    }

    private static MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }
}
