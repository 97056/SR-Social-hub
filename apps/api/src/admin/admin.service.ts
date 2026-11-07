import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GlobalRole, SocialPlatformCode } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { encryptSecret, maskSecret } from "../common/crypto.util";
import { allocateUserCode } from "../common/user-code.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import {
  CreateCompanyDto,
  CreateContactLeadDto,
  CreatePlanDto,
  UpdateBrandingDto,
  UpdateCompanyDto,
  UpdateContactLeadDto,
  UpdateFaqsDto,
  UpdateIntegrationDto,
  UpdatePlanDto,
  UpdateSystemSettingsDto,
} from "./dto/admin.dto";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  published: boolean;
  sortOrder: number;
};

export type ContactLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
};

const DEFAULT_FAQS: FaqItem[] = [
  {
    id: "faq-trial",
    question: "What do I get during the 7-day free trial?",
    answer:
      "Trial unlocks the full approval -> publish workflow with 1 client profile and up to 2 social connections so you can feel the speed before you subscribe.",
    published: true,
    sortOrder: 1,
  },
  {
    id: "faq-starter-socials",
    question: "How many social networks can I connect on Starter (Rs.499)?",
    answer:
      "Starter includes 3 client profiles and any 3 social networks of your choice. Upgrade to Growth (Rs.999) to unlock all seven networks and full platform features.",
    published: true,
    sortOrder: 2,
  },
  {
    id: "faq-approvals",
    question: "How do client approvals work inside the platform?",
    answer:
      "Your team submits drafts for review. Clients open a focused portal, leave feedback, and approve — without ever seeing credentials or billing. Approved posts move straight into the publishing queue.",
    published: true,
    sortOrder: 3,
  },
  {
    id: "faq-publish",
    question: "Can I publish one post to multiple networks?",
    answer:
      "Yes. Compose once, tailor media per channel, then schedule or publish live across connected networks based on your plan limits.",
    published: true,
    sortOrder: 4,
  },
  {
    id: "faq-billing",
    question: "Who controls plans and quotas?",
    answer:
      "Super Admin assigns plans, negotiates custom quota, and manages pricing. Agencies see their entitlements on Billing but cannot change plan pricing themselves.",
    published: true,
    sortOrder: 5,
  },
  {
    id: "faq-delete",
    question: "How do I delete my account or request data removal?",
    answer:
      "Use the Delete account page (/delete-account) or email support@srsocialhub.in. We’ll process deletion requests according to our Privacy Policy.",
    published: true,
    sortOrder: 6,
  },
];

const DEFAULT_BRANDING = {
  platformName: "SR Social Hub",
  primaryColor: "#00D2FF",
  secondaryColor: "#C026FF",
  logoUrl: "/brand/logo.png",
  faviconUrl: "/brand/favicon.png",
  loginHeadline: "All your socials. One command center.",
  loginSubcopy:
    "Agency workspaces, client approvals, and multi-network publishing from one neon-bright hub.",
  supportEmail: "support@srsocialhub.in",
  themeDefault: "dark",
};

