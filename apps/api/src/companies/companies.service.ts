import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { hashToken } from "../common/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import { InviteClientUserDto, InviteCompanyMemberDto } from "./dto/invite.dto";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        _count: { select: { clients: true, members: true } },
      },
    });
    if (!company) throw new NotFoundException("Company not found");

    const clients = await this.prisma.client.findMany({
      where: { companyId, isArchived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        industry: true,
        logoUrl: true,
        approvalWorkflow: true,
        timezone: true,
        contactEmail: true,
        updatedAt: true,
      },
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        timezone: company.timezone,
        trialEndsAt: company.trialEndsAt,
        plan: company.plan
          ? {
              code: company.plan.code,
              name: company.plan.name,
              clientQuota: company.plan.clientQuota,
              aiQuota: company.plan.aiQuota,
              monthlyPriceInr: company.plan.monthlyPriceInr,
            }
          : null,
        counts: company._count,
      },
      clients,
      dashboard: {
        totalClients: company._count.clients,
        teamMembers: company._count.members,
        connectedAccounts: 0,
        postsScheduled: 0,
        awaitingApproval: 0,
        publishedThisMonth: 0,
        publishingSuccessRate: null,
        aiUsage: 0,
        remainingClientQuota: company.plan
          ? Math.max(company.plan.clientQuota - company._count.clients, 0)
          : null,
      },
    };
  }

  async commandCenter(companyId: string) {
    const [clients, pendingInvites, members, company] = await Promise.all([
      this.prisma.client.findMany({
        where: { companyId, isArchived: false },
        orderBy: { updatedAt: "desc" },
        take: 8,
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
    ]);

    return {
      attention: [
        {
          type: "INFO",
          title: "Publishing engine not enabled yet",
          detail: "Phase 8 will surface failed jobs and reconnect alerts here.",
        },
        ...(company.trialEndsAt && company.trialEndsAt.getTime() - Date.now() < 3 * 86400000
          ? [
              {
                type: "WARNING",
                title: "Trial ending soon",
                detail: `Trial ends ${company.trialEndsAt.toISOString()}`,
              },
            ]
          : []),
      ],
      today: {
        campaigns: 0,
        approvals: 0,
        publishingJobs: 0,
        scheduled: 0,
      },
      clientsNeedingAttention: clients.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        reason: "No connected accounts yet",
      })),
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
      aiCreditsRemaining: company.plan?.aiQuota ?? 0,
    };
  }

  async inviteMember(companyId: string, actor: AuthUser, dto: InviteCompanyMemberDto) {
    await this.assertManager(companyId, actor);
    return this.createInvite({
      email: dto.email.toLowerCase(),
      companyId,
      companyRole: dto.role,
      invitedById: actor.id,
    });
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
