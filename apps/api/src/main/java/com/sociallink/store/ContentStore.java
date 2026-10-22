package com.sociallink.store;

import com.sociallink.domain.PostRollup;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class ContentStore {
    private final NamedParameterJdbcTemplate jdbc;

    public ContentStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record PostRow(
            UUID id, UUID clientId, UUID workspaceId, String caption, String hashtags, String status, boolean approvalRequired,
            int contentVersion, Integer approvedVersion, Instant scheduledAt, String scheduleZone, String scheduleBlockCode, String approvalStatus
    ) {
    }

    public UUID insertPost(UUID clientId, UUID createdBy, String caption, String hashtags, boolean approvalRequired) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO posts (id, client_id, created_by, caption, hashtags, status, approval_required, content_version, created_at, updated_at)
                VALUES (:id, :clientId, :createdBy, :caption, :hashtags, 'draft', :approvalRequired, 1, now(), now())
                """, params().addValue("id", id).addValue("clientId", clientId).addValue("createdBy", createdBy)
                .addValue("caption", caption).addValue("hashtags", hashtags).addValue("approvalRequired", approvalRequired));
        return id;
    }

    public Optional<PostRow> findPost(UUID workspaceId, UUID postId) {
        return jdbc.query("""
                SELECT p.id, p.client_id, c.workspace_id, p.caption, p.hashtags, p.status, p.approval_required, p.content_version,
                       p.approved_version, p.scheduled_at, p.schedule_zone, p.schedule_block_code,
                       (SELECT status FROM approval_requests ar WHERE ar.post_id = p.id AND ar.content_version = p.content_version
                        ORDER BY requested_at DESC LIMIT 1) AS approval_status
                FROM posts p JOIN clients c ON c.id = p.client_id
                WHERE p.id = :id AND c.workspace_id = :workspaceId
                """, params().addValue("id", postId).addValue("workspaceId", workspaceId), (rs, row) -> new PostRow(
                rs.getObject("id", UUID.class), rs.getObject("client_id", UUID.class), rs.getObject("workspace_id", UUID.class),
                rs.getString("caption"), rs.getString("hashtags"), rs.getString("status"), rs.getBoolean("approval_required"),
                rs.getInt("content_version"), (Integer) rs.getObject("approved_version"),
                rs.getTimestamp("scheduled_at") == null ? null : rs.getTimestamp("scheduled_at").toInstant(),
                rs.getString("schedule_zone"), rs.getString("schedule_block_code"), rs.getString("approval_status")
        )).stream().findFirst();
    }

    public List<PostRow> listPosts(UUID workspaceId) {
        return jdbc.query("""
                SELECT p.id, p.client_id, c.workspace_id, p.caption, p.hashtags, p.status, p.approval_required, p.content_version,
                       p.approved_version, p.scheduled_at, p.schedule_zone, p.schedule_block_code,
                       (SELECT status FROM approval_requests ar WHERE ar.post_id = p.id AND ar.content_version = p.content_version
                        ORDER BY requested_at DESC LIMIT 1) AS approval_status
                FROM posts p JOIN clients c ON c.id = p.client_id
                WHERE c.workspace_id = :workspaceId
                ORDER BY p.updated_at DESC LIMIT 100
                """, params().addValue("workspaceId", workspaceId), (rs, row) -> new PostRow(
                rs.getObject("id", UUID.class), rs.getObject("client_id", UUID.class), rs.getObject("workspace_id", UUID.class),
                rs.getString("caption"), rs.getString("hashtags"), rs.getString("status"), rs.getBoolean("approval_required"),
                rs.getInt("content_version"), (Integer) rs.getObject("approved_version"),
                rs.getTimestamp("scheduled_at") == null ? null : rs.getTimestamp("scheduled_at").toInstant(),
                rs.getString("schedule_zone"), rs.getString("schedule_block_code"), rs.getString("approval_status")
        ));
    }

    public void invalidateForEdit(UUID postId, String caption, String hashtags) {
        jdbc.update("""
                UPDATE approval_requests SET status = 'invalidated', resolved_at = now()
                WHERE post_id = :postId AND status IN ('pending', 'approved')
                """, params().addValue("postId", postId));
        jdbc.update("""
                UPDATE scheduled_jobs SET status = 'cancelled', updated_at = now()
                WHERE status IN ('pending', 'locked') AND post_target_id IN (SELECT id FROM post_targets WHERE post_id = :postId)
                """, params().addValue("postId", postId));
        jdbc.update("""
                UPDATE posts SET caption = :caption, hashtags = :hashtags, content_version = content_version + 1,
                    approved_version = NULL, status = 'draft', schedule_block_code = NULL, updated_at = now()
                WHERE id = :postId
                """, params().addValue("postId", postId).addValue("caption", caption).addValue("hashtags", hashtags));
    }

    public UUID submit(UUID postId, int version, UUID userId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO approval_requests (id, post_id, content_version, requested_by, status, requested_at)
                VALUES (:id, :postId, :version, :userId, 'pending', now())
                """, params().addValue("id", id).addValue("postId", postId).addValue("version", version).addValue("userId", userId));
        jdbc.update("""
                INSERT INTO approval_actions (id, approval_request_id, actor_id, action, created_at)
                VALUES (:id, :requestId, :userId, 'submitted', now())
                """, params().addValue("id", UUID.randomUUID()).addValue("requestId", id).addValue("userId", userId));
        jdbc.update("UPDATE posts SET status = 'awaiting_approval', updated_at = now() WHERE id = :postId", params().addValue("postId", postId));
        jdbc.update("UPDATE post_targets SET status = 'awaiting_approval', updated_at = now() WHERE post_id = :postId", params().addValue("postId", postId));
        return id;
    }

    public Optional<UUID> pendingRequest(UUID postId, int version) {
        return jdbc.query("""
                SELECT id FROM approval_requests
                WHERE post_id = :postId AND content_version = :version AND status = 'pending'
                ORDER BY requested_at DESC LIMIT 1
                """, params().addValue("postId", postId).addValue("version", version), (rs, row) -> rs.getObject("id", UUID.class)).stream().findFirst();
    }

    public void decide(UUID requestId, UUID postId, int version, UUID actorId, boolean approved, String comment) {
        jdbc.update("""
                UPDATE approval_requests SET status = :status, resolved_at = now() WHERE id = :id
                """, params().addValue("id", requestId).addValue("status", approved ? "approved" : "rejected"));
        jdbc.update("""
                INSERT INTO approval_actions (id, approval_request_id, actor_id, action, comment, created_at)
                VALUES (:id, :requestId, :actorId, :action, :comment, now())
                """, params().addValue("id", UUID.randomUUID()).addValue("requestId", requestId).addValue("actorId", actorId)
                .addValue("action", approved ? "approved" : "rejected").addValue("comment", comment));
        if (approved) {
            jdbc.update("UPDATE posts SET approved_version = :version, status = 'approved', updated_at = now() WHERE id = :postId",
                    params().addValue("postId", postId).addValue("version", version));
        } else {
            jdbc.update("UPDATE posts SET status = 'draft', updated_at = now() WHERE id = :postId", params().addValue("postId", postId));
        }
    }

    public void setSchedule(UUID postId, Instant scheduledAt, String zone, String blockCode, String status) {
        jdbc.update("""
                UPDATE posts SET scheduled_at = :scheduledAt, schedule_zone = :zone, schedule_block_code = :blockCode, status = :status, updated_at = now()
                WHERE id = :postId
                """, params().addValue("postId", postId)
                .addValue("scheduledAt", scheduledAt == null ? null : java.sql.Timestamp.from(scheduledAt))
                .addValue("zone", zone).addValue("blockCode", blockCode).addValue("status", status));
    }

    public List<UUID> targetIds(UUID postId) {
        return jdbc.query("SELECT id FROM post_targets WHERE post_id = :postId", params().addValue("postId", postId),
                (rs, row) -> rs.getObject("id", UUID.class));
    }

    public int attachTargets(UUID postId, List<UUID> accountIds) {
        jdbc.update("DELETE FROM post_targets WHERE post_id = :postId", params().addValue("postId", postId));
        int attached = 0;
        for (UUID accountId : accountIds) {
            List<UUID> valid = jdbc.query("""
                    SELECT a.id FROM social_accounts a
                    JOIN posts p ON p.client_id = a.client_id
                    WHERE p.id = :postId AND a.id = :accountId AND a.status = 'connected'
                    """, params().addValue("postId", postId).addValue("accountId", accountId), (rs, row) -> rs.getObject("id", UUID.class));
            if (valid.isEmpty()) {
                continue;
            }
            jdbc.update("""
                    INSERT INTO post_targets (id, post_id, social_account_id, status, created_at, updated_at)
                    VALUES (:id, :postId, :accountId, 'draft', now(), now())
                    """, params().addValue("id", UUID.randomUUID()).addValue("postId", postId).addValue("accountId", accountId));
            attached++;
        }
        return attached;
    }

    public void cancelPending(UUID postId) {
        jdbc.update("""
                UPDATE scheduled_jobs SET status = 'cancelled', updated_at = now()
                WHERE status = 'pending' AND post_target_id IN (SELECT id FROM post_targets WHERE post_id = :postId)
                """, params().addValue("postId", postId));
    }

    public void enqueue(UUID targetId, Instant runAt) {
        jdbc.update("""
                INSERT INTO scheduled_jobs (id, post_target_id, run_at, status, attempt_count, created_at, updated_at)
                VALUES (:id, :targetId, :runAt, 'pending', 0, now(), now())
                """, params().addValue("id", UUID.randomUUID()).addValue("targetId", targetId).addValue("runAt", java.sql.Timestamp.from(runAt)));
        jdbc.update("UPDATE post_targets SET status = 'scheduled', updated_at = now() WHERE id = :targetId", params().addValue("targetId", targetId));
    }

    public void refreshPostStatus(UUID postId) {
        List<String> statuses = jdbc.query("SELECT status FROM post_targets WHERE post_id = :postId", params().addValue("postId", postId),
                (rs, row) -> rs.getString("status"));
        if (statuses.isEmpty()) {
            return;
        }
        jdbc.update("UPDATE posts SET status = :status, updated_at = now() WHERE id = :postId",
                params().addValue("postId", postId).addValue("status", PostRollup.summarize(statuses)));
    }

    public List<java.util.Map<String, Object>> targets(UUID postId) {
        return jdbc.query("""
                SELECT t.id, t.status, t.external_post_id, t.sandbox, t.last_error_code, t.last_error_message, t.published_at, a.platform, a.display_name
                FROM post_targets t JOIN social_accounts a ON a.id = t.social_account_id
                WHERE t.post_id = :postId ORDER BY a.platform
                """, params().addValue("postId", postId), (rs, row) -> {
            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("id", rs.getObject("id", UUID.class));
            item.put("status", rs.getString("status"));
            item.put("externalPostId", rs.getString("external_post_id"));
            item.put("sandbox", rs.getBoolean("sandbox"));
            item.put("errorCode", rs.getString("last_error_code"));
            item.put("errorMessage", rs.getString("last_error_message"));
            item.put("publishedAt", rs.getTimestamp("published_at") == null ? null : rs.getTimestamp("published_at").toInstant().toString());
            item.put("platform", rs.getString("platform"));
            item.put("accountName", rs.getString("display_name"));
            return item;
        });
    }

    private static MapSqlParameterSource params() {
        return new MapSqlParameterSource();
    }
}
