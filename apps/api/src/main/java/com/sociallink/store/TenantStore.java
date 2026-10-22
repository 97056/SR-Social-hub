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
public class TenantStore {
    private final NamedParameterJdbcTemplate jdbc;

    public TenantStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record WorkspaceRow(UUID id, UUID ownerUserId, String name, String workspaceType, String timezone, String status, String suspendedReason) {
    }

    public record Membership(UUID workspaceId, String workspaceName, String workspaceType, String timezone, String role, String status) {
    }

    public record ClientRow(UUID id, UUID workspaceId, String name, String timezone, String notes, String status) {
    }

    public UUID insertWorkspace(UUID ownerUserId, String name, String workspaceType, String timezone) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO workspaces (id, owner_user_id, name, workspace_type, timezone, status, created_at, updated_at)
                VALUES (:id, :owner, :name, :type, :timezone, 'active', now(), now())
                """, params().addValue("id", id).addValue("owner", ownerUserId).addValue("name", name)
                .addValue("type", workspaceType).addValue("timezone", timezone));
        jdbc.update("""
                INSERT INTO workspace_members (id, workspace_id, user_id, role, status, created_at)
                VALUES (:id, :workspaceId, :userId, 'owner', 'active', now())
                """, params().addValue("id", UUID.randomUUID()).addValue("workspaceId", id).addValue("userId", ownerUserId));
        return id;
    }

    public List<Membership> memberships(UUID userId) {
        return jdbc.query("""
                SELECT w.id, w.name, w.workspace_type, w.timezone, wm.role, w.status
                FROM workspace_members wm
                JOIN workspaces w ON w.id = wm.workspace_id
                WHERE wm.user_id = :userId AND wm.status = 'active'
                ORDER BY w.created_at
                """, params().addValue("userId", userId), (rs, row) -> new Membership(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("workspace_type"),
                rs.getString("timezone"), rs.getString("role"), rs.getString("status")));
    }

    public Optional<WorkspaceRow> findWorkspace(UUID id) {
        List<WorkspaceRow> rows = jdbc.query("""
                SELECT id, owner_user_id, name, workspace_type, timezone, status, suspended_reason
                FROM workspaces WHERE id = :id
                """, params().addValue("id", id), (rs, row) -> workspace(rs));
        return rows.stream().findFirst();
    }

    public Optional<String> memberRole(UUID workspaceId, UUID userId) {
        List<String> roles = jdbc.query("""
                SELECT role FROM workspace_members
                WHERE workspace_id = :workspaceId AND user_id = :userId AND status = 'active'
                """, params().addValue("workspaceId", workspaceId).addValue("userId", userId), (rs, row) -> rs.getString("role"));
        return roles.stream().findFirst();
    }

    public long countMembers(UUID workspaceId) {
        Long count = jdbc.queryForObject("""
                SELECT count(*) FROM workspace_members WHERE workspace_id = :workspaceId AND status <> 'removed'
                """, params().addValue("workspaceId", workspaceId), Long.class);
        return count == null ? 0 : count;
    }

    public void addMember(UUID workspaceId, UUID userId, String role) {
        jdbc.update("""
                INSERT INTO workspace_members (id, workspace_id, user_id, role, status, created_at)
                VALUES (:id, :workspaceId, :userId, :role, 'active', now())
                ON CONFLICT (workspace_id, user_id)
                DO UPDATE SET role = EXCLUDED.role, status = 'active'
                """, params().addValue("id", UUID.randomUUID()).addValue("workspaceId", workspaceId)
                .addValue("userId", userId).addValue("role", role));
    }

    public UUID insertClient(UUID workspaceId, String name, String timezone, String notes) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO clients (id, workspace_id, name, timezone, notes, status, created_at, updated_at)
                VALUES (:id, :workspaceId, :name, :timezone, :notes, 'active', now(), now())
                """, params().addValue("id", id).addValue("workspaceId", workspaceId).addValue("name", name)
                .addValue("timezone", timezone).addValue("notes", notes));
        return id;
    }

    public long countClients(UUID workspaceId) {
        Long count = jdbc.queryForObject("""
                SELECT count(*) FROM clients WHERE workspace_id = :workspaceId AND status = 'active'
                """, params().addValue("workspaceId", workspaceId), Long.class);
        return count == null ? 0 : count;
    }

    public List<ClientRow> listClients(UUID workspaceId, UUID userId, boolean all) {
        String sql = all
                ? """
                SELECT id, workspace_id, name, timezone, notes, status FROM clients
                WHERE workspace_id = :workspaceId AND status = 'active' ORDER BY created_at
                """
                : """
                SELECT c.id, c.workspace_id, c.name, c.timezone, c.notes, c.status
                FROM clients c
                JOIN client_members cm ON cm.client_id = c.id AND cm.user_id = :userId
                WHERE c.workspace_id = :workspaceId AND c.status = 'active' ORDER BY c.created_at
                """;
        return jdbc.query(sql, params().addValue("workspaceId", workspaceId).addValue("userId", userId), (rs, row) -> client(rs));
    }

    public Optional<ClientRow> findClient(UUID workspaceId, UUID clientId) {
        List<ClientRow> rows = jdbc.query("""
                SELECT id, workspace_id, name, timezone, notes, status FROM clients
                WHERE id = :id AND workspace_id = :workspaceId
                """, params().addValue("id", clientId).addValue("workspaceId", workspaceId), (rs, row) -> client(rs));
        return rows.stream().findFirst();
    }

    public void assignClientMember(UUID clientId, UUID userId, String role) {
        jdbc.update("""
                INSERT INTO client_members (id, client_id, user_id, role)
                VALUES (:id, :clientId, :userId, :role)
                ON CONFLICT (client_id, user_id) DO UPDATE SET role = EXCLUDED.role
                """, params().addValue("id", UUID.randomUUID()).addValue("clientId", clientId).addValue("userId", userId).addValue("role", role));
    }

    public long countAccounts(UUID workspaceId) {
        Long count = jdbc.queryForObject("""
                SELECT count(*) FROM social_accounts a
                JOIN clients c ON c.id = a.client_id
                WHERE c.workspace_id = :workspaceId AND a.status <> 'disconnected'
                """, params().addValue("workspaceId", workspaceId), Long.class);
        return count == null ? 0 : count;
    }

    public void suspend(UUID workspaceId, String reason) {
        jdbc.update("""
                UPDATE workspaces SET status = 'suspended', suspended_reason = :reason, updated_at = now() WHERE id = :id
                """, params().addValue("id", workspaceId).addValue("reason", reason));
    }

    public void reinstate(UUID workspaceId) {
        jdbc.update("UPDATE workspaces SET status = 'active', suspended_reason = NULL, updated_at = now() WHERE id = :id",
                params().addValue("id", workspaceId));
    }

    public List<WorkspaceRow> searchWorkspaces(String query) {
        return jdbc.query("""
                SELECT id, owner_user_id, name, workspace_type, timezone, status, suspended_reason
                FROM workspaces
                WHERE cast(id AS text) = :exact OR name ILIKE :like
                ORDER BY created_at DESC LIMIT 50
                """, params().addValue("exact", query).addValue("like", "%" + query + "%"), (rs, row) -> workspace(rs));
    }

    private static WorkspaceRow workspace(ResultSet rs) throws SQLException {
        return new WorkspaceRow(rs.getObject("id", UUID.class), rs.getObject("owner_user_id", UUID.class), rs.getString("name"),
                rs.getString("workspace_type"), rs.getString("timezone"), rs.getString("status"), rs.getString("suspended_reason"));
    }

    private static ClientRow client(ResultSet rs) throws SQLException {
        return new ClientRow(rs.getObject("id", UUID.class), rs.getObject("workspace_id", UUID.class), rs.getString("name"),
                rs.getString("timezone"), rs.getString("notes"), rs.getString("status"));
    }

    private static MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }

    public Instant now() {
        return Instant.now();
    }
}
