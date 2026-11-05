import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PublishingJobStatus, SocialPlatformCode } from "@prisma/client";
import { createHash } from "crypto";
import { hostname } from "os";
import type { AuthUser } from "../auth/jwt.strategy";
import { ApprovalsService } from "../approvals/approvals.service";
import { EntitlementsService } from "../billing/entitlements.service";
import { decryptSecret } from "../common/crypto.util";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { createPublisherRegistry } from "./publishers/publisher.registry";

@Injectable()
export class PublishingService {
  private readonly publishers = createPublisherRegistry();
  private readonly workerId = `sr-worker-${hostname()}-${process.pid}`;

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  async enqueuePost(
    postId: string,
    user: AuthUser | null,
    opts?: { immediate?: boolean },
  ) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        targets: true,
        variants: true,
        mediaAsset: true,
      },
    });
    if (!post) throw new NotFoundException("Post not found");
    if (user) await this.assertCompanyAccess(post.companyId, user);
    await this.entitlements.assertCanPublish(post.companyId);

    const verification = await this.approvals.verifyApprovalsValid(postId);
    if (!verification.ok) {
      throw new BadRequestException(`Approvals invalid: ${verification.reason}`);
    }

    if (!["APPROVED", "SCHEDULED", "PUBLISHING", "FAILED"].includes(post.status)) {
      throw new BadRequestException(`Post status ${post.status} cannot be published`);
    }

    const jobs = [];
    for (const target of post.targets) {
      let socialAccountId = target.socialAccountId;
      if (!socialAccountId) {
        const connected = await this.prisma.socialAccount.findFirst({
          where: {
            clientId: post.clientId,
            companyId: post.companyId,
            platformCode: target.platformCode,
            status: "CONNECTED",
          },
          orderBy: { updatedAt: "desc" },
        });
        if (connected) {
          socialAccountId = connected.id;
          await this.prisma.postTarget.update({
            where: { id: target.id },
            data: { socialAccountId: connected.id },
          });
        }
      }

      if (!socialAccountId) {
        const assistedKey = this.idempotencyKey(post.id, post.revision, target.platformCode, "none");
        const existing = await this.prisma.publishingJob.findUnique({
          where: { idempotencyKey: assistedKey },
        });
        if (existing) {
          jobs.push(existing);
          continue;
        }
        const job = await this.prisma.publishingJob.create({
          data: {
            companyId: post.companyId,
            clientId: post.clientId,
            postId: post.id,
            postTargetId: target.id,
            platformCode: target.platformCode,
            contentRevision: post.revision,
            approvalVerifiedAt: new Date(),
            scheduledAt: opts?.immediate ? new Date() : target.scheduledAt ?? post.scheduledAt ?? new Date(),
            status: "ASSISTED_REQUIRED",
            idempotencyKey: assistedKey,
            lastError: "No social account selected for target",
            attemptCount: 0,
          },
        });
        await this.addEvent(job.id, "ASSISTED_REQUIRED", "Missing social account");
        jobs.push(job);
        continue;
      }

      const key = this.idempotencyKey(
        post.id,
        post.revision,
        target.platformCode,
        socialAccountId,
      );
      const existing = await this.prisma.publishingJob.findUnique({ where: { idempotencyKey: key } });
      if (existing && !["CANCELLED", "FAILED"].includes(existing.status)) {
        jobs.push(existing);
        continue;
      }

      const scheduledAt = opts?.immediate
        ? new Date()
        : target.scheduledAt ?? post.scheduledAt ?? new Date();
      const status: PublishingJobStatus =
        scheduledAt.getTime() > Date.now() + 5_000 ? "SCHEDULED" : "QUEUED";

      const job = existing
        ? await this.prisma.publishingJob.update({
            where: { id: existing.id },
            data: {
              status,
              scheduledAt,
              socialAccountId,
              nextAttemptAt: status === "QUEUED" ? new Date() : scheduledAt,
              approvalVerifiedAt: new Date(),
              contentRevision: post.revision,
              lastError: null,
              attemptCount: 0,
              lockedAt: null,
              lockedBy: null,
            },
          })
        : await this.prisma.publishingJob.create({
            data: {
              companyId: post.companyId,
              clientId: post.clientId,
              postId: post.id,
              postTargetId: target.id,
              socialAccountId,
              platformCode: target.platformCode,
              contentRevision: post.revision,
              approvalVerifiedAt: new Date(),
              scheduledAt,
              nextAttemptAt: status === "QUEUED" ? new Date() : scheduledAt,
              status,
              idempotencyKey: key,
            },
          });

      await this.addEvent(job.id, "ENQUEUED", `Job ${status}`, {
        immediate: Boolean(opts?.immediate),
        actorId: user?.id,
      });
      jobs.push(job);
    }

    if (opts?.immediate || !post.scheduledAt || post.scheduledAt.getTime() <= Date.now()) {
      await this.prisma.contentPost.update({
        where: { id: postId },
        data: { status: "PUBLISHING" },
      });
    } else {
      await this.prisma.contentPost.update({
        where: { id: postId },
        data: { status: "SCHEDULED" },
      });
    }

    return jobs;
  }

  async listJobs(companyId: string, user: AuthUser) {
    await this.assertCompanyAccess(companyId, user);
    return this.prisma.publishingJob.findMany({
      where: { companyId },
      include: {
        post: { select: { id: true, baseCaption: true, status: true, revision: true } },
        socialAccount: {
          select: { id: true, accountName: true, username: true, connectionMode: true },
        },
        events: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async retryJob(jobId: string, user: AuthUser) {
    const job = await this.prisma.publishingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Job not found");
    await this.assertCompanyAccess(job.companyId, user);
    if (!["FAILED", "RETRY_PENDING", "CANCELLED", "REQUIRES_REAUTH"].includes(job.status)) {
      throw new BadRequestException(`Cannot retry job in status ${job.status}`);
    }
    const updated = await this.prisma.publishingJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        nextAttemptAt: new Date(),
        scheduledAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
    await this.addEvent(jobId, "RETRY_REQUESTED", "Manual retry", { actorId: user.id });
    return updated;
  }

  async cancelJob(jobId: string, user: AuthUser) {
    const job = await this.prisma.publishingJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("Job not found");
    await this.assertCompanyAccess(job.companyId, user);
    if (["PUBLISHED", "PUBLISHING"].includes(job.status)) {
      throw new BadRequestException("Cannot cancel a publishing/published job safely");
    }
    const updated = await this.prisma.publishingJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", lockedAt: null, lockedBy: null },
    });
    await this.addEvent(jobId, "CANCELLED", "Cancelled by user", { actorId: user.id });
    return updated;
  }

  /** Called by interval worker. */
  async processDueJobs(limit = 10) {
    const now = new Date();
    const due = await this.prisma.publishingJob.findMany({
      where: {
        status: { in: ["QUEUED", "SCHEDULED", "RETRY_PENDING"] },
        OR: [
          { nextAttemptAt: null, scheduledAt: { lte: now } },
          { nextAttemptAt: { lte: now } },
          { scheduledAt: { lte: now }, status: "SCHEDULED" },
        ],
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    const results = [];
    for (const job of due) {
      results.push(await this.processJob(job.id));
    }
    return results;
  }

  async processJob(jobId: string) {
    const locked = await this.prisma.publishingJob.updateMany({
      where: {
        id: jobId,
        status: { in: ["QUEUED", "SCHEDULED", "RETRY_PENDING"] },
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } }],
      },
      data: {
        status: "PUBLISHING",
        lockedAt: new Date(),
        lockedBy: this.workerId,
        attemptCount: { increment: 1 },
      },
    });
    if (!locked.count) return { jobId, skipped: true };

    const job = await this.prisma.publishingJob.findUnique({
      where: { id: jobId },
      include: {
        post: {
          include: {
            variants: true,
            mediaAsset: true,
            targets: true,
          },
        },
        socialAccount: { include: { token: true } },
      },
    });
    if (!job) return { jobId, skipped: true };

    try {
      const verification = await this.approvals.verifyApprovalsValid(job.postId);
      if (!verification.ok || job.contentRevision !== job.post.revision) {
        await this.failJob(job.id, "FAILED", `Approval/revision check failed: ${verification.reason ?? "STALE_REVISION"}`, false);
        return { jobId, status: "FAILED" };
      }

      if (!job.socialAccount || job.socialAccount.status !== "CONNECTED" || !job.socialAccount.token) {
        await this.failJob(job.id, "REQUIRES_REAUTH", "Social account missing or disconnected", false);
        return { jobId, status: "REQUIRES_REAUTH" };
      }

      if (
        job.socialAccount.tokenExpiresAt &&
        job.socialAccount.tokenExpiresAt.getTime() < Date.now()
      ) {
        await this.failJob(job.id, "REQUIRES_REAUTH", "Social token expired", false);
        return { jobId, status: "REQUIRES_REAUTH" };
      }

      const publisher = this.publishers.get(job.platformCode);
      if (!publisher) {
        await this.failJob(job.id, "ASSISTED_REQUIRED", "No publisher registered", false);
        return { jobId, status: "ASSISTED_REQUIRED" };
      }

      const variant = job.post.variants.find((v) => v.platformCode === job.platformCode);
      const accessToken = decryptSecret(job.socialAccount.token.accessTokenEncrypted);

      await this.addEvent(job.id, "PUBLISH_ATTEMPT", `Attempt ${job.attemptCount}`);

      const result = await publisher.publish({
        platformCode: job.platformCode,
        accessToken,
        externalAccountId: job.socialAccount.externalAccountId,
        connectionMode: job.socialAccount.connectionMode,
        caption: variant?.caption || job.post.baseCaption,
        title: variant?.title,
        description: variant?.description,
        hashtags: variant?.hashtags || job.post.baseHashtags,
        linkUrl: variant?.linkUrl || job.post.linkUrl,
        media: job.post.mediaAsset
          ? {
              mimeType: job.post.mediaAsset.mimeType,
              storageKey: job.post.mediaAsset.storageKey,
              kind: job.post.mediaAsset.kind,
              assetId: job.post.mediaAsset.id,
            }
          : null,
      });

      if (!result.ok) {
        await this.failJob(
          job.id,
          result.status,
          result.error,
          Boolean(result.retryable) && job.attemptCount < job.maxAttempts,
        );
        return { jobId, status: result.status };
      }

      await this.prisma.publishingJob.update({
        where: { id: job.id },
        data: {
          status: "PUBLISHED",
          externalPostId: result.externalPostId,
          publishedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });

      if (job.postTargetId) {
        await this.prisma.postTarget.update({
          where: { id: job.postTargetId },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            externalPostId: result.externalPostId,
            lastError: null,
          },
        });
      }

      await this.notifications.notifyCompanyMembers(job.companyId, {
        type: "PUBLISH_SUCCEEDED",
        title: "Post published",
        body: `${job.platformCode} publish succeeded (${result.mode}).`,
        href: `/app/${job.companyId}/publishing`,
        clientId: job.clientId,
        dedupeKey: `publish-ok:${job.id}`,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      });

      await this.addEvent(job.id, "PUBLISHED", `Published (${result.mode})`, {
        externalPostId: result.externalPostId,
        mode: result.mode,
      });

      await this.refreshPostStatus(job.postId);
      return { jobId, status: "PUBLISHED", externalPostId: result.externalPostId, mode: result.mode };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publish error";
      await this.failJob(job.id, "RETRY_PENDING", message, true);
      return { jobId, status: "RETRY_PENDING", error: message };
    }
  }

  private async failJob(
    jobId: string,
    status: PublishingJobStatus,
    error: string,
    retryable: boolean,
  ) {
    const job = await this.prisma.publishingJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const nextStatus: PublishingJobStatus =
      retryable && job.attemptCount < job.maxAttempts ? "RETRY_PENDING" : status;

    const backoffMs = Math.min(30 * 60_000, 2 ** Math.min(job.attemptCount, 6) * 1000);

    await this.prisma.publishingJob.update({
      where: { id: jobId },
      data: {
        status: nextStatus,
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: nextStatus === "RETRY_PENDING" ? new Date(Date.now() + backoffMs) : null,
      },
    });

    if (job.postTargetId) {
      await this.prisma.postTarget.update({
        where: { id: job.postTargetId },
        data: {
          status: nextStatus === "ASSISTED_REQUIRED" ? "ASSISTED_REQUIRED" : "FAILED",
          lastError: error,
        },
      });
    }

    await this.addEvent(jobId, nextStatus, error);
    if (nextStatus !== "RETRY_PENDING") {
      await this.notifications.notifyCompanyMembers(job.companyId, {
        type: "PUBLISH_FAILED",
        title: "Publishing issue",
        body: `${job.platformCode}: ${error}`,
        href: `/app/${job.companyId}/publishing`,
        clientId: job.clientId,
        dedupeKey: `publish-fail:${jobId}:${nextStatus}`,
        roles: ["OWNER", "ADMIN", "MANAGER"],
      });
    }
    await this.refreshPostStatus(job.postId);
  }

  private async refreshPostStatus(postId: string) {
    const jobs = await this.prisma.publishingJob.findMany({ where: { postId } });
    if (!jobs.length) return;
    const allPublished = jobs.every((j) => j.status === "PUBLISHED");
    const anyFailed = jobs.some((j) =>
      ["FAILED", "REQUIRES_REAUTH", "ASSISTED_REQUIRED"].includes(j.status),
    );
    const anyActive = jobs.some((j) =>
      ["QUEUED", "SCHEDULED", "PUBLISHING", "RETRY_PENDING"].includes(j.status),
    );

    let status: "PUBLISHED" | "FAILED" | "PUBLISHING" | "SCHEDULED" = "PUBLISHING";
    if (allPublished) status = "PUBLISHED";
    else if (anyActive) status = jobs.some((j) => j.status === "SCHEDULED") ? "SCHEDULED" : "PUBLISHING";
    else if (anyFailed) status = "FAILED";

    await this.prisma.contentPost.update({
      where: { id: postId },
      data: { status },
    });
  }

  private idempotencyKey(
    postId: string,
    revision: number,
    platform: SocialPlatformCode,
    accountId: string,
  ) {
    return createHash("sha256")
      .update(`${postId}:${revision}:${platform}:${accountId}`)
      .digest("hex");
  }

  private addEvent(jobId: string, type: string, message?: string, metadata?: object) {
    return this.prisma.publishingEvent.create({
      data: {
        jobId,
        type,
        message,
        metadata: metadata as object | undefined,
      },
    });
  }

  private async assertCompanyAccess(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No company access");
    }
  }
}
