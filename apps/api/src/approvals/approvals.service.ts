import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { ApprovalDecision, ApprovalStep, ApprovalWorkflow } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublishingService } from "../publishing/publishing.service";
import {
  autoScheduleOnFinalApproval,
  nextStep,
  requiredSteps,
} from "./approval-workflow";
import { DecideApprovalDto } from "./dto/decide.dto";

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => PublishingService))
    private readonly publishing: PublishingService,
  ) {}

  async startApprovalFlow(postId: string, actorId: string) {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: { client: true },
    });
    if (!post) throw new NotFoundException("Post not found");

    await this.invalidateOpenApprovals(postId, "Resubmitted for approval");

    const step = nextStep(post.client.approvalWorkflow, []);
    if (!step) {
      throw new BadRequestException("Workflow has no approval steps");
    }

    const approval = await this.prisma.postApproval.create({
      data: {
        postId,
        revision: post.revision,
        step,
        decision: "PENDING",
      },
    });

    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        status: "PENDING_APPROVAL",
        currentApprovalStep: step,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        companyId: post.companyId,
        action: "APPROVAL_FLOW_STARTED",
        entityType: "ContentPost",
        entityId: postId,
        metadata: { step, revision: post.revision, workflow: post.client.approvalWorkflow },
      },
    });

    await this.notifications.notifyCompanyMembers(post.companyId, {
      type: "APPROVAL_REQUESTED",
      title: "New approval request",
      body: `Post for ${post.client.name} needs ${step} approval.`,
      href: `/app/${post.companyId}/approvals`,
      clientId: post.clientId,
      dedupeKey: `approval-request:${postId}:r${post.revision}:${step}`,
    });

    return approval;
  }

  async invalidateOnEdit(postId: string, actorId: string) {
    const invalidated = await this.invalidateOpenApprovals(
      postId,
      "Content edited — previous approval invalidated",
    );
    if (invalidated > 0) {
      await this.prisma.contentPost.update({
        where: { id: postId },
        data: { currentApprovalStep: null },
      });
      const post = await this.prisma.contentPost.findUnique({ where: { id: postId } });
      if (post) {
        await this.prisma.auditLog.create({
          data: {
            actorId,
            companyId: post.companyId,
            action: "APPROVAL_INVALIDATED_ON_EDIT",
            entityType: "ContentPost",
            entityId: postId,
            metadata: { invalidated },
          },
        });
      }
    }
    return { invalidated };
  }

  async companyInbox(companyId: string, user: AuthUser) {
    await this.assertCompanyMember(companyId, user);
    return this.prisma.postApproval.findMany({
      where: {
        decision: "PENDING",
        step: "COMPANY",
        post: { companyId, status: "PENDING_APPROVAL" },
      },
      include: {
        post: {
          include: {
            client: { select: { id: true, name: true, approvalWorkflow: true } },
            variants: true,
            targets: true,
            mediaAsset: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async clientInbox(clientId: string, user: AuthUser) {
    await this.assertClientAccess(clientId, user);
    return this.prisma.postApproval.findMany({
      where: {
        decision: "PENDING",
        step: "CLIENT",
        post: { clientId, status: "PENDING_APPROVAL" },
      },
      include: {
        post: {
          include: {
            client: { select: { id: true, name: true, approvalWorkflow: true } },
            variants: true,
            targets: true,
            mediaAsset: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async history(postId: string, user: AuthUser) {
    const post = await this.prisma.contentPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException("Post not found");
    await this.assertPostAccess(post.companyId, post.clientId, user);

    return this.prisma.postApproval.findMany({
      where: { postId },
      include: {
        approver: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: [{ revision: "desc" }, { createdAt: "asc" }],
    });
  }

  async decide(approvalId: string, user: AuthUser, dto: DecideApprovalDto) {
    const approval = await this.prisma.postApproval.findUnique({
      where: { id: approvalId },
      include: {
        post: { include: { client: true } },
      },
    });
    if (!approval) throw new NotFoundException("Approval not found");
    if (approval.decision !== "PENDING") {
      throw new BadRequestException("Approval already decided");
    }
    if (approval.revision !== approval.post.revision) {
      throw new BadRequestException("Approval is stale for the current revision");
    }

    await this.assertCanDecide(approval.step, approval.post.companyId, approval.post.clientId, user);

    const decision = dto.decision as ApprovalDecision;
    await this.prisma.postApproval.update({
      where: { id: approvalId },
      data: {
        decision,
        comments: dto.comments,
        approverId: user.id,
        decidedAt: new Date(),
      },
    });

    if (decision === "REJECTED" || decision === "CHANGES_REQUESTED") {
      const updated = await this.prisma.contentPost.update({
        where: { id: approval.postId },
        data: {
          status: "REJECTED",
          currentApprovalStep: null,
        },
        include: { approvals: true, client: true },
      });
      await this.audit(user.id, approval.post.companyId, "APPROVAL_REJECTED_OR_CHANGES", approval.postId, {
        decision,
        step: approval.step,
        comments: dto.comments,
      });
      if (approval.post.authorId) {
        await this.notifications.notify({
          userId: approval.post.authorId,
          companyId: approval.post.companyId,
          clientId: approval.post.clientId,
          type: decision === "REJECTED" ? "APPROVAL_REJECTED" : "APPROVAL_CHANGES_REQUESTED",
          title: decision === "REJECTED" ? "Post rejected" : "Changes requested",
          body: dto.comments || `Approval ${decision.toLowerCase()} on step ${approval.step}.`,
          href: `/app/${approval.post.companyId}/posts`,
          dedupeKey: `approval-decision:${approvalId}:${decision}`,
        });
      }
      return updated;
    }

    // APPROVED for this step
    const completedSteps = await this.completedStepsForRevision(
      approval.postId,
      approval.post.revision,
    );
    completedSteps.push(approval.step);

    const upcoming = nextStep(approval.post.client.approvalWorkflow, completedSteps);
    if (upcoming) {
      await this.prisma.postApproval.create({
        data: {
          postId: approval.postId,
          revision: approval.post.revision,
          step: upcoming,
          decision: "PENDING",
        },
      });
      const updated = await this.prisma.contentPost.update({
        where: { id: approval.postId },
        data: {
          status: "PENDING_APPROVAL",
          currentApprovalStep: upcoming,
        },
        include: { approvals: true, client: true },
      });
      await this.audit(user.id, approval.post.companyId, "APPROVAL_STEP_ADVANCED", approval.postId, {
        from: approval.step,
        to: upcoming,
      });
      return updated;
    }

    // Final approval
    const shouldAutoSchedule =
      autoScheduleOnFinalApproval(approval.post.client.approvalWorkflow) &&
      Boolean(approval.post.scheduledAt);

    const status = shouldAutoSchedule ? "SCHEDULED" : "APPROVED";
    const updated = await this.prisma.contentPost.update({
      where: { id: approval.postId },
      data: {
        status,
        currentApprovalStep: null,
      },
      include: { approvals: true, client: true, targets: true },
    });

    await this.prisma.postTarget.updateMany({
      where: { postId: approval.postId },
      data: {
        status: shouldAutoSchedule ? "SCHEDULED" : "READY",
        scheduledAt: shouldAutoSchedule ? approval.post.scheduledAt : undefined,
      },
    });

    if (approval.post.authorId) {
      await this.notifications.notify({
        userId: approval.post.authorId,
        companyId: approval.post.companyId,
        clientId: approval.post.clientId,
        type: "APPROVAL_APPROVED",
        title: "Post approved",
        body: `Your post is now ${status}.`,
        href: `/app/${approval.post.companyId}/posts`,
        dedupeKey: `approval-final:${approval.postId}:r${approval.post.revision}:${status}`,
      });
    }

    await this.audit(user.id, approval.post.companyId, "APPROVAL_COMPLETED", approval.postId, {
      status,
      workflow: approval.post.client.approvalWorkflow,
    });

    // Move approved posts into the publishing queue so they actually go live.
    try {
      const immediate =
        !shouldAutoSchedule ||
        !approval.post.scheduledAt ||
        approval.post.scheduledAt.getTime() <= Date.now();
      await this.publishing.enqueuePost(approval.postId, user, { immediate });
    } catch (error) {
      await this.audit(user.id, approval.post.companyId, "PUBLISH_ENQUEUE_FAILED", approval.postId, {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return this.prisma.contentPost.findUnique({
      where: { id: approval.postId },
      include: { approvals: true, client: true, targets: true },
    });
  }

  /**
   * Used by publishing engine before publish. Returns false if approvals missing/stale.
   */
  async verifyApprovalsValid(postId: string): Promise<{
    ok: boolean;
    reason?: string;
    workflow: ApprovalWorkflow;
  }> {
    const post = await this.prisma.contentPost.findUnique({
      where: { id: postId },
      include: { client: true, approvals: true },
    });
    if (!post) return { ok: false, reason: "POST_NOT_FOUND", workflow: "CLIENT_THEN_PUBLISH" };

    const required = requiredSteps(post.client.approvalWorkflow);
    for (const step of required) {
      const approved = post.approvals.find(
        (a) =>
          a.revision === post.revision &&
          a.step === step &&
          a.decision === "APPROVED",
      );
      if (!approved) {
        return {
          ok: false,
          reason: `MISSING_${step}_APPROVAL_FOR_REVISION_${post.revision}`,
          workflow: post.client.approvalWorkflow,
        };
      }
    }

    const pending = post.approvals.some(
      (a) => a.revision === post.revision && a.decision === "PENDING",
    );
    if (pending) {
      return { ok: false, reason: "PENDING_APPROVALS_REMAIN", workflow: post.client.approvalWorkflow };
    }

    if (!["APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(post.status)) {
      return { ok: false, reason: `INVALID_STATUS_${post.status}`, workflow: post.client.approvalWorkflow };
    }

    return { ok: true, workflow: post.client.approvalWorkflow };
  }

  private async completedStepsForRevision(postId: string, revision: number): Promise<ApprovalStep[]> {
    const rows = await this.prisma.postApproval.findMany({
      where: { postId, revision, decision: "APPROVED" },
    });
    return rows.map((r) => r.step);
  }

  private async invalidateOpenApprovals(postId: string, comments: string) {
    const result = await this.prisma.postApproval.updateMany({
      where: { postId, decision: "PENDING" },
      data: {
        decision: "INVALIDATED",
        comments,
        decidedAt: new Date(),
      },
    });
    return result.count;
  }

  private async assertCanDecide(
    step: ApprovalStep,
    companyId: string,
    clientId: string,
    user: AuthUser,
  ) {
    if (user.globalRole === "SUPER_ADMIN") return;
    if (step === "COMPANY") {
      const membership = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: user.id } },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new ForbiddenException("Company membership required");
      }
      if (!["OWNER", "ADMIN", "MANAGER", "APPROVER"].includes(membership.role)) {
        throw new ForbiddenException("Approver role required for company step");
      }
      return;
    }

    const clientMembership = await this.prisma.clientMember.findUnique({
      where: { clientId_userId: { clientId, userId: user.id } },
    });
    if (clientMembership?.status === "ACTIVE" && ["OWNER", "APPROVER"].includes(clientMembership.role)) {
      return;
    }

    // Company managers may also act on client step when explicitly managing the account
    const companyMembership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (
      companyMembership?.status === "ACTIVE" &&
      ["OWNER", "ADMIN", "MANAGER", "APPROVER"].includes(companyMembership.role)
    ) {
      return;
    }

    throw new ForbiddenException("Not allowed to decide this approval step");
  }

  private async assertCompanyMember(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No company access");
    }
  }

  private async assertClientAccess(clientId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException("Client not found");
    const clientMembership = await this.prisma.clientMember.findUnique({
      where: { clientId_userId: { clientId, userId: user.id } },
    });
    if (clientMembership?.status === "ACTIVE") return;
    const companyMembership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: client.companyId, userId: user.id } },
    });
    if (companyMembership?.status === "ACTIVE") return;
    throw new ForbiddenException("No client access");
  }

  private async assertPostAccess(companyId: string, clientId: string, user: AuthUser) {
    await this.assertClientAccess(clientId, user);
    void companyId;
  }

  private audit(
    actorId: string,
    companyId: string,
    action: string,
    entityId: string,
    metadata: object,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        companyId,
        action,
        entityType: "ContentPost",
        entityId,
        metadata,
      },
    });
  }
}
