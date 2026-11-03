import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GlobalRole, SocialPlatformCode } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { encryptSecret, maskSecret } from "../common/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import {
  CreateCompanyDto,
  UpdateBrandingDto,
  UpdateCompanyDto,
  UpdateIntegrationDto,
  UpdatePlanDto,
  UpdateSystemSettingsDto,
} from "./dto/admin.dto";

const DEFAULT_BRANDING = {
  platformName: "SR Social Hub",
  primaryColor: "#7565FF",
  secondaryColor: "#22D3EE",
  logoUrl: "",
  faviconUrl: "",
  loginHeadline: "All your socials. One command center.",
  loginSubcopy: "Agency workspaces, client approvals, and multi-network publishing.",
  supportEmail: "support@srsocialhub.local",
  themeDefault: "dark",
};

const DEFAULT_SYSTEM = {
  defaultTimezone: "Asia/Kolkata",
  maintenanceMode: false,
  trialDays: 7,
  inviteExpiryHours: 72,
  featureFlags: {
    aiStudio: false,
    billing: false,
    publishing: false,
  },
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      registeredCompanies,
      activeCompanies,
      trialCompanies,
      clientWorkspaces,
      connectedPlatforms,
      recentActivity,
      plans,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: "ACTIVE" } }),
      this.prisma.company.count({ where: { status: "TRIAL" } }),
      this.prisma.client.count({ where: { isArchived: false } }),
      this.prisma.socialPlatform.count({ where: { enabled: true } }),
      this.prisma.auditLog.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { email: true, fullName: true } } },
      }),
      this.prisma.subscriptionPlan.findMany({ where: { isActive: true } }),
    ]);

    const companiesWithPlans = await this.prisma.company.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] }, planId: { not: null } },
      select: { planId: true },
    });
    const planPrice = new Map(plans.map((p) => [p.id, p.monthlyPriceInr]));
    const mrr = companiesWithPlans.reduce(
      (sum, c) => sum + (c.planId ? planPrice.get(c.planId) ?? 0 : 0),
      0,
    );

    return {
      metrics: {
        registeredCompanies,
        activeCompanies,
        trialAccounts: trialCompanies,
        activeClientWorkspaces: clientWorkspaces,
        activeSubscriptions: activeCompanies + trialCompanies,
        monthlyRecurringRevenue: mrr,
        connectedSocialAccounts: 0,
        totalPostsCreated: 0,
        scheduledPublishingJobs: 0,
        publishedPosts: 0,
        failedPosts: 0,
        enabledIntegrations: connectedPlatforms,
      },
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actor: a.actor,
        createdAt: a.createdAt,
      })),
    };
  }

  listCompanies() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        plan: { select: { code: true, name: true, monthlyPriceInr: true } },
        _count: { select: { clients: true, members: true } },
      },
    });
  }

  async createCompany(actor: AuthUser, dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException("Company slug already exists");

    const plan = dto.planCode
      ? await this.prisma.subscriptionPlan.findUnique({ where: { code: dto.planCode } })
      : await this.prisma.subscriptionPlan.findUnique({ where: { code: "STARTER" } });

    const system = await this.getSystemSettings();
    const trialEndsAt = new Date(Date.now() + system.trialDays * 24 * 60 * 60 * 1000);

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        timezone: dto.timezone ?? system.defaultTimezone,
        status: "TRIAL",
        trialEndsAt,
        planId: plan?.id,
      },
    });

    if (plan) {
      await this.prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: "TRIALING",
          interval: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
          provider: "mock",
        },
      });
    }

    if (dto.ownerEmail && dto.ownerPassword) {
      const email = dto.ownerEmail.toLowerCase();
      let user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            fullName: dto.ownerName ?? dto.name,
            globalRole: GlobalRole.USER,
            passwordHash: await bcrypt.hash(dto.ownerPassword, 10),
          },
        });
      }
      await this.prisma.companyMember.create({
        data: {
          companyId: company.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        companyId: company.id,
        action: "ADMIN_COMPANY_CREATED",
        entityType: "Company",
        entityId: company.id,
        metadata: { name: company.name, slug: company.slug },
      },
    });

    return company;
  }

  async updateCompany(actor: AuthUser, companyId: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");

    let planId = company.planId;
    if (dto.planCode) {
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: dto.planCode } });
      if (!plan) throw new NotFoundException("Plan not found");
      planId = plan.id;
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.name,
        status: dto.status,
        timezone: dto.timezone,
        planId,
      },
      include: { plan: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        companyId,
        action: "ADMIN_COMPANY_UPDATED",
        entityType: "Company",
        entityId: companyId,
        metadata: dto as object,
      },
    });

    return updated;
  }

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { monthlyPriceInr: "asc" } });
  }

  async updatePlan(actor: AuthUser, code: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException("Plan not found");

    const updated = await this.prisma.subscriptionPlan.update({
      where: { code },
      data: {
        ...dto,
        entitlements: dto.entitlements as object | undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_PLAN_UPDATED",
        entityType: "SubscriptionPlan",
        entityId: updated.id,
        metadata: { code, ...dto } as object,
      },
    });

    return updated;
  }

  async listIntegrations() {
    const platforms = await this.prisma.socialPlatform.findMany({
      orderBy: { name: "asc" },
      include: { appConfig: true },
    });

    return platforms.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      enabled: p.enabled,
      description: p.description,
      config: p.appConfig
        ? {
            oauthClientId: p.appConfig.oauthClientId,
            clientSecretMasked: maskSecret(p.appConfig.clientSecretEncrypted),
            hasClientSecret: Boolean(p.appConfig.clientSecretEncrypted),
            redirectUri: p.appConfig.redirectUri,
            scopes: p.appConfig.scopes,
            apiVersion: p.appConfig.apiVersion,
            capabilities: p.appConfig.capabilities,
            lastError: p.appConfig.lastError,
            tokenExpiryMonitor: p.appConfig.tokenExpiryMonitor,
          }
        : null,
    }));
  }

  async updateIntegration(
    actor: AuthUser,
    code: SocialPlatformCode,
    dto: UpdateIntegrationDto,
  ) {
    const platform = await this.prisma.socialPlatform.findUnique({
      where: { code },
      include: { appConfig: true },
    });
    if (!platform) throw new NotFoundException("Integration not found");

    const updatedPlatform = await this.prisma.socialPlatform.update({
      where: { id: platform.id },
      data: { enabled: dto.enabled ?? platform.enabled },
    });

    const secretEncrypted =
      dto.clientSecret && dto.clientSecret.trim().length > 0
        ? encryptSecret(dto.clientSecret)
        : platform.appConfig?.clientSecretEncrypted;

    const config = await this.prisma.socialAppConfig.upsert({
      where: { platformId: platform.id },
      create: {
        platformId: platform.id,
        oauthClientId: dto.oauthClientId,
        clientSecretEncrypted: secretEncrypted,
        redirectUri: dto.redirectUri,
        scopes: dto.scopes ?? [],
        apiVersion: dto.apiVersion,
        capabilities: (dto.capabilities ?? {}) as object,
      },
      update: {
        oauthClientId: dto.oauthClientId ?? undefined,
        clientSecretEncrypted: secretEncrypted,
        redirectUri: dto.redirectUri ?? undefined,
        scopes: dto.scopes ?? undefined,
        apiVersion: dto.apiVersion ?? undefined,
        capabilities: dto.capabilities as object | undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_INTEGRATION_UPDATED",
        entityType: "SocialPlatform",
        entityId: platform.id,
        metadata: {
          code,
          enabled: updatedPlatform.enabled,
          secretUpdated: Boolean(dto.clientSecret),
        },
      },
    });

    return {
      id: updatedPlatform.id,
      code: updatedPlatform.code,
      name: updatedPlatform.name,
      enabled: updatedPlatform.enabled,
      config: {
        oauthClientId: config.oauthClientId,
        clientSecretMasked: maskSecret(config.clientSecretEncrypted),
        hasClientSecret: Boolean(config.clientSecretEncrypted),
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        apiVersion: config.apiVersion,
        capabilities: config.capabilities,
      },
    };
  }

  async getBranding() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "branding" } });
    return { ...DEFAULT_BRANDING, ...((row?.value as object) ?? {}) };
  }

  async updateBranding(actor: AuthUser, dto: UpdateBrandingDto) {
    const current = await this.getBranding();
    const value = { ...current, ...dto };
    await this.prisma.systemSetting.upsert({
      where: { key: "branding" },
      create: { key: "branding", value },
      update: { value },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_BRANDING_UPDATED",
        entityType: "SystemSetting",
        entityId: "branding",
        metadata: dto as object,
      },
    });
    return value;
  }

  async getSystemSettings() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "system" } });
    return { ...DEFAULT_SYSTEM, ...((row?.value as object) ?? {}) } as typeof DEFAULT_SYSTEM;
  }

  async updateSystemSettings(actor: AuthUser, dto: UpdateSystemSettingsDto) {
    const current = await this.getSystemSettings();
    const value = {
      ...current,
      ...dto,
      featureFlags: { ...current.featureFlags, ...(dto.featureFlags ?? {}) },
    };
    await this.prisma.systemSetting.upsert({
      where: { key: "system" },
      create: { key: "system", value },
      update: { value },
    });

    if (dto.featureFlags) {
      for (const [key, enabled] of Object.entries(dto.featureFlags)) {
        await this.prisma.featureFlag.upsert({
          where: { key },
          create: { key, enabled, description: key },
          update: { enabled },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_SYSTEM_SETTINGS_UPDATED",
        entityType: "SystemSetting",
        entityId: "system",
        metadata: dto as object,
      },
    });

    return value;
  }
}
