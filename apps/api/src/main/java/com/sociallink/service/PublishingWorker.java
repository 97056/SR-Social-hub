package com.sociallink.service;

import com.sociallink.config.AppProperties;
import com.sociallink.domain.PostRollup;
import com.sociallink.domain.PublishAdapters;
import com.sociallink.domain.PublishPolicy;
import com.sociallink.domain.ScheduleTimes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class PublishingWorker {
    private static final Logger log = LoggerFactory.getLogger(PublishingWorker.class);
    private final NamedParameterJdbcTemplate jdbc;
    private final AppProperties properties;
    private final PublishPolicy policy = new PublishPolicy();

    public PublishingWorker(NamedParameterJdbcTemplate jdbc, AppProperties properties) {
        this.jdbc = jdbc;
        this.properties = properties;
    }

    @Scheduled(fixedDelay = 15000)
    public void scheduledTick() {
        if (!properties.getWorker().isEnabled()) {
            return;
        }
        tick(Instant.now());
    }

    public int tick(Instant now) {
        recover(now);
        List<UUID> jobIds = claim(now);
        for (UUID jobId : jobIds) {
            var job = load(jobId);
            if (job == null) {
                continue;
            }
            var decision = policy.beforeCall(job.view());
            if (decision instanceof PublishPolicy.Decision.Publish) {
                var result = PublishAdapters.dispatch(job.view().platform(), job.view().targetId(), properties.getPublishing().isSandbox());
                decision = policy.afterResult(result, job.view().attempt(), now, ThreadLocalRandom.current().nextLong(30_000));
            }
            apply(job, (PublishPolicy.Decision.Update) decision, now);
        }
        return jobIds.size();
    }

    private void recover(Instant now) {
        MapSqlParameterSource params = new MapSqlParameterSource("now", Timestamp.from(now));
        jdbc.update("""
                UPDATE post_targets t
                SET status = 'needs_reconcile', last_error_code = 'lock_expired',
                    last_error_message = 'The worker stopped while publishing. Reconcile this target before retrying.',
                    updated_at = now()
                WHERE t.status = 'publishing' AND EXISTS (
                    SELECT 1 FROM scheduled_jobs j
                    WHERE j.post_target_id = t.id AND j.status = 'locked' AND j.locked_until < :now
                )
                """, params);
        jdbc.update("""
                UPDATE scheduled_jobs SET status = 'needs_reconcile', last_error_code = 'lock_expired', updated_at = now()
                WHERE status = 'locked' AND locked_until < :now
                """, params);
    }

    private List<UUID> claim(Instant now) {
        var params = new MapSqlParameterSource()
                .addValue("now", Timestamp.from(now))
                .addValue("until", Timestamp.from(now.plusSeconds(120)))
                .addValue("limit", 20);
        List<UUID> ids = jdbc.query("""
                WITH due AS (
                    SELECT id FROM scheduled_jobs
                    WHERE status = 'pending' AND run_at <= :now
                    ORDER BY run_at
                    FOR UPDATE SKIP LOCKED
                    LIMIT :limit
                )
                UPDATE scheduled_jobs j
                SET status = 'locked', locked_until = :until, attempt_count = attempt_count + 1, updated_at = now()
                FROM due WHERE j.id = due.id
                RETURNING j.id
                """, params, (rs, row) -> rs.getObject("id", UUID.class));
        if (!ids.isEmpty()) {
            jdbc.update("UPDATE post_targets SET status = 'publishing', updated_at = now() WHERE id IN (SELECT post_target_id FROM scheduled_jobs WHERE id IN (:ids))",
                    new MapSqlParameterSource("ids", ids));
        }
        return ids;
    }

    private Claim load(UUID jobId) {
        List<Claim> rows = jdbc.query("""
                SELECT j.id AS job_id, t.id AS target_id, p.id AS post_id, j.attempt_count, t.external_post_id,
                       p.approval_required, p.approved_version, p.content_version, a.platform, c.workspace_id, w.timezone,
                       (SELECT status FROM approval_requests ar WHERE ar.post_id = p.id AND ar.content_version = p.content_version
                        ORDER BY requested_at DESC LIMIT 1) AS approval_status,
                       EXISTS (
                         SELECT 1 FROM subscriptions s
                         WHERE s.workspace_id = c.workspace_id AND s.status = 'active'
                           AND (s.period_end IS NULL OR s.period_end > now())
                       ) AS subscription_active
                FROM scheduled_jobs j
                JOIN post_targets t ON t.id = j.post_target_id
                JOIN posts p ON p.id = t.post_id
                JOIN social_accounts a ON a.id = t.social_account_id
                JOIN clients c ON c.id = p.client_id
                JOIN workspaces w ON w.id = c.workspace_id
                WHERE j.id = :id
                """, new MapSqlParameterSource("id", jobId), (rs, row) -> new Claim(
                new PublishPolicy.JobView(
                        rs.getObject("job_id", UUID.class),
                        rs.getObject("target_id", UUID.class),
                        rs.getInt("attempt_count"),
                        rs.getString("external_post_id"),
                        rs.getBoolean("approval_required"),
                        rs.getString("approval_status"),
                        (Integer) rs.getObject("approved_version"),
                        rs.getInt("content_version"),
                        rs.getString("platform"),
                        rs.getBoolean("subscription_active")
                ),
                rs.getObject("post_id", UUID.class),
                rs.getObject("workspace_id", UUID.class),
                rs.getString("timezone")
        ));
        return rows.stream().findFirst().orElse(null);
    }

    private void apply(Claim claim, PublishPolicy.Decision.Update update, Instant now) {
        jdbc.update("""
                UPDATE scheduled_jobs
                SET status = :jobStatus, run_at = COALESCE(:nextRun, run_at), last_error_code = :errorCode, locked_until = NULL, updated_at = now()
                WHERE id = :id
                """, new MapSqlParameterSource()
                .addValue("jobStatus", update.jobStatus())
                .addValue("nextRun", update.nextRun() == null ? null : Timestamp.from(update.nextRun()))
                .addValue("errorCode", update.errorCode())
                .addValue("id", claim.view().jobId()));
        jdbc.update("""
                UPDATE post_targets
                SET status = :targetStatus, external_post_id = COALESCE(:externalId, external_post_id), sandbox = :sandbox,
                    last_error_code = :errorCode, last_error_message = :message,
                    published_at = CASE WHEN :targetStatus IN ('published', 'sandbox_published') THEN :now ELSE published_at END,
                    updated_at = now()
                WHERE id = :targetId
                """, new MapSqlParameterSource()
                .addValue("targetStatus", update.targetStatus())
                .addValue("externalId", update.externalId())
                .addValue("sandbox", update.sandbox())
                .addValue("errorCode", update.errorCode())
                .addValue("message", update.safeMessage())
                .addValue("now", Timestamp.from(now))
                .addValue("targetId", claim.view().targetId()));
        jdbc.update("""
                INSERT INTO publish_attempts (id, post_target_id, attempted_at, outcome, error_code, safe_error_message, sandbox)
                VALUES (:id, :targetId, :now, :outcome, :errorCode, :message, :sandbox)
                """, new MapSqlParameterSource()
                .addValue("id", UUID.randomUUID())
                .addValue("targetId", claim.view().targetId())
                .addValue("now", Timestamp.from(now))
                .addValue("outcome", update.jobStatus())
                .addValue("errorCode", update.errorCode())
                .addValue("message", update.safeMessage())
                .addValue("sandbox", update.sandbox()));
        if (update.countUsage()) {
            String period = ScheduleTimes.billingPeriod(now, ZoneId.of(claim.timezone()));
            jdbc.update("""
                    INSERT INTO usage_counters (workspace_id, billing_period, metric, count)
                    VALUES (:workspaceId, :period, 'post_targets', 1)
                    ON CONFLICT (workspace_id, billing_period, metric)
                    DO UPDATE SET count = usage_counters.count + 1
                    """, new MapSqlParameterSource().addValue("workspaceId", claim.workspaceId()).addValue("period", period));
        }
        List<String> statuses = jdbc.query("SELECT status FROM post_targets WHERE post_id = :postId",
                new MapSqlParameterSource("postId", claim.postId()), (rs, row) -> rs.getString("status"));
        jdbc.update("UPDATE posts SET status = :status, updated_at = now() WHERE id = :postId",
                new MapSqlParameterSource().addValue("status", PostRollup.summarize(statuses)).addValue("postId", claim.postId()));
        log.info("publish job={} target={} status={}", claim.view().jobId(), claim.view().targetId(), update.targetStatus());
    }

    private record Claim(PublishPolicy.JobView view, UUID postId, UUID workspaceId, String timezone) {
    }
}