const DEFAULT_SYSTEM = {
  defaultTimezone: "Asia/Kolkata",
  maintenanceMode: false,
  trialDays: 7,
  trialClientQuota: 1,
  trialAccountQuota: 2,
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
      connectedSocialAccounts,
      totalPostsCreated,
      scheduledPublishingJobs,
      publishedPosts,
      failedPosts,
      recentActivity,
      plans,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: "ACTIVE" } }),
      this.prisma.company.count({ where: { status: "TRIAL" } }),
      this.prisma.client.count({ where: { isArchived: false } }),
      this.prisma.socialPlatform.count({ where: { enabled: true } }),
      this.prisma.socialAccount.count({ where: { status: "CONNECTED" } }),
      this.prisma.contentPost.count(),
      this.prisma.publishingJob.count({
        where: { status: { in: ["QUEUED", "SCHEDULED", "RETRY_PENDING"] } },
      }),
      this.prisma.publishingJob.count({ where: { status: "PUBLISHED" } }),
      this.prisma.publishingJob.count({ where: { status: "FAILED" } }),
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
        connectedSocialAccounts,
        totalPostsCreated,
        scheduledPublishingJobs,
        publishedPosts,
        failedPosts,
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
        plan: {
          select: { code: true, name: true, monthlyPriceInr: true, clientQuota: true, accountQuota: true },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, trialEndsAt: true, currentPeriodEnd: true, interval: true },
        },
        members: {
          where: { role: "OWNER" },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                accountKind: true,
                isActive: true,
                emailVerifiedAt: true,
              },
            },
          },
        },
        _count: { select: { clients: true, members: true, socialAccounts: true } },
      },
    });
  }

  async getCompanyDetail(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 3 },
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                accountKind: true,
                isActive: true,
                emailVerifiedAt: true,
                lastLoginAt: true,
                userCode: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        clients: {
          where: { isArchived: false },
          orderBy: { name: "asc" },
          include: {
            members: {
              where: { status: "ACTIVE" },
              take: 5,
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true,
                    isActive: true,
                    lastLoginAt: true,
                  },
                },
              },
            },
            socialAccounts: {
              select: {
                id: true,
                platformCode: true,
                accountName: true,
                username: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                lastSyncedAt: true,
                lastError: true,
              },
              orderBy: { platformCode: "asc" },
            },
            _count: { select: { posts: true, members: true, socialAccounts: true } },
          },
        },
        socialAccounts: {
          select: {
            id: true,
            platformCode: true,
            accountName: true,
            username: true,
            status: true,
            clientId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { clients: true, members: true, socialAccounts: true, posts: true },
        },
      },
    });
    if (!company) throw new NotFoundException("Company not found");

    const recentPosts = await this.prisma.contentPost.findMany({
      where: { companyId },
      orderBy: [{ updatedAt: "desc" }],
      take: 40,
      select: {
        id: true,
        status: true,
        baseCaption: true,
        scheduledAt: true,
        updatedAt: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        targets: {
          select: {
            platformCode: true,
            status: true,
            publishedAt: true,
            scheduledAt: true,
            externalPostId: true,
            lastError: true,
          },
        },
      },
    });

    const owner = company.members.find((m) => m.role === "OWNER")?.user ?? null;
    const subscription = company.subscriptions[0] ?? null;
    const isTrial =
      company.status === "TRIAL" ||
      subscription?.status === "TRIALING";

    return {
      ...company,
      owner,
      subscription,
      isTrial,
      accessLabel: isTrial ? "Free trial" : company.status,
      planLabel: isTrial
        ? `Free trial · ${company.plan?.name ?? "Starter"} catalog`
        : company.plan?.name ?? "No plan",
      recentPosts,
    };
  }

  async getClientDetail(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
                lastLoginAt: true,
              },
            },
          },
        },
        socialAccounts: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            platformCode: true,
            accountName: true,
            username: true,
            status: true,
            connectionMode: true,
            createdAt: true,
            updatedAt: true,
            lastSyncedAt: true,
            lastError: true,
            tokenExpiresAt: true,
          },
        },
      },
    });
    if (!client || client.isArchived) throw new NotFoundException("Client not found");

    const posts = await this.prisma.contentPost.findMany({
      where: { clientId },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: {
        mediaAsset: {
          select: { id: true, kind: true, originalName: true, createdAt: true },
        },
        campaign: { select: { id: true, name: true } },
        targets: {
          select: {
            platformCode: true,
            status: true,
            scheduledAt: true,
            publishedAt: true,
            externalPostId: true,
            lastError: true,
          },
        },
        approvals: {
          orderBy: [{ revision: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            step: true,
            decision: true,
            comments: true,
            revision: true,
            createdAt: true,
            decidedAt: true,
            approver: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    return { client, posts };
  }

  async activateCompanyOwner(actor: AuthUser, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        members: { where: { role: "OWNER" }, include: { user: true }, take: 1 },
      },
    });
    if (!company) throw new NotFoundException("Company not found");
    const owner = company.members[0]?.user;
    if (!owner) throw new NotFoundException("Company owner not found");

    const updated = await this.prisma.user.update({
      where: { id: owner.id },
      data: { isActive: true, emailVerifiedAt: new Date() },
    });

    // Registrations should remain on trial until paid conversion.
    if (company.status === "ACTIVE" && company.trialEndsAt && company.trialEndsAt > new Date()) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { status: "TRIAL" },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        companyId,
        action: "ADMIN_OWNER_ACTIVATED",
        entityType: "User",
        entityId: owner.id,
        metadata: { email: owner.email },
      },
    });

    return {
      ok: true,
      email: updated.email,
      message: "Owner activated. They can sign in now.",
    };
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
            userCode: await allocateUserCode(this.prisma),
            email,
            fullName: dto.ownerName ?? dto.name,
            globalRole: GlobalRole.USER,
            passwordHash: await bcrypt.hash(dto.ownerPassword, 10),
            isActive: true,
            emailVerifiedAt: new Date(),
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

  async createPlan(actor: AuthUser, dto: CreatePlanDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Plan code ${code} already exists`);

    const created = await this.prisma.subscriptionPlan.create({
      data: {
        code,
        name: dto.name.trim(),
        monthlyPriceInr: dto.monthlyPriceInr,
        yearlyPriceInr: dto.yearlyPriceInr ?? null,
        clientQuota: dto.clientQuota,
        aiQuota: dto.aiQuota ?? 100,
        storageMb: dto.storageMb ?? 1024,
        accountQuota: dto.accountQuota ?? 20,
        teamQuota: dto.teamQuota ?? 5,
        isActive: dto.isActive ?? true,
        isCustom: dto.isCustom ?? false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_PLAN_CREATED",
        entityType: "SubscriptionPlan",
        entityId: created.id,
        metadata: { code, name: created.name } as object,
      },
    });

    return created;
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
      where: { code: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] } },
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
            configId: p.appConfig.configId,
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
        configId: dto.configId,
        scopes: dto.scopes ?? [],
        apiVersion: dto.apiVersion,
        capabilities: (dto.capabilities ?? {}) as object,
      },
      update: {
        oauthClientId: dto.oauthClientId ?? undefined,
        clientSecretEncrypted: secretEncrypted,
        redirectUri: dto.redirectUri ?? undefined,
        configId: dto.configId ?? undefined,
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
        configId: config.configId,
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

  async getFaqs(publishedOnly = false): Promise<FaqItem[]> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "faqs" } });
    const stored = (row?.value as { items?: FaqItem[] } | null)?.items;
    const items = Array.isArray(stored) && stored.length ? stored : DEFAULT_FAQS;
    const normalized = items
      .map((item, index) => ({
        id: item.id || `faq-${index + 1}`,
        question: item.question,
        answer: item.answer,
        published: item.published !== false,
        sortOrder: item.sortOrder ?? index + 1,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return publishedOnly ? normalized.filter((f) => f.published) : normalized;
  }

  async updateFaqs(actor: AuthUser, dto: UpdateFaqsDto) {
    const items: FaqItem[] = dto.items.map((item, index) => ({
      id: item.id || `faq-${Date.now()}-${index}`,
      question: item.question.trim(),
      answer: item.answer.trim(),
      published: item.published !== false,
      sortOrder: item.sortOrder ?? index + 1,
    }));
    const value = { items };
    await this.prisma.systemSetting.upsert({
      where: { key: "faqs" },
      create: { key: "faqs", value },
      update: { value },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_FAQS_UPDATED",
        entityType: "SystemSetting",
        entityId: "faqs",
        metadata: { count: items.length },
      },
    });
    return items;
  }

  private async readContactLeads(): Promise<ContactLead[]> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "contact_leads" } });
    const stored = (row?.value as { items?: ContactLead[] } | null)?.items;
    return Array.isArray(stored) ? stored : [];
  }

  private async writeContactLeads(items: ContactLead[]) {
    const value = { items };
    await this.prisma.systemSetting.upsert({
      where: { key: "contact_leads" },
      create: { key: "contact_leads", value },
      update: { value },
    });
  }

  async listContactLeads() {
    const items = await this.readContactLeads();
    return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createContactLead(dto: CreateContactLeadDto) {
    const items = await this.readContactLeads();
    const lead: ContactLead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: (dto.phone ?? "").trim(),
      company: (dto.company ?? "").trim(),
      message: dto.message.trim(),
      status: "NEW",
      createdAt: new Date().toISOString(),
    };
    items.unshift(lead);
    await this.writeContactLeads(items.slice(0, 500));
    return { ok: true, id: lead.id };
  }

  async updateContactLead(actor: AuthUser, id: string, dto: UpdateContactLeadDto) {
    const items = await this.readContactLeads();
    const index = items.findIndex((l) => l.id === id);
    if (index < 0) throw new NotFoundException("Contact lead not found");
    const status = dto.status ?? items[index].status;
    items[index] = { ...items[index], status };
    await this.writeContactLeads(items);
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_CONTACT_LEAD_UPDATED",
        entityType: "ContactLead",
        entityId: id,
        metadata: { status },
      },
    });
    return items[index];
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
