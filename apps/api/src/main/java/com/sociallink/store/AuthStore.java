package com.sociallink.store;

import com.sociallink.common.AuthPrincipal;
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
public class AuthStore {
    private final NamedParameterJdbcTemplate jdbc;

    public AuthStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record UserRow(
            UUID id,
            String name,
            String email,
            String passwordHash,
            String status,
            Instant emailVerifiedAt,
            boolean superAdmin,
            boolean mfaEnabled,
            String mfaSecret,
            Long mfaLastStep
    ) {
    }

    public record OutboxMessage(UUID id, String toEmail, String subject, String body, Instant createdAt) {
    }

    public UUID insertUser(String name, String email, String passwordHash) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, name, email, password_hash, status, is_super_admin, created_at, updated_at)
                VALUES (:id, :name, :email, :passwordHash, 'active', FALSE, now(), now())
                """, params().addValue("id", id).addValue("name", name).addValue("email", email).addValue("passwordHash", passwordHash));
        return id;
    }

    public UUID insertSuperAdmin(String name, String email, String passwordHash) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, name, email, password_hash, status, email_verified_at, is_super_admin, created_at, updated_at)
                VALUES (:id, :name, :email, :passwordHash, 'active', now(), TRUE, now(), now())
                """, params().addValue("id", id).addValue("name", name).addValue("email", email).addValue("passwordHash", passwordHash));
        return id;
    }

    public long countSuperAdmins() {
        Long count = jdbc.queryForObject("SELECT count(*) FROM users WHERE is_super_admin = TRUE", params(), Long.class);
        return count == null ? 0 : count;
    }

    public Optional<UserRow> findUserByEmail(String email) {
        return one("""
                SELECT id, name, email, password_hash, status, email_verified_at, is_super_admin, mfa_enabled, mfa_secret_ciphertext, mfa_last_step
                FROM users WHERE email = :email
                """, params().addValue("email", email), this::user);
    }

    public Optional<UserRow> findUserById(UUID id) {
        return one("""
                SELECT id, name, email, password_hash, status, email_verified_at, is_super_admin, mfa_enabled, mfa_secret_ciphertext, mfa_last_step
                FROM users WHERE id = :id
                """, params().addValue("id", id), this::user);
    }

    public void markVerified(UUID userId) {
        jdbc.update("UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = :id", params().addValue("id", userId));
    }

    public void updatePassword(UUID userId, String passwordHash) {
        jdbc.update("UPDATE users SET password_hash = :passwordHash, updated_at = now() WHERE id = :id",
                params().addValue("id", userId).addValue("passwordHash", passwordHash));
    }

    public void saveMfaSecret(UUID userId, String ciphertext) {
        jdbc.update("""
                UPDATE users SET mfa_secret_ciphertext = :secret, mfa_enabled = FALSE, mfa_last_step = NULL, updated_at = now()
                WHERE id = :id AND mfa_enabled = FALSE
                """, params().addValue("id", userId).addValue("secret", ciphertext));
    }

    public void enableMfa(UUID userId, long step) {
        jdbc.update("UPDATE users SET mfa_enabled = TRUE, mfa_last_step = :step, updated_at = now() WHERE id = :id",
                params().addValue("id", userId).addValue("step", step));
    }

    public void updateMfaStep(UUID userId, long step) {
        jdbc.update("UPDATE users SET mfa_last_step = :step, updated_at = now() WHERE id = :id",
                params().addValue("id", userId).addValue("step", step));
    }

    public void insertToken(UUID userId, String purpose, String tokenHash, Instant expiresAt) {
        jdbc.update("""
                UPDATE email_tokens SET used_at = now()
                WHERE user_id = :userId AND purpose = :purpose AND used_at IS NULL
                """, params().addValue("userId", userId).addValue("purpose", purpose));
        jdbc.update("""
                INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, created_at)
                VALUES (:id, :userId, :purpose, :tokenHash, :expiresAt, now())
                """, params().addValue("id", UUID.randomUUID()).addValue("userId", userId).addValue("purpose", purpose)
                .addValue("tokenHash", tokenHash).addValue("expiresAt", java.sql.Timestamp.from(expiresAt)));
    }

    public Optional<UUID> consumeToken(String tokenHash, String purpose) {
        List<UUID> ids = jdbc.query("""
                UPDATE email_tokens SET used_at = now()
                WHERE token_hash = :tokenHash AND purpose = :purpose AND used_at IS NULL AND expires_at > now()
                RETURNING user_id
                """, params().addValue("tokenHash", tokenHash).addValue("purpose", purpose), (rs, row) -> rs.getObject("user_id", UUID.class));
        return ids.stream().findFirst();
    }

    public void insertSession(UUID userId, UUID workspaceId, String tokenHash, Instant expiresAt) {
        jdbc.update("""
                INSERT INTO sessions (id, user_id, workspace_id, token_hash, expires_at, created_at)
                VALUES (:id, :userId, :workspaceId, :tokenHash, :expiresAt, now())
                """, params().addValue("id", UUID.randomUUID()).addValue("userId", userId).addValue("workspaceId", workspaceId)
                .addValue("tokenHash", tokenHash).addValue("expiresAt", java.sql.Timestamp.from(expiresAt)));
    }

    public void bindWorkspace(String tokenHash, UUID workspaceId) {
        jdbc.update("UPDATE sessions SET workspace_id = :workspaceId WHERE token_hash = :tokenHash",
                params().addValue("tokenHash", tokenHash).addValue("workspaceId", workspaceId));
    }

    public Optional<AuthPrincipal> findSession(String tokenHash) {
        return one("""
                SELECT u.id, u.email, u.name, u.is_super_admin, u.mfa_enabled, u.email_verified_at, u.status,
                       s.workspace_id, wm.role, w.status AS workspace_status
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                LEFT JOIN workspaces w ON w.id = s.workspace_id
                LEFT JOIN workspace_members wm ON wm.workspace_id = s.workspace_id AND wm.user_id = s.user_id AND wm.status = 'active'
                WHERE s.token_hash = :tokenHash AND s.expires_at > now() AND u.status = 'active'
                """, params().addValue("tokenHash", tokenHash), (rs, row) -> new AuthPrincipal(
                rs.getObject("id", UUID.class),
                rs.getString("email"),
                rs.getString("name"),
                rs.getBoolean("is_super_admin"),
                rs.getBoolean("mfa_enabled"),
                rs.getTimestamp("email_verified_at") != null,
                rs.getObject("workspace_id", UUID.class),
                rs.getString("role"),
                rs.getString("workspace_status")
        ));
    }

    public void deleteSession(String tokenHash) {
        jdbc.update("DELETE FROM sessions WHERE token_hash = :tokenHash", params().addValue("tokenHash", tokenHash));
    }

    public void deleteSessionsForUser(UUID userId) {
        jdbc.update("DELETE FROM sessions WHERE user_id = :userId", params().addValue("userId", userId));
    }

    public void insertOutbox(String toEmail, String subject, String body) {
        jdbc.update("""
                INSERT INTO email_outbox (id, to_email, subject, body, created_at)
                VALUES (:id, :toEmail, :subject, :body, now())
                """, params().addValue("id", UUID.randomUUID()).addValue("toEmail", toEmail).addValue("subject", subject).addValue("body", body));
    }

    public List<OutboxMessage> listOutbox(String email) {
        return jdbc.query("""
                SELECT id, to_email, subject, body, created_at
                FROM email_outbox WHERE to_email = :email ORDER BY created_at DESC LIMIT 10
                """, params().addValue("email", email), (rs, row) -> new OutboxMessage(
                rs.getObject("id", UUID.class),
                rs.getString("to_email"),
                rs.getString("subject"),
                rs.getString("body"),
                rs.getTimestamp("created_at").toInstant()
        ));
    }

    public String template(String key, String column) {
        return jdbc.queryForObject("SELECT " + column + " FROM email_templates WHERE key = :key", params().addValue("key", key), String.class);
    }

    public String brandName() {
        return jdbc.queryForObject("SELECT brand_name FROM theme_settings WHERE id = 1", params(), String.class);
    }

    public boolean signupEnabled() {
        Boolean enabled = jdbc.queryForObject("SELECT enabled FROM feature_flags WHERE key = 'signup.enabled'", params(), Boolean.class);
        return Boolean.TRUE.equals(enabled);
    }

    private UserRow user(ResultSet rs, int row) throws SQLException {
        return new UserRow(
                rs.getObject("id", UUID.class),
                rs.getString("name"),
                rs.getString("email"),
                rs.getString("password_hash"),
                rs.getString("status"),
                rs.getTimestamp("email_verified_at") == null ? null : rs.getTimestamp("email_verified_at").toInstant(),
                rs.getBoolean("is_super_admin"),
                rs.getBoolean("mfa_enabled"),
                rs.getString("mfa_secret_ciphertext"),
                rs.getObject("mfa_last_step") == null ? null : rs.getLong("mfa_last_step")
        );
    }

    private <T> Optional<T> one(String sql, MapSqlParameterSource params, org.springframework.jdbc.core.RowMapper<T> mapper) {
        List<T> rows = jdbc.query(sql, params, mapper);
        return rows.stream().findFirst();
    }

    private static MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }
}
