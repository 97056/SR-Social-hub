package com.sociallink.service;

import com.sociallink.common.ApiException;
import com.sociallink.common.AuthPrincipal;
import com.sociallink.domain.ApprovalPolicy;
import com.sociallink.domain.EntitlementService;
import com.sociallink.domain.ScheduleTimes;
import com.sociallink.store.BillingStore;
import com.sociallink.store.ContentStore;
import com.sociallink.store.TenantStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PostService {
    private final ContentStore content;
    private final TenantStore tenants;
    private final BillingStore billing;
    private final WorkspaceService workspaces;
    private final ClientService clients;
    private final ApprovalPolicy approvals = new ApprovalPolicy();
    private final EntitlementService entitlements = new EntitlementService();

    public PostService(ContentStore content, TenantStore tenants, BillingStore billing, WorkspaceService workspaces, ClientService clients) {
        this.content = content;
        this.tenants = tenants;
        this.billing = billing;
        this.workspaces = workspaces;
        this.clients = clients;
    }

    @Transactional
    public Map<String, Object> create(AuthPrincipal actor, UUID clientId, String caption, String hashtags, boolean approvalRequired, List<UUID> targets) {
        var role = workspaces.requireRole(actor);
        if (!role.canCreateContent()) {
            throw new ApiException(403, "forbidden", "You cannot create posts.");
        }
        clients.get(actor, clientId);
        UUID id = content.insertPost(clientId, actor.userId(), caption == null ? "" : caption, hashtags, approvalRequired);
        if (targets != null && !targets.isEmpty()) {
            int attached = content.attachTargets(id, targets);
            if (attached != targets.size()) {
                throw new ApiException(400, "invalid_targets", "Every target must be a connected account on this client.");
            }
        }
        return view(actor, id);
    }

    @Transactional
    public Map<String, Object> edit(AuthPrincipal actor, UUID postId, String caption, String hashtags) {
        var role = workspaces.requireRole(actor);
        if (!role.canCreateContent()) {
            throw new ApiException(403, "forbidden", "You cannot edit posts.");
        }
        var post = required(actor, postId);
        var before = new ApprovalPolicy.ContentSnapshot(post.caption(), post.hashtags(), "", targetKey(post.id()));
        var after = new ApprovalPolicy.ContentSnapshot(caption == null ? "" : caption, hashtags, "", targetKey(post.id()));
        if (approvals.materialChangeInvalidates(before, after)) {
            content.invalidateForEdit(post.id(), after.caption(), after.hashtags());
        }
        return view(actor, postId);
    }

    @Transactional
    public Map<String, Object> submit(AuthPrincipal actor, UUID postId) {
        var role = workspaces.requireRole(actor);
        if (!role.canCreateContent()) {
            throw new ApiException(403, "forbidden", "You cannot submit posts.");
        }
        var post = required(actor, postId);
        if (!post.approvalRequired()) {
            throw new ApiException(409, "approval_not_required", "This post does not use the approval workflow.");
        }
        content.submit(post.id(), post.contentVersion(), actor.userId());
        return view(actor, postId);
    }

    @Transactional
    public Map<String, Object> decide(AuthPrincipal actor, UUID postId, boolean approved, String comment) {
        var role = workspaces.requireRole(actor);
        if (!role.canApprove()) {
            throw new ApiException(403, "forbidden", "You cannot review posts.");
        }
        var post = required(actor, postId);
        var requestId = content.pendingRequest(post.id(), post.contentVersion())
                .orElseThrow(() -> new ApiException(409, "nothing_to_review", "There is no pending approval for this version."));
        content.decide(requestId, post.id(), post.contentVersion(), actor.userId(), approved, comment);
        if (approved && post.scheduledAt() != null) {
            if (approvals.onApprove(post.scheduledAt(), Instant.now(), true) == ApprovalPolicy.LateApprovalDecision.BLOCK_RESCHEDULE) {
                content.setSchedule(post.id(), post.scheduledAt(), post.scheduleZone(), "schedule_passed_pending_approval", "approved");
            } else {
                enqueue(actor, post.id(), post.scheduledAt());
            }
        }
        return view(actor, postId);
    }

    @Transactional
    public Map<String, Object> schedule(AuthPrincipal actor, UUID postId, LocalDateTime localTime) {
        var role = workspaces.requireRole(actor);
        if (!role.canPublish()) {
            throw new ApiException(403, "forbidden", "You cannot schedule posts.");
        }
        var post = required(actor, postId);
        var client = tenants.findClient(actor.workspaceId(), post.clientId()).orElseThrow();
        ZoneId zone = ScheduleTimes.zoneOrThrow(client.timezone());
        Instant when = ScheduleTimes.toUtc(localTime, zone);
        if (!when.isAfter(Instant.now())) {
            throw new ApiException(400, "schedule_in_past", "Choose a future time in the client timezone.");
        }
        boolean approved = approvals.mayPublish(post.approvalRequired(), post.approvalStatus(), post.approvedVersion(), post.contentVersion());
        if (post.approvalRequired() && !approved) {
            content.setSchedule(post.id(), when, zone.getId(), null, "awaiting_approval".equals(post.status()) ? "awaiting_approval" : post.status());
            return view(actor, postId);
        }
        content.setSchedule(post.id(), when, zone.getId(), null, "scheduled");
        enqueue(actor, post.id(), when);
        return view(actor, postId);
    }

    public Map<String, Object> view(AuthPrincipal actor, UUID postId) {
        required(actor, postId);
        return body(content.findPost(actor.workspaceId(), postId).orElseThrow());
    }

    public List<Map<String, Object>> list(AuthPrincipal actor) {
        workspaces.requireRole(actor);
        return content.listPosts(actor.workspaceId()).stream().map(this::body).toList();
    }

    private void enqueue(AuthPrincipal actor, UUID postId, Instant when) {
        var limits = workspaces.activeLimits(actor.workspaceId());
        var workspace = tenants.findWorkspace(actor.workspaceId()).orElseThrow();
        ZoneId zone = ScheduleTimes.zoneOrThrow(workspace.timezone());
        var month = YearMonth.from(when.atZone(zone));
        Instant start = month.atDay(1).atStartOfDay(zone).toInstant();
        Instant end = month.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant();
        var targets = content.targetIds(postId);
        if (targets.isEmpty()) {
            throw new ApiException(409, "targets_required", "Choose at least one connected account before scheduling.");
        }
        entitlements.checkCapacity("Post targets", limits.postTargetsPerMonth(), billing.postTargetsInPeriod(actor.workspaceId(), start, end), targets.size());
        content.cancelPending(postId);
        for (UUID targetId : targets) {
            content.enqueue(targetId, when);
        }
        content.refreshPostStatus(postId);
    }

    private ContentStore.PostRow required(AuthPrincipal actor, UUID postId) {
        workspaces.requireRole(actor);
        return content.findPost(actor.workspaceId(), postId).orElseThrow(com.sociallink.domain.TenantGuard.NotFoundException::new);
    }

    private String targetKey(UUID postId) {
        return content.targetIds(postId).stream().map(UUID::toString).sorted().reduce("", (a, b) -> a + "," + b);
    }

    private Map<String, Object> body(ContentStore.PostRow post) {
        java.util.LinkedHashMap<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("id", post.id());
        body.put("clientId", post.clientId());
        body.put("caption", post.caption());
        body.put("hashtags", post.hashtags());
        body.put("status", post.status());
        body.put("approvalRequired", post.approvalRequired());
        body.put("contentVersion", post.contentVersion());
        body.put("approvedVersion", post.approvedVersion());
        body.put("approvalStatus", post.approvalStatus());
        body.put("scheduledAt", post.scheduledAt());
        body.put("scheduleZone", post.scheduleZone());
        body.put("scheduleBlockCode", post.scheduleBlockCode());
        body.put("targets", content.targets(post.id()));
        return body;
    }
}
