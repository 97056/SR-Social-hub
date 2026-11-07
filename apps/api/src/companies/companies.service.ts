import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { EntitlementsService } from "../billing/entitlements.service";
import { allocateUserCode } from "../common/user-code.util";
import { hashToken } from "../common/crypto.util";
import { generateTempPassword } from "../common/password.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import { InviteClientUserDto, InviteCompanyMemberDto } from "./dto/invite.dto";

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async getWorkspace(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        _count: { select: { clients: true, members: true } },
      },
    });
    if (!company) throw new NotFoundException("Company not found");

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      clients,
      connectedAccounts,
      postsScheduled,
      awaitingApproval,
      publishedThisMonth,
      publishedJobs,
      failedJobs,
      aiUsage,
      subscription,
      entitlements,
    ] = await Promise.all([
      this.prisma.client.findMany({
        where: { companyId, isArchived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          industry: true,
          logoUrl: true,
          website: true,
          approvalWorkflow: true,
          timezone: true,
          contactEmail: true,
          contactPhone: true,
          businessName: true,
          brandVoice: true,
          updatedAt: true,
          socialAccounts: {
            where: { status: { in: ["CONNECTED", "REQUIRES_REAUTH", "EXPIRED"] } },
            select: {
              id: true,
              platformCode: true,
              accountName: true,
              username: true,
              status: true,
            },
            orderBy: { platformCode: "asc" },
          },
          _count: { select: { posts: true, members: true } },
        },
      }),
      this.prisma.socialAccount.count({
        where: { companyId, status: "CONNECTED" },
      }),
      this.prisma.contentPost.count({
        where: { companyId, status: "SCHEDULED" },
      }),
      this.prisma.contentPost.count({
        where: { companyId, status: "PENDING_APPROVAL" },
      }),
      this.prisma.contentPost.count({
        where: { companyId, status: "PUBLISHED", updatedAt: { gte: monthStart } },
      }),
      this.prisma.publishingJob.count({
        where: { companyId, status: "PUBLISHED" },
      }),
      this.prisma.publishingJob.count({
        where: { companyId, status: "FAILED" },
      }),
      this.prisma.aiUsageRecord.aggregate({
        where: { companyId },
        _sum: { units: true },
      }),
      this.prisma.subscription.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      }),
      this.entitlements.getEntitlements(companyId),
    ]);

    const jobTotal = publishedJobs + failedJobs;
    const effectiveClientQuota = entitlements.quotas.clients.limit;
    const effectiveAccountQuota = entitlements.quotas.accounts.limit;
    const effectiveTeamQuota = entitlements.quotas.team.limit;
    const isTrial = entitlements.subscriptionStatus === "TRIALING" || company.status === "TRIAL";
    const planEndsAt =
      company.status === "TRIAL"
        ? company.trialEndsAt ?? subscription?.trialEndsAt ?? null
        : subscription?.currentPeriodEnd ?? company.trialEndsAt ?? null;

    const now = Date.now();
    const endsMs = planEndsAt ? new Date(planEndsAt).getTime() : null;
    const msLeft = endsMs != null ? endsMs - now : null;
    const daysLeft =
      msLeft == null ? null : Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    const hoursLeft =
      msLeft == null ? null : Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        timezone: company.timezone,
        website: company.website,
        phone: company.phone,
        billingEmail: company.billingEmail,
        gstNumber: company.gstNumber,
        trialEndsAt: company.trialEndsAt,
        planEndsAt,
        planCountdown: {
          label:
            company.status === "TRIAL"
              ? "Free trial ends"
              : subscription?.status === "ACTIVE"
                ? "Current plan period ends"
                : "Plan / access ends",
          endsAt: planEndsAt,
          daysLeft,
          hoursLeft,
          expired: msLeft != null ? msLeft <= 0 : false,
          isTrial,
        },
        plan: company.plan
          ? {
              code: company.plan.code,
              name: isTrial ? `${company.plan.name} (trial limits)` : company.plan.name,
              // Trial-aware effective quotas (same caps as social-accounts / entitlements).
              clientQuota: effectiveClientQuota,
              accountQuota: effectiveAccountQuota,
              teamQuota: effectiveTeamQuota,
              aiQuota: company.plan.aiQuota,
              monthlyPriceInr: company.plan.monthlyPriceInr,
              maxSocialNetworks: entitlements.maxSocialNetworks,
              catalogClientQuota: company.plan.clientQuota,
              catalogAccountQuota: company.plan.accountQuota,
            }
          : null,
        subscription: subscription
          ? {
              status: subscription.status,
              interval: subscription.interval,
              currentPeriodEnd: subscription.currentPeriodEnd,
              trialEndsAt: subscription.trialEndsAt,
            }
          : null,
        counts: company._count,
      },
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        logoUrl: c.logoUrl,
        website: c.website,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        businessName: c.businessName,
        description: c.brandVoice,
        approvalWorkflow: c.approvalWorkflow,
        timezone: c.timezone,
        updatedAt: c.updatedAt,
        postCount: c._count.posts,
        memberCount: c._count.members,
        socials: c.socialAccounts.map((s) => ({
          id: s.id,
          platformCode: s.platformCode,
          accountName: s.accountName,
          username: s.username,
          status: s.status,
        })),
      })),
      dashboard: {
        totalClients: company._count.clients,
        teamMembers: company._count.members,
        connectedAccounts,
        postsScheduled,
        awaitingApproval,
        publishedThisMonth,
        publishingSuccessRate: jobTotal ? publishedJobs / jobTotal : null,
        aiUsage: aiUsage._sum.units ?? 0,
        remainingClientQuota: company.plan ? entitlements.quotas.clients.remaining : null,
        remainingSocialQuota: company.plan ? entitlements.quotas.accounts.remaining : null,
      },
    };
  }

  async commandCenter(companyId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [clients, pendingInvites, members, company, campaignsToday, approvalsToday, jobsToday, scheduledToday, failedJobs, reconnectAccounts, aiUsed] =
      await Promise.all([
        this.prisma.client.findMany({
          where: { companyId, isArchived: false },
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: { _count: { select: { socialAccounts: true } } },
        }),
        this.prisma.invitation.findMany({
          where: { companyId, status: "INVITED", expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        this.prisma.companyMember.findMany({
          where: { companyId, status: "ACTIVE" },
          include: { user: { select: { email: true, fullName: true } } },
        }),
        this.prisma.company.findUniqueOrThrow({
          where: { id: companyId },
          include: { plan: true },
        }),
        this.prisma.campaign.count({
          where: { companyId, createdAt: { gte: startOfDay } },
        }),
        this.prisma.contentPost.count({
          where: { companyId, status: "PENDING_APPROVAL" },
        }),
        this.prisma.publishingJob.count({
          where: { companyId, createdAt: { gte: startOfDay } },
        }),
        this.prisma.contentPost.count({
          where: { companyId, status: "SCHEDULED" },
        }),
        this.prisma.publishingJob.count({
          where: { companyId, status: "FAILED" },
        }),
        this.prisma.socialAccount.count({
          where: { companyId, status: { in: ["REQUIRES_REAUTH", "EXPIRED", "ERROR"] } },
        }),
        this.prisma.aiUsageRecord.aggregate({
          where: { companyId },
          _sum: { units: true },
        }),
      ]);

    const attention: Array<{ type: string; title: string; detail: string }> = [];
    if (company.trialEndsAt && company.trialEndsAt.getTime() - Date.now() < 3 * 86400000) {
      attention.push({
        type: "WARNING",
        title: "Trial ending soon",
        detail: `Trial ends ${company.trialEndsAt.toLocaleString()}`,
      });
    }
    if (failedJobs > 0) {
      attention.push({
        type: "ERROR",
        title: "Failed publish jobs",
        detail: `${failedJobs} job(s) need retry or review.`,
      });
    }
    if (reconnectAccounts > 0) {
      attention.push({
        type: "WARNING",
        title: "Accounts need reconnect",
        detail: `${reconnectAccounts} social account(s) require re-authorization.`,
      });
    }

    const clientsNeedingAttention = clients
      .filter((c) => c._count.socialAccounts === 0)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        reason: "No connected accounts",
      }));

    const aiQuota = company.plan?.aiQuota ?? 0;
    const used = aiUsed._sum.units ?? 0;

    return {
      attention,
      today: {
        campaigns: campaignsToday,
        approvals: approvalsToday,
        publishingJobs: jobsToday,
        scheduled: scheduledToday,
      },
      clientsNeedingAttention,
      pendingInvites: pendingInvites.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expiresAt,
        clientRole: i.clientRole,
        companyRole: i.companyRole,
      })),
      team: members.map((m) => ({
        role: m.role,
        email: m.user.email,
        fullName: m.user.fullName,
      })),
      aiCreditsRemaining: Math.max(aiQuota - used, 0),
    };
  }

  async inviteMember(companyId: string, actor: AuthUser, dto: InviteCompanyMemberDto) {
    await this.assertManager(companyId, actor);
    const fullName = dto.fullName?.trim();
    if (!fullName || fullName.length < 2) {
      throw new BadRequestException("Full name is required");
    }

    const entitlements = await this.entitlements.getEntitlements(companyId);
    if (entitlements.quotas.team.remaining <= 0) {
      throw new ForbiddenException(
        `Team seat quota reached (${entitlements.quotas.team.limit}). Upgrade your plan to add more members.`,
      );
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      const already = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: existing.id } },
      });
      if (already && already.status !== "SUSPENDED") {
        throw new ConflictException("This person is already on the team");
      }
    }

    const plainPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const webOrigin =
      this.config.get<string>("WEB_ORIGIN") ??
      this.config.get<string>("PUBLIC_WEB_URL") ??
      "https://srsocialhub.in";
    const loginUrl = `${webOrigin.replace(/\/$/, "")}/login`;

    const result = await this.prisma.$transaction(async (tx) => {
      let user = existing;
      if (!user) {
        user = await tx.user.create({
          data: {
            userCode: await allocateUserCode(tx),
            email,
            fullName,
            globalRole: "USER",
            isActive: true,
            emailVerifiedAt: new Date(),
            passwordHash,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            fullName: user.fullName || fullName,
            isActive: true,
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            passwordHash,
          },
        });
      }

      await tx.companyMember.upsert({
        where: { companyId_userId: { companyId, userId: user.id } },
        create: {
          companyId,
          userId: user.id,
          role: dto.role,
          status: "ACTIVE",
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
        update: {
          role: dto.role,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          companyId,
          action: "TEAM_MEMBER_INVITED",
          entityType: "CompanyMember",
          entityId: user.id,
          metadata: { email, fullName, role: dto.role, provisioned: true },
        },
      });

      return { user };
    });

    let mailSent = false;
    let mailError: string | null = null;
    try {
      await this.mail.sendMail({
        to: email,
        subject: `Team access — ${company.name} | SR Social Hub`,
        html: this.mail.teamAccessHtml({
          fullName,
          companyName: company.name,
          email,
          password: plainPassword,
          role: dto.role,
          loginUrl,
        }),
        text: [
          `SR SOCIAL HUB — TEAM ACCESS`,
          ``,
          `Hi ${fullName},`,
          ``,
          `You were added to ${company.name} as ${dto.role}.`,
          ``,
          `Email: ${email}`,
          `Password: ${plainPassword}`,
          ``,
          `Sign in: ${loginUrl}`,
        ].join("\n"),
      });
      mailSent = true;
    } catch (err) {
      mailError = err instanceof Error ? err.message : "Failed to send invite email";
    }

    return {
      id: result.user.id,
      email,
      fullName,
      role: dto.role,
      mailSent,
      mailError,
      message: mailSent
        ? "Team member added. Login credentials were emailed."
        : `Member added, but email failed (${mailError}). Check Admin → Mail & SMS.`,
    };
  }

  async inviteClientUser(
    companyId: string,
    clientId: string,
    actor: AuthUser,
    dto: InviteClientUserDto,
  ) {
    await this.assertManager(companyId, actor);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, isArchived: false },
    });
    if (!client) throw new NotFoundException("Client not found in this company");

    return this.createInvite({
      email: dto.email.toLowerCase(),
      companyId,
      clientId,
      clientRole: dto.role ?? "APPROVER",
      invitedById: actor.id,
    });
  }

  private async createInvite(input: {
    email: string;
    companyId: string;
    clientId?: string;
    companyRole?: "ADMIN" | "MANAGER" | "MEMBER" | "APPROVER";
    clientRole?: "OWNER" | "APPROVER" | "VIEWER";
    invitedById: string;
  }) {
    const settings = await this.prisma.systemSetting.findUnique({ where: { key: "system" } });
    const hours =
      ((settings?.value as { inviteExpiryHours?: number } | null)?.inviteExpiryHours ?? 72);
    const raw = randomBytes(32).toString("hex");
    const invitation = await this.prisma.invitation.create({
      data: {
        email: input.email,
        tokenHash: hashToken(raw),
        companyId: input.companyId,
        clientId: input.clientId,
        companyRole: input.companyRole,
        clientRole: input.clientRole,
        status: "INVITED",
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        invitedById: input.invitedById,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: input.invitedById,
        companyId: input.companyId,
        action: "INVITATION_CREATED",
        entityType: "Invitation",
        entityId: invitation.id,
        metadata: {
          email: input.email,
          clientId: input.clientId,
          companyRole: input.companyRole,
          clientRole: input.clientRole,
        },
      },
    });

    // Token returned once for local/dev acceptance flows; production would email it.
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      acceptToken: raw,
      acceptPath: `/invite/accept?token=${raw}`,
    };
  }

  private async assertManager(companyId: string, actor: AuthUser) {
    if (actor.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: actor.id } },
    });
    if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
      throw new ForbiddenException("Manager role required");
    }
  }
}
