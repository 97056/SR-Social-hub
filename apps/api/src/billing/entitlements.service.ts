import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { SocialPlatformCode } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type CompanyEntitlements = {
  companyId: string;
  companyStatus: string;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  interval: string | null;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  publishingAllowed: boolean;
  publishingBlockReason: string | null;
  /** How many distinct networks this plan unlocks (e.g. Starter = 3, Growth = 7). */
  maxSocialNetworks: number;
  networksUsed: number;
  quotas: {
    clients: { used: number; limit: number; remaining: number };
    accounts: { used: number; limit: number; remaining: number };
    team: { used: number; limit: number; remaining: number };
    storageMb: { used: number; limit: number; remaining: number };
    ai: { used: number; limit: number; remaining: number };
  };
  addonClientSeats: number;
};

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlements(companyId: string): Promise<CompanyEntitlements> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        _count: { select: { clients: true, members: true } },
      },
    });
    if (!company) throw new NotFoundException("Company not found");

    const [subscription, connectedAccounts, networkGroups, mediaAgg] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: {
          companyId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] },
        },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      }),
      this.prisma.socialAccount.count({
        where: { companyId, status: { not: "DISCONNECTED" } },
      }),
      this.prisma.socialAccount.groupBy({
        by: ["platformCode"],
        where: {
          companyId,
          status: { not: "DISCONNECTED" },
          platformCode: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] },
        },
      }),
      this.prisma.mediaAsset.aggregate({
        where: { companyId },
        _sum: { sizeBytes: true },
      }),
    ]);

    const plan = subscription?.plan ?? company.plan;
    const addonSeats = subscription?.addonClientSeats ?? 0;
    const isTrialing =
      subscription?.status === "TRIALING" ||
      (company.status === "TRIAL" && subscription?.status !== "ACTIVE");

    const systemRow = await this.prisma.systemSetting.findUnique({ where: { key: "system" } });
    const system = (systemRow?.value ?? {}) as {
      trialClientQuota?: number;
      trialAccountQuota?: number;
    };
    // Free trial caps — editable in Admin → Subscription plans.
    const trialClientCap = Math.max(1, Number(system.trialClientQuota ?? 1));
    const trialAccountCap = Math.max(1, Number(system.trialAccountQuota ?? 2));
    const trialNetworkCap = trialAccountCap;

    const planEntitlements = (plan?.entitlements ?? {}) as {
      maxSocialNetworks?: number;
    };
    let maxSocialNetworks = planEntitlements.maxSocialNetworks ?? plan?.accountQuota ?? 7;

    let clientLimit = (plan?.clientQuota ?? 0) + addonSeats;
    let accountLimit = plan?.accountQuota ?? 0;
    // During free trial, Admin → Free trial settings are the source of truth
    // (do not clamp to paid plan quotas — admin may set trial socials above Starter).
    if (isTrialing) {
      clientLimit = trialClientCap + addonSeats;
      accountLimit = trialAccountCap;
      maxSocialNetworks = trialNetworkCap;
    }
    const networksUsed = networkGroups.length;
    const teamLimit = plan?.teamQuota ?? 0;
    const storageLimit = plan?.storageMb ?? 0;
    const aiLimit = plan?.aiQuota ?? 0;
    const storageUsedMb = Math.ceil(Number(mediaAgg._sum.sizeBytes ?? 0) / (1024 * 1024));

    const aiAgg = await this.prisma.aiUsageRecord.aggregate({
      where: {
        companyId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { units: true },
    });
    const aiUsed = aiAgg._sum.units ?? 0;

    const trialEndsAt = subscription?.trialEndsAt ?? company.trialEndsAt;
    const publishing = this.evaluatePublishing({
      companyStatus: company.status,
      subscriptionStatus: subscription?.status ?? null,
      trialEndsAt,
      graceEndsAt: subscription?.graceEndsAt ?? null,
      periodEnd: subscription?.currentPeriodEnd ?? null,
    });

    return {
      companyId,
      companyStatus: company.status,
      planCode: plan?.code ?? null,
      planName: plan?.name ?? null,
      subscriptionStatus: subscription?.status ?? null,
      interval: subscription?.interval ?? null,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      periodEndsAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
      publishingAllowed: publishing.allowed,
      publishingBlockReason: publishing.reason,
      maxSocialNetworks,
      networksUsed,
      quotas: {
        clients: {
          used: company._count.clients,
          limit: clientLimit,
          remaining: Math.max(clientLimit - company._count.clients, 0),
        },
        accounts: {
          used: connectedAccounts,
          limit: accountLimit,
          remaining: Math.max(accountLimit - connectedAccounts, 0),
        },
        team: {
          used: company._count.members,
          limit: teamLimit,
          remaining: Math.max(teamLimit - company._count.members, 0),
        },
        storageMb: {
          used: storageUsedMb,
          limit: storageLimit,
          remaining: Math.max(storageLimit - storageUsedMb, 0),
        },
        ai: {
          used: aiUsed,
          limit: aiLimit,
          remaining: Math.max(aiLimit - aiUsed, 0),
        },
      },
      addonClientSeats: addonSeats,
    };
  }

  async assertCanPublish(companyId: string) {
    const e = await this.getEntitlements(companyId);
    if (!e.publishingAllowed) {
      throw new ForbiddenException(
        e.publishingBlockReason ??
          "Publishing is restricted for this subscription. Update billing to continue.",
      );
    }
  }

  async assertCanCreateClient(companyId: string) {
    const e = await this.getEntitlements(companyId);
    if (e.quotas.clients.remaining <= 0) {
      const trialHint =
        e.subscriptionStatus === "TRIALING" || e.companyStatus === "TRIAL"
          ? ` Free trial allows ${e.quotas.clients.limit} client${
              e.quotas.clients.limit === 1 ? "" : "s"
            } — upgrade or ask admin to raise trial limits.`
          : "";
      throw new ForbiddenException(`Client quota exceeded for current plan.${trialHint}`);
    }
  }

  async assertCanConnectAccount(companyId: string, platformCode?: SocialPlatformCode) {
    const e = await this.getEntitlements(companyId);
    if (e.quotas.accounts.remaining <= 0) {
      const hint =
        e.subscriptionStatus === "TRIALING" || e.companyStatus === "TRIAL"
          ? ` Trial allows up to ${e.quotas.accounts.limit} social connection${
              e.quotas.accounts.limit === 1 ? "" : "s"
            }. Upgrade or ask admin to raise trial limits.`
          : e.planCode === "STARTER"
            ? " Starter includes any 3 social networks. Upgrade to Growth for all networks."
            : "";
      throw new ForbiddenException(`Connected account quota exceeded for current plan.${hint}`);
    }

    if (platformCode) {
      const already = await this.prisma.socialAccount.findFirst({
        where: {
          companyId,
          platformCode,
          status: { not: "DISCONNECTED" },
        },
        select: { id: true },
      });
      if (!already && e.networksUsed >= e.maxSocialNetworks) {
        throw new ForbiddenException(
          `Your ${e.planName ?? "plan"} allows ${e.maxSocialNetworks} social network${
            e.maxSocialNetworks === 1 ? "" : "s"
          }. Disconnect one or upgrade to connect more.`,
        );
      }
    }
  }

  async assertCanUpload(companyId: string, additionalBytes: number) {
    const e = await this.getEntitlements(companyId);
    const additionalMb = Math.ceil(additionalBytes / (1024 * 1024));
    if (e.quotas.storageMb.used + additionalMb > e.quotas.storageMb.limit) {
      throw new ForbiddenException("Storage quota exceeded for current plan");
    }
  }

  async assertCanInviteTeam(companyId: string) {
    const e = await this.getEntitlements(companyId);
    if (e.quotas.team.remaining <= 0) {
      throw new ForbiddenException("Team member quota exceeded for current plan");
    }
  }

  private evaluatePublishing(input: {
    companyStatus: string;
    subscriptionStatus: string | null;
    trialEndsAt: Date | null;
    graceEndsAt: Date | null;
    periodEnd: Date | null;
  }): { allowed: boolean; reason: string | null } {
    if (input.companyStatus === "SUSPENDED" || input.companyStatus === "CANCELLED") {
      return {
        allowed: false,
        reason: `Company is ${input.companyStatus.toLowerCase()}. Billing and data export remain available.`,
      };
    }

    const now = Date.now();

    if (input.subscriptionStatus === "ACTIVE") {
      return { allowed: true, reason: null };
    }

    if (input.subscriptionStatus === "TRIALING") {
      if (input.trialEndsAt && input.trialEndsAt.getTime() < now) {
        return {
          allowed: false,
          reason: "Trial expired. Choose a plan to resume publishing.",
        };
      }
      return { allowed: true, reason: null };
    }

    if (input.subscriptionStatus === "GRACE" || input.subscriptionStatus === "PAST_DUE") {
      if (input.graceEndsAt && input.graceEndsAt.getTime() >= now) {
        return { allowed: true, reason: null };
      }
      return {
        allowed: false,
        reason: "Payment past due. Update payment method during the grace period to restore publishing.",
      };
    }

    // No subscription row: fall back to company trial window.
    if (input.companyStatus === "TRIAL") {
      if (input.trialEndsAt && input.trialEndsAt.getTime() < now) {
        return {
          allowed: false,
          reason: "Trial expired. Choose a plan to resume publishing.",
        };
      }
      return { allowed: true, reason: null };
    }

    if (input.companyStatus === "ACTIVE") {
      return { allowed: true, reason: null };
    }

    return {
      allowed: false,
      reason: "No active subscription. Visit Billing to subscribe.",
    };
  }
}
