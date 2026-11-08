import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import type { AuthUser } from "../auth/jwt.strategy";
import { EntitlementsService } from "../billing/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CampaignPlanDto,
  CreateGrowthPlanDto,
  CreateGrowthReportDto,
  CreateGrowthTaskDto,
  RunGrowthAnalysisDto,
  UpdateGrowthAiSettingsDto,
  UpdateGrowthPlanDto,
  UpdateGrowthTaskDto,
  UpdateOpportunityDto,
  UpsertGrowthProfileDto,
} from "./dto/growth.dto";
import { formatCompetitorsField, suggestCompetitorsFromSignals } from "./growth-competitors.util";
import { toDbSafeJson, toDbSafeText } from "./growth-db-safe.util";
import { fetchPublicWebsite, normalizeWebsiteUrl } from "./growth-website.util";

const DEFAULT_AI_SETTINGS = {
  enabled: true,
  provider: "sr-growth-mock",
  model: "growth-heuristics-v1",
  dailyLimit: 200,
  monthlyLimit: 2000,
  maxTokens: 4096,
  alertEmail: "support@srsocialhub.in",
};

@Injectable()
export class GrowthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ─── Overview ─────────────────────────────────────────────────────────────

  async overview(companyId: string, clientId?: string) {
    const where = { companyId, ...(clientId ? { clientId } : {}) };
    const [profiles, opportunities, plans, tasks, runs, reports, usage] = await Promise.all([
      this.prisma.growthBusinessProfile.count({ where: { companyId, ...(clientId ? { clientId } : {}) } }),
      this.prisma.growthOpportunity.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.growthPlan.count({ where }),
      this.prisma.growthTask.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      this.prisma.growthAnalysisRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          kind: true,
          title: true,
          status: true,
          clientId: true,
          createdAt: true,
        },
      }),
      this.prisma.growthReport.count({ where }),
      this.monthUsage(companyId),
    ]);

    return {
      profiles,
      opportunities: Object.fromEntries(opportunities.map((o) => [o.status, o._count._all])),
      plans,
      tasks: Object.fromEntries(tasks.map((t) => [t.status, t._count._all])),
      recentRuns: runs,
      reports,
      usage,
      modules: {
        businessConsultant: "Understands the business profile, SWOT, and competitive position.",
        marketingExpert: "Audits website, social, SEO and builds campaign strategies.",
        growthPartner: "Turns findings into opportunities, plans, tasks and tracked results.",
      },
    };
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(companyId: string, clientId: string) {
    await this.assertClient(companyId, clientId);
    const profile = await this.prisma.growthBusinessProfile.findUnique({ where: { clientId } });
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    return {
      profile:
        profile ??
        ({
          companyId,
          clientId,
          businessName: client?.businessName || client?.name,
          websiteUrl: client?.website,
          industry: client?.industry,
        } as object),
      client,
    };
  }

  async upsertProfile(
    companyId: string,
    clientId: string,
    user: AuthUser,
    dto: UpsertGrowthProfileDto,
  ) {
    await this.assertClient(companyId, clientId);
    let websiteUrl = dto.websiteUrl;
    if (websiteUrl?.trim()) {
      try {
        websiteUrl = normalizeWebsiteUrl(websiteUrl);
      } catch {
        throw new BadRequestException("Invalid website URL");
      }
    }
    const data = {
      businessName: dto.businessName,
      websiteUrl,
      industry: dto.industry,
      category: dto.category,
      description: dto.description,
      productsServices: dto.productsServices,
      targetAudience: dto.targetAudience,
      location: dto.location,
      serviceAreas: dto.serviceAreas,
      goals: dto.goals,
      competitors: dto.competitors,
      uniqueSellingPoints: dto.uniqueSellingPoints,
      challenges: dto.challenges,
      monthlyBudgetRange: dto.monthlyBudgetRange,
      confirmedAt: dto.confirm ? new Date() : undefined,
    };
    const profile = await this.prisma.growthBusinessProfile.upsert({
      where: { clientId },
      create: { companyId, clientId, ...data },
      update: data,
    });
    await this.audit(user, companyId, "GROWTH_PROFILE_UPSERT", "GrowthBusinessProfile", profile.id);
    return profile;
  }

  // ─── Analyses ─────────────────────────────────────────────────────────────

  async runBusinessAnalysis(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_business_analysis");
    const result = this.buildBusinessAnalysis(profile);
    return this.saveRun(companyId, dto.clientId, user, "BUSINESS", "Business Consultant analysis", dto, result);
  }

  async runWebsiteAudit(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    const url = dto.websiteUrl || profile.websiteUrl;
    if (!url) throw new BadRequestException("Website URL is required");
    await this.consumeAi(companyId, user, "growth_website_audit");
    let snapshot;
    try {
      snapshot = await fetchPublicWebsite(url);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Website fetch failed");
    }
    const issues = this.buildWebsiteIssues(snapshot);
    const { htmlLower: _html, ...safeSnapshot } = snapshot;
    const result = {
      summary: `Website audit for ${snapshot.finalUrl}`,
      snapshot: safeSnapshot,
      issues,
      measuredVsEstimated: {
        measured: ["HTTP status", "title", "meta description", "H1-H3 text", "viewport meta", "CTA keyword presence"],
        estimated: ["Usability interpretation", "content quality judgment", "priority scoring"],
      },
      nextActions: issues.filter((i) => i.priority === "Critical" || i.priority === "High").map((i) => i.solution),
    };
    return this.saveRun(companyId, dto.clientId, user, "WEBSITE", "Website audit", { ...dto, websiteUrl: url }, result, {
      sourceUrl: snapshot.finalUrl,
      fetchedAt: snapshot.fetchedAt,
    });
  }

  async runSocialAudit(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    await this.assertClient(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_social_audit");
    const accounts = await this.prisma.socialAccount.findMany({
      where: { companyId, clientId: dto.clientId, status: "CONNECTED" },
      include: { platform: true },
      orderBy: { updatedAt: "desc" },
    });
    const platforms = accounts.map((a) => ({
      platform: a.platform.code,
      name: a.accountName,
      username: a.username,
      status: a.status,
      profileCompleteness: [a.accountName, a.username, a.externalAccountId].filter(Boolean).length >= 2 ? "Good" : "Incomplete",
      postingFrequency: "Unavailable - provider insights API not connected for cadence metrics",
      engagement: "Unavailable - no authorised engagement metrics in token scopes",
      bestPosts: "Unavailable",
      weakPosts: "Unavailable",
      recommendation: `Keep ${a.platform.name} connected and publish consistently through SR Social Hub so future audits can use real delivery data.`,
    }));
    const result = {
      summary:
        accounts.length === 0
          ? "No connected social accounts for this client. Connect accounts before expecting social metrics."
          : `Audited ${accounts.length} connected account(s). Engagement and best-post metrics are unavailable until provider insights scopes are granted.`,
      accounts: platforms,
      contentGaps: [
        "Educational carousel content",
        "Customer proof / testimonials",
        "Offer-led conversion posts",
        "Behind-the-scenes trust content",
      ],
      recommendedFrequency: "3-5 posts/week across primary networks (estimate, not measured)",
      limitations:
        "Never invents likes/followers/reach. Only authorised connection metadata is shown until insights APIs are enabled.",
    };
    return this.saveRun(companyId, dto.clientId, user, "SOCIAL", "Social media audit", dto, result);
  }

  async runSeoAnalysis(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    const url = dto.websiteUrl || profile.websiteUrl;
    await this.consumeAi(companyId, user, "growth_seo_analysis");
    let snapshot = null as Awaited<ReturnType<typeof fetchPublicWebsite>> | null;
    if (url) {
      try {
        snapshot = await fetchPublicWebsite(url);
      } catch {
        snapshot = null;
      }
    }
    const keywords = this.keywordHints(profile);
    const result = {
      summary: "SEO & visibility scan (on-page measured where website fetched; rankings estimated only as suggestions)",
      onPage: {
        title: snapshot?.title ?? null,
        metaDescription: snapshot?.description ?? null,
        headings: snapshot?.headings ?? [],
        hasViewport: snapshot?.hasViewport ?? null,
        measured: Boolean(snapshot),
      },
      technical: {
        https: url?.startsWith("https") ?? null,
        fetchStatus: snapshot?.status ?? null,
        notes: snapshot?.brokenNote ? [snapshot.brokenNote] : [],
      },
      keywordTopics: {
        type: "AI_SUGGESTION",
        items: keywords,
      },
      localSeo: {
        type: "AI_SUGGESTION",
        items: [
          profile.location
            ? `Publish location pages and GBP-style NAP consistency for ${profile.location}`
            : "Add a clear service location to the business profile for local SEO planning",
        ],
      },
      contentOpportunities: keywords.slice(0, 5).map((k) => `Create a pillar page targeting "${k}"`),
      limitations: "Search rankings and traffic are not measured without Search Console / analytics integrations.",
    };
    return this.saveRun(companyId, dto.clientId, user, "SEO", "SEO & visibility", dto, result, snapshot
      ? { sourceUrl: snapshot.finalUrl, fetchedAt: snapshot.fetchedAt, status: snapshot.status }
      : undefined);
  }

  async suggestCompetitors(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto & { save?: boolean }) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    const url = dto.websiteUrl || profile.websiteUrl;
    if (!url) throw new BadRequestException("Website URL is required to auto-fill competitors");

    await this.consumeAi(companyId, user, "growth_suggest_competitors");

    let snapshot: Awaited<ReturnType<typeof fetchPublicWebsite>> | null = null;
    try {
      snapshot = await fetchPublicWebsite(url);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Website fetch failed");
    }

    const suggested = suggestCompetitorsFromSignals({
      industry: profile.industry,
      category: profile.category,
      description: profile.description,
      productsServices: profile.productsServices,
      targetAudience: profile.targetAudience,
      businessName: profile.businessName,
      websiteTitle: snapshot.title,
      websiteDescription: snapshot.description,
      websiteExcerpt: snapshot.rawExcerpt,
      htmlLower: snapshot.htmlLower,
    });

    if (!suggested.items.length) {
      throw new BadRequestException("Could not map competitors for this website yet");
    }

    const competitorsText = toDbSafeText(formatCompetitorsField(suggested.items));
    const shouldSave = dto.save !== false;
    let profileOut = profile;
    if (shouldSave) {
      profileOut = await this.prisma.growthBusinessProfile.update({
        where: { clientId: dto.clientId },
        data: {
          competitors: competitorsText,
          websiteUrl: snapshot.finalUrl || url,
        },
      });
    }

    await this.audit(user, companyId, "GROWTH_COMPETITORS_SUGGESTED", "GrowthBusinessProfile", profileOut.id, {
      category: suggested.category,
      count: suggested.items.length,
      sourceUrl: snapshot.finalUrl,
    });

    return {
      category: suggested.category,
      sourceUrl: snapshot.finalUrl,
      competitors: competitorsText,
      items: suggested.items,
      profile: profileOut,
      message: `Filled ${suggested.items.length} competitors from website analysis (${suggested.category}).`,
    };
  }

  async runCompetitorAnalysis(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    let profile = await this.requireProfile(companyId, dto.clientId);
    // Always ensure competitors exist — auto-fill from website when blank.
    if (!(profile.competitors || "").trim()) {
      if (!(dto.websiteUrl || profile.websiteUrl)) {
        throw new BadRequestException("Add a website URL first so we can auto-fill competitors");
      }
      const filled = await this.suggestCompetitors(companyId, user, { ...dto, save: true });
      profile = filled.profile;
    }
    await this.consumeAi(companyId, user, "growth_competitor_analysis");
    const named = (profile.competitors || "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const competitors = [];
    for (const name of named) {
      const maybeUrl = name.startsWith("http") ? name : null;
      let site = null as Awaited<ReturnType<typeof fetchPublicWebsite>> | null;
      if (maybeUrl) {
        try {
          site = await fetchPublicWebsite(maybeUrl);
        } catch {
          site = null;
        }
      }
      competitors.push({
        businessName: site?.title || name,
        website: site?.finalUrl || maybeUrl,
        productsServices: site?.headings?.slice(0, 4) || [],
        positioning: site?.description || "Insufficient public page data - only listed from your profile notes.",
        publicMarketing: site
          ? ["Public website content observed", ...site.ctaHints.map((c) => `CTA signal: ${c}`)]
          : ["No public crawl performed - name/notes only"],
        strengths: site?.title ? ["Findable public web presence"] : ["Unknown without public sources"],
        weaknesses: site ? [] : ["No verified public source linked"],
        differentiate: `Position ${profile.businessName || "your brand"} against ${name} using your USP: ${profile.uniqueSellingPoints || "clarify USP in profile"}`,
        sourceLinks: site ? [site.finalUrl] : [],
        analyzedAt: new Date().toISOString(),
        confidence: site ? "MEDIUM" : "LOW",
      });
    }
    const result = {
      summary: `Competitor review for ${profile.businessName || "client"}`,
      competitors,
      limitations:
        "Competitors are taken from website-based auto-fill and/or your profile list, then enriched with public page signals where URLs are reachable.",
    };
    return this.saveRun(companyId, dto.clientId, user, "COMPETITOR", "Competitor analysis", dto, result);
  }

  async createCampaign(companyId: string, user: AuthUser, dto: CampaignPlanDto) {
    await this.assertClient(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_campaign_plan");
    const profile = await this.prisma.growthBusinessProfile.findUnique({ where: { clientId: dto.clientId } });
    const strategy = {
      campaignStrategy: `Drive ${dto.objective || "awareness"} for ${dto.productService || profile?.productsServices || "core offer"} among ${dto.targetAudience || profile?.targetAudience || "target buyers"}.`,
      contentIdeas: [
        "Problem-agitate-solve carousel",
        "Offer highlight short video concept",
        "Customer proof post",
        "FAQ myth-busting thread/post",
        "Behind-the-scenes trust reel concept",
      ],
      captions: [
        `${dto.offer || "New value for you"} - built for ${dto.targetAudience || "your audience"}.`,
        `Why ${dto.productService || "this offer"} matters now: clarity, proof, and a simple next step.`,
      ],
      hashtags: ["#Growth", "#Marketing", `#${(profile?.industry || "Business").replace(/\s+/g, "")}`],
      posterConcepts: ["Bold offer poster with single CTA", "Before/after benefit grid"],
      videoConcepts: ["15s hook + offer", "Owner talking-head FAQ"],
      calendar: Array.from({ length: Math.min(dto.durationDays || 14, 14) }).map((_, i) => ({
        day: i + 1,
        theme: ["Educate", "Proof", "Offer", "Community"][i % 4],
      })),
      scheduleHint: "Use SR Create Post + Approval Inbox; do not auto-publish without approval.",
      kpis: ["Reach (platform-reported)", "Saves/shares", "Profile visits", "Leads attributed manually"],
      effortBudget: {
        effort: "Medium",
        allocation: dto.budgetRange || profile?.monthlyBudgetRange || "Unset",
      },
    };
    const safeStrategy = toDbSafeJson(strategy);
    const draft = await this.prisma.growthCampaignDraft.create({
      data: {
        companyId,
        clientId: dto.clientId,
        name: toDbSafeText(dto.name),
        objective: dto.objective ? toDbSafeText(dto.objective) : undefined,
        targetAudience: dto.targetAudience ? toDbSafeText(dto.targetAudience) : undefined,
        productService: dto.productService ? toDbSafeText(dto.productService) : undefined,
        durationDays: dto.durationDays ?? 30,
        budgetRange: dto.budgetRange ? toDbSafeText(dto.budgetRange) : undefined,
        networks: dto.networks ?? [],
        location: dto.location ? toDbSafeText(dto.location) : undefined,
        offer: dto.offer ? toDbSafeText(dto.offer) : undefined,
        strategy: safeStrategy,
        createdById: user.id,
      },
    });
    await this.saveRun(companyId, dto.clientId, user, "CAMPAIGN", dto.name, dto, safeStrategy);
    return draft;
  }

  // ─── Opportunities ────────────────────────────────────────────────────────

  async discoverOpportunities(companyId: string, user: AuthUser, dto: RunGrowthAnalysisDto) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_opportunity_discovery");
    const recent = await this.prisma.growthAnalysisRun.findMany({
      where: { companyId, clientId: dto.clientId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    const rejected = await this.prisma.growthOpportunity.findMany({
      where: { companyId, clientId: dto.clientId, status: "REJECTED" },
      select: { fingerprint: true, title: true },
    });
    const rejectedFp = new Set(rejected.map((r) => r.fingerprint));
    const candidates = this.buildOpportunities(profile, recent).filter((c) => !rejectedFp.has(c.fingerprint));
    const created = [];
    for (const c of candidates) {
      try {
        const row = await this.prisma.growthOpportunity.upsert({
          where: { clientId_fingerprint: { clientId: dto.clientId, fingerprint: c.fingerprint } },
          create: { companyId, clientId: dto.clientId, ...c },
          update: {
            description: c.description,
            evidence: c.evidence,
            whyItMatters: c.whyItMatters,
            recommendedAction: c.recommendedAction,
            expectedOutcome: c.expectedOutcome,
            priority: c.priority,
            confidence: c.confidence,
          },
        });
        created.push(row);
      } catch {
        /* unique race */
      }
    }
    const result = {
      discovered: created.length,
      opportunities: created,
      emptyMessage:
        created.length === 0
          ? "No meaningful new opportunities right now. Complete profile + website/social audits, or wait until new evidence appears."
          : null,
    };
    await this.saveRun(companyId, dto.clientId, user, "OPPORTUNITY_SWEEP", "Opportunity discovery", dto, result);
    return result;
  }

  async listOpportunities(companyId: string, clientId?: string, status?: string) {
    return this.prisma.growthOpportunity.findMany({
      where: {
        companyId,
        ...(clientId ? { clientId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: [{ priority: "asc" }, { discoveredAt: "desc" }],
    });
  }

  async updateOpportunity(
    companyId: string,
    opportunityId: string,
    user: AuthUser,
    dto: UpdateOpportunityDto,
  ) {
    const opp = await this.prisma.growthOpportunity.findFirst({ where: { id: opportunityId, companyId } });
    if (!opp) throw new NotFoundException("Opportunity not found");
    let taskId: string | undefined;
    const updated = await this.prisma.growthOpportunity.update({
      where: { id: opportunityId },
      data: {
        status: dto.status as never,
        feedbackNote: dto.feedbackNote,
      },
    });
    if (dto.status === "CONVERTED_TO_TASK" || dto.status === "APPROVED") {
      const task = await this.prisma.growthTask.create({
        data: {
          companyId,
          clientId: opp.clientId,
          opportunityId: opp.id,
          title: opp.title,
          description: `${opp.recommendedAction || ""}\n\n${opp.description}`.trim(),
          priority: opp.priority,
          assigneeName: opp.suggestedOwner || undefined,
          createdById: user.id,
          status: "TODO",
        },
      });
      taskId = task.id;
      if (dto.status === "APPROVED") {
        await this.prisma.growthOpportunity.update({
          where: { id: opportunityId },
          data: { status: "CONVERTED_TO_TASK" },
        });
      }
    }
    await this.audit(user, companyId, "GROWTH_OPPORTUNITY_UPDATE", "GrowthOpportunity", opportunityId, dto);
    return { opportunity: updated, taskId };
  }

  // ─── Plans / Tasks / Results / Reports ────────────────────────────────────

  async createPlan(companyId: string, user: AuthUser, dto: CreateGrowthPlanDto) {
    const profile = await this.requireProfile(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_plan");
    const horizon = dto.horizonDays ?? 30;
    const plan = await this.prisma.growthPlan.create({
      data: {
        companyId,
        clientId: dto.clientId,
        title: toDbSafeText(dto.title || `${horizon}-day growth plan - ${profile.businessName || "client"}`),
        horizonDays: horizon,
        status: "DRAFT",
        objectives: toDbSafeJson([
          `Strengthen positioning for ${profile.industry || "the category"}`,
          "Improve marketing consistency across connected channels",
          "Ship measurable weekly experiments",
        ]),
        strategies: toDbSafeJson([
          "Fix critical website/CTA gaps",
          "Publish proof-led content weekly",
          "Convert approved opportunities into tasks",
        ]),
        requiredBudget: toDbSafeText(profile.monthlyBudgetRange || "Unset"),
        baselineMetrics: toDbSafeJson({ note: "Capture baseline manually or via Results Tracker snapshots" }),
        targetMetrics: toDbSafeJson({ note: "Define targets after first audits" }),
        successCriteria: toDbSafeJson(["Plan approved", ">=70% tasks done", "One campaign draft executed via approvals"]),
        summary: toDbSafeText(`A ${horizon}-day plan grounded in the business profile and latest Growth Center analyses.`),
        createdById: user.id,
        milestones: {
          create: [
            { title: "Complete audits", sortOrder: 1, dueDate: daysFromNow(7) },
            { title: "Approve top opportunities", sortOrder: 2, dueDate: daysFromNow(14) },
            { title: "Launch campaign draft", sortOrder: 3, dueDate: daysFromNow(Math.min(horizon, 21)) },
            { title: "Review results", sortOrder: 4, dueDate: daysFromNow(horizon) },
          ],
        },
      },
      include: { milestones: true },
    });
    return plan;
  }

  async listPlans(companyId: string, clientId?: string) {
    return this.prisma.growthPlan.findMany({
      where: { companyId, ...(clientId ? { clientId } : {}) },
      include: { milestones: { orderBy: { sortOrder: "asc" } }, _count: { select: { tasks: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updatePlan(companyId: string, planId: string, user: AuthUser, dto: UpdateGrowthPlanDto) {
    const plan = await this.prisma.growthPlan.findFirst({ where: { id: planId, companyId } });
    if (!plan) throw new NotFoundException("Plan not found");
    return this.prisma.growthPlan.update({
      where: { id: planId },
      data: {
        title: dto.title,
        status: dto.status as never,
        objectives: dto.objectives as never,
        strategies: dto.strategies as never,
        summary: dto.summary,
        approvedAt: dto.status === "APPROVED" || dto.status === "ACTIVE" ? new Date() : plan.approvedAt,
      },
      include: { milestones: true },
    });
  }

  async listTasks(companyId: string, clientId?: string) {
    return this.prisma.growthTask.findMany({
      where: { companyId, ...(clientId ? { clientId } : {}) },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
  }

  async createTask(companyId: string, user: AuthUser, dto: CreateGrowthTaskDto) {
    await this.assertClient(companyId, dto.clientId);
    return this.prisma.growthTask.create({
      data: {
        companyId,
        clientId: dto.clientId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority || "MEDIUM",
        assigneeName: dto.assigneeName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        opportunityId: dto.opportunityId,
        planId: dto.planId,
        createdById: user.id,
      },
    });
  }

  async updateTask(companyId: string, taskId: string, dto: UpdateGrowthTaskDto) {
    const task = await this.prisma.growthTask.findFirst({ where: { id: taskId, companyId } });
    if (!task) throw new NotFoundException("Task not found");
    return this.prisma.growthTask.update({
      where: { id: taskId },
      data: {
        status: dto.status as never,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        assigneeName: dto.assigneeName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completionNote: dto.completionNote,
        contentDraft: dto.contentDraft,
      },
    });
  }

  async resultsTracker(companyId: string, clientId: string) {
    await this.assertClient(companyId, clientId);
    const [snapshots, tasks, opportunities, campaigns, socialCount] = await Promise.all([
      this.prisma.growthPerformanceSnapshot.findMany({
        where: { companyId, clientId },
        orderBy: { capturedAt: "desc" },
        take: 12,
      }),
      this.prisma.growthTask.groupBy({
        by: ["status"],
        where: { companyId, clientId },
        _count: { _all: true },
      }),
      this.prisma.growthOpportunity.groupBy({
        by: ["status"],
        where: { companyId, clientId },
        _count: { _all: true },
      }),
      this.prisma.growthCampaignDraft.count({ where: { companyId, clientId } }),
      this.prisma.socialAccount.count({ where: { companyId, clientId, status: "CONNECTED" } }),
    ]);
    return {
      snapshots,
      completedActivities: {
        tasks: Object.fromEntries(tasks.map((t) => [t.status, t._count._all])),
        opportunities: Object.fromEntries(opportunities.map((o) => [o.status, o._count._all])),
        campaigns,
        connectedSocialAccounts: socialCount,
      },
      disclaimer:
        "Results Tracker shows available operational progress. It does not claim AI caused a metric unless evidence is attached in a snapshot note.",
    };
  }

  async addSnapshot(
    companyId: string,
    clientId: string,
    body: { label: string; metrics: Record<string, unknown>; note?: string },
  ) {
    await this.assertClient(companyId, clientId);
    return this.prisma.growthPerformanceSnapshot.create({
      data: {
        companyId,
        clientId,
        label: body.label,
        metrics: body.metrics as object,
        note: body.note,
      },
    });
  }

  async listReports(companyId: string, clientId?: string) {
    return this.prisma.growthReport.findMany({
      where: { companyId, ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async createReport(companyId: string, user: AuthUser, dto: CreateGrowthReportDto) {
    await this.assertClient(companyId, dto.clientId);
    await this.consumeAi(companyId, user, "growth_report");
    const [profile, runs, opportunities, plans] = await Promise.all([
      this.prisma.growthBusinessProfile.findUnique({ where: { clientId: dto.clientId } }),
      this.prisma.growthAnalysisRun.findMany({
        where: { companyId, clientId: dto.clientId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.growthOpportunity.findMany({
        where: { companyId, clientId: dto.clientId },
        take: 20,
        orderBy: { discoveredAt: "desc" },
      }),
      this.prisma.growthPlan.findMany({
        where: { companyId, clientId: dto.clientId },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const content = {
      business: profile,
      analysisPeriod: dto.periodLabel || "Latest available runs",
      keyFindings: runs.slice(0, 5).map((r) => ({ kind: r.kind, title: r.title, at: r.createdAt })),
      recommendations: opportunities.slice(0, 8).map((o) => ({
        title: o.title,
        priority: o.priority,
        action: o.recommendedAction,
        status: o.status,
      })),
      plans: plans.map((p) => ({ id: p.id, title: p.title, status: p.status, horizonDays: p.horizonDays })),
      nextActions: opportunities
        .filter((o) => o.status === "NEW" || o.status === "UNDER_REVIEW")
        .slice(0, 5)
        .map((o) => o.recommendedAction || o.title),
      limitations:
        "Report consolidates Growth Center records only. External analytics are included only when stored as evidence/snapshots.",
    };
    return this.prisma.growthReport.create({
      data: {
        companyId,
        clientId: dto.clientId,
        kind: dto.kind as never,
        title: dto.title || `${dto.kind.replace(/_/g, " ")} report`,
        periodLabel: dto.periodLabel,
        content,
        limitations: content.limitations,
        createdById: user.id,
      },
    });
  }

  async listJobs(companyId: string) {
    return this.prisma.growthJob.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  async listRuns(companyId: string, clientId?: string) {
    return this.prisma.growthAnalysisRun.findMany({
      where: { companyId, ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  async usage(companyId: string) {
    const entitlements = await this.entitlements.getEntitlements(companyId);
    const settings = await this.getAiSettings();
    return {
      settings,
      month: await this.monthUsage(companyId),
      entitlements: entitlements.quotas.ai,
    };
  }

  async getAiSettings() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "growth_ai" } });
    return { ...DEFAULT_AI_SETTINGS, ...((row?.value as object) ?? {}) };
  }

  async isGrowthCenterEnabled() {
    const settings = await this.getAiSettings();
    return Boolean(settings.enabled);
  }

  async updateAiSettings(user: AuthUser, dto: UpdateGrowthAiSettingsDto) {
    if (user.globalRole !== "SUPER_ADMIN") throw new ForbiddenException("Super admin only");
    const current = await this.getAiSettings();
    const value = { ...current, ...dto };
    await this.prisma.systemSetting.upsert({
      where: { key: "growth_ai" },
      create: { key: "growth_ai", value },
      update: { value },
    });
    // Keep System Settings feature flag in sync for a second admin control surface.
    if (typeof dto.enabled === "boolean") {
      const systemRow = await this.prisma.systemSetting.findUnique({ where: { key: "system" } });
      const systemValue = {
        ...(systemRow?.value as object),
        featureFlags: {
          ...(((systemRow?.value as { featureFlags?: Record<string, boolean> } | null)?.featureFlags) ?? {}),
          aiGrowthCenter: dto.enabled,
        },
      };
      await this.prisma.systemSetting.upsert({
        where: { key: "system" },
        create: { key: "system", value: systemValue },
        update: { value: systemValue },
      });
      await this.prisma.featureFlag.upsert({
        where: { key: "aiGrowthCenter" },
        create: { key: "aiGrowthCenter", enabled: dto.enabled, description: "AI Growth Center visibility" },
        update: { enabled: dto.enabled },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "GROWTH_AI_SETTINGS_UPDATED",
        entityType: "SystemSetting",
        entityId: "growth_ai",
        metadata: dto as object,
      },
    });
    return value;
  }

  async adminOverview() {
    const [jobs, usage30, companies] = await Promise.all([
      this.prisma.growthJob.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.aiUsageRecord.aggregate({
        where: {
          feature: { startsWith: "growth_" },
          createdAt: { gte: new Date(Date.now() - 30 * 864e5) },
        },
        _sum: { units: true },
      }),
      this.prisma.growthAnalysisRun.groupBy({
        by: ["companyId"],
        _count: { _all: true },
        orderBy: { _count: { companyId: "desc" } },
        take: 10,
      }),
    ]);
    return {
      settings: await this.getAiSettings(),
      jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count._all])),
      growthUnitsLast30d: usage30._sum.units ?? 0,
      topCompanies: companies,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async requireProfile(companyId: string, clientId: string) {
    await this.assertClient(companyId, clientId);
    let profile = await this.prisma.growthBusinessProfile.findUnique({ where: { clientId } });
    if (!profile) {
      const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
      profile = await this.prisma.growthBusinessProfile.create({
        data: {
          companyId,
          clientId,
          businessName: client.businessName || client.name,
          websiteUrl: client.website,
          industry: client.industry,
          description: client.brandVoice,
        },
      });
    }
    if (!profile.description || profile.description.trim().length < 20) {
      throw new BadRequestException(
        "Complete the business profile description (at least a short paragraph) before running this analysis.",
      );
    }
    return profile;
  }

  private async assertClient(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, companyId, isArchived: false } });
    if (!client) throw new NotFoundException("Client not found in this company");
    return client;
  }

  private async consumeAi(companyId: string, user: AuthUser, feature: string) {
    const settings = await this.getAiSettings();
    if (!settings.enabled) throw new ForbiddenException("AI Growth Center is disabled by admin");
    const entitlements = await this.entitlements.getEntitlements(companyId);
    if (entitlements.quotas.ai.remaining !== null && entitlements.quotas.ai.remaining <= 0) {
      throw new ForbiddenException("AI / analysis quota exceeded for this plan this month");
    }
    const month = await this.monthUsage(companyId);
    if (month.units >= settings.monthlyLimit) {
      throw new ForbiddenException("Monthly Growth AI limit reached");
    }
    await this.prisma.aiUsageRecord.create({
      data: {
        companyId,
        userId: user.id,
        feature,
        provider: settings.provider,
        units: 1,
        metadata: { model: settings.model },
      },
    });
  }

  private async monthUsage(companyId: string) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const agg = await this.prisma.aiUsageRecord.aggregate({
      where: {
        companyId,
        createdAt: { gte: start },
        OR: [{ feature: { startsWith: "growth_" } }, { feature: { in: ["competitor_analysis"] } }],
      },
      _sum: { units: true },
    });
    return { units: agg._sum.units ?? 0, periodStart: start.toISOString() };
  }

  private async saveRun(
    companyId: string,
    clientId: string,
    user: AuthUser,
    kind: "BUSINESS" | "WEBSITE" | "SOCIAL" | "SEO" | "COMPETITOR" | "CAMPAIGN" | "OPPORTUNITY_SWEEP" | "REPORT",
    title: string,
    input: unknown,
    result: unknown,
    evidence?: unknown,
  ) {
    const safeResult = toDbSafeJson(result);
    const limitations =
      typeof safeResult === "object" && safeResult && "limitations" in (safeResult as object)
        ? toDbSafeText(String((safeResult as { limitations?: string }).limitations || ""))
        : undefined;
    return this.prisma.growthAnalysisRun.create({
      data: {
        companyId,
        clientId,
        kind,
        status: "COMPLETED",
        title: toDbSafeText(title),
        input: toDbSafeJson(input) as object,
        result: safeResult as object,
        evidence: evidence != null ? (toDbSafeJson(evidence) as object) : undefined,
        limitations: limitations || undefined,
        provider: "sr-growth",
        units: 1,
        createdById: user.id,
      },
    });
  }

  private buildBusinessAnalysis(profile: {
    businessName: string | null;
    industry: string | null;
    description: string | null;
    productsServices: string | null;
    targetAudience: string | null;
    uniqueSellingPoints: string | null;
    challenges: string | null;
    goals: string | null;
    location: string | null;
  }) {
    const industry = profile.industry || "General business";
    return {
      businessOverview: `${profile.businessName || "This business"} operates in ${industry}. ${profile.description}`,
      businessModel: profile.productsServices
        ? `Offers: ${profile.productsServices}`
        : "Clarify monetisation model (product, service, hybrid, marketplace).",
      productServiceAnalysis: profile.productsServices || "Add products/services to deepen this section.",
      audienceAnalysis: profile.targetAudience || "Define primary buyer personas.",
      painPoints: [
        profile.challenges || "Unclear differentiation in a crowded category",
        "Inconsistent marketing cadence",
        "Weak proof assets on public channels",
      ],
      swot: {
        strengths: [profile.uniqueSellingPoints || "Existing brand presence", profile.location ? `Local foothold: ${profile.location}` : "Flexible delivery"].filter(Boolean),
        weaknesses: [profile.challenges || "Incomplete positioning notes", "Limited documented proof"].filter(Boolean),
        opportunities: [
          "Package offers for clearer conversion paths",
          "Repurpose expertise into authority content",
          "Partner / referral loops",
        ],
        threats: ["Platform algorithm shifts", "Lookalike competitors on price", "Attention fragmentation"],
      },
      positioning: profile.uniqueSellingPoints || "Positioning needs a sharper one-liner.",
      revenueOpportunities: [
        { title: "Offer ladder", why: "Creates upgrade paths", next: "Define starter / core / premium packages" },
        { title: "Retention touches", why: "Cheaper than pure acquisition", next: "Monthly value email or WhatsApp cadence" },
      ],
      newOfferIdeas: ["Complementary add-on service", "Fixed-scope starter package"],
      retentionIdeas: ["Onboarding checklist", "Quarterly business review for key accounts"],
      competitiveAdvantages: [profile.uniqueSellingPoints || "Speed of response", "Specialist niche clarity"].filter(Boolean),
      goalsAlignment: profile.goals || "Add explicit goals to align recommendations.",
    };
  }

  private buildWebsiteIssues(snapshot: Awaited<ReturnType<typeof fetchPublicWebsite>>) {
    const issues: Array<{
      priority: "Critical" | "High" | "Medium" | "Low";
      issue: string;
      evidence: string;
      explanation: string;
      solution: string;
    }> = [];
    if (snapshot.brokenNote) {
      issues.push({
        priority: "Critical",
        issue: "Website did not return a healthy response",
        evidence: snapshot.brokenNote,
        explanation: "Visitors and crawlers may bounce immediately.",
        solution: "Fix hosting/DNS and confirm the URL loads publicly.",
      });
    }
    if (!snapshot.title) {
      issues.push({
        priority: "High",
        issue: "Missing or empty <title>",
        evidence: "No title tag extracted",
        explanation: "Search and browser tabs lack a clear brand signal.",
        solution: "Add a unique title with brand + primary offer.",
      });
    }
    if (!snapshot.description) {
      issues.push({
        priority: "High",
        issue: "Missing meta description",
        evidence: "No description meta found",
        explanation: "Search snippets will be auto-generated and weaker.",
        solution: "Write a 140-160 character benefit-led description.",
      });
    }
    if (!snapshot.hasViewport) {
      issues.push({
        priority: "High",
        issue: "No viewport meta detected",
        evidence: "viewport meta absent in HTML sample",
        explanation: "Mobile layout may be unreliable.",
        solution: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
      });
    }
    if (!snapshot.ctaHints.length) {
      issues.push({
        priority: "Medium",
        issue: "Weak CTA language on page",
        evidence: "No common CTA keywords found in HTML sample",
        explanation: "Visitors may not know the next step.",
        solution: "Add a clear primary CTA above the fold.",
      });
    }
    if (!snapshot.contactHints.length) {
      issues.push({
        priority: "Medium",
        issue: "Contact signals hard to find",
        evidence: "No mailto/tel/contact markers in sample",
        explanation: "Trust and lead conversion suffer.",
        solution: "Expose phone, email, or contact form in header/footer.",
      });
    }
    if (!issues.length) {
      issues.push({
        priority: "Low",
        issue: "No critical on-page faults in the sampled HTML",
        evidence: `Status ${snapshot.status}, title present`,
        explanation: "Continue monitoring content quality and speed with dedicated tools.",
        solution: "Run a deeper content pass and connect analytics for behaviour data.",
      });
    }
    return issues;
  }

  private keywordHints(profile: {
    industry: string | null;
    productsServices: string | null;
    location: string | null;
    businessName: string | null;
  }) {
    const base = [
      profile.industry,
      profile.location,
      ...(profile.productsServices || "").split(/[,/]/).map((s) => s.trim()),
    ]
      .filter(Boolean)
      .slice(0, 8) as string[];
    if (!base.length) return ["brand awareness content", "local service keywords", "category education topics"];
    return base.map((b) => `${b}`.slice(0, 60));
  }

  private buildOpportunities(
    profile: {
      businessName: string | null;
      websiteUrl: string | null;
      challenges: string | null;
      goals: string | null;
      uniqueSellingPoints: string | null;
      monthlyBudgetRange: string | null;
    },
    runs: Array<{ kind: string; result: unknown }>,
  ) {
    const out: Array<{
      title: string;
      description: string;
      evidence: string;
      whyItMatters: string;
      recommendedAction: string;
      expectedOutcome: string;
      priority: string;
      confidence: string;
      estimatedEffort: string;
      successMetric: string;
      suggestedOwner: string;
      sourceKind: "BUSINESS" | "WEBSITE" | "SOCIAL" | "SEO" | null;
      fingerprint: string;
    }> = [];

    const push = (item: Omit<(typeof out)[number], "fingerprint"> & { key: string }) => {
      const { key, ...rest } = item;
      out.push({
        ...rest,
        fingerprint: createHash("sha1").update(key).digest("hex").slice(0, 24),
      });
    };

    if (!profile.websiteUrl) {
      push({
        key: "missing-website",
        title: "Add and verify a public website URL",
        description: "Growth audits need a reachable site to measure on-page SEO and CTA quality.",
        evidence: "Business profile websiteUrl is empty",
        whyItMatters: "Without a site, SEO and website opportunity discovery stay blocked.",
        recommendedAction: "Update Growth profile with the live HTTPS URL, then run Website Audit.",
        expectedOutcome: "Unlocked website + SEO analyses with evidence links",
        priority: "HIGH",
        confidence: "HIGH",
        estimatedEffort: "Low",
        successMetric: "Website audit completed with HTTP 200",
        suggestedOwner: "Client",
        sourceKind: "BUSINESS",
      });
    }

    if (profile.challenges) {
      push({
        key: `challenge:${profile.challenges.slice(0, 80)}`,
        title: "Attack the stated business challenge",
        description: profile.challenges,
        evidence: "Listed in business profile challenges",
        whyItMatters: "Goals stall when the main friction is ignored.",
        recommendedAction: "Turn this challenge into a 2-week experiment with one owner and one KPI.",
        expectedOutcome: "Visible progress against the client’s own stated pain",
        priority: "HIGH",
        confidence: "MEDIUM",
        estimatedEffort: "Medium",
        successMetric: "Challenge-linked task marked DONE with completion note",
        suggestedOwner: "Company manager",
        sourceKind: "BUSINESS",
      });
    }

    const websiteRun = runs.find((r) => r.kind === "WEBSITE");
    const websiteResult = websiteRun?.result as { issues?: Array<{ priority: string; issue: string; solution: string }> } | undefined;
    for (const issue of websiteResult?.issues || []) {
      if (issue.priority === "Critical" || issue.priority === "High") {
        push({
          key: `web:${issue.issue}`,
          title: `Fix website: ${issue.issue}`,
          description: issue.solution,
          evidence: `Website audit flagged ${issue.priority} issue`,
          whyItMatters: "Critical/high website faults leak demand before ads or social can help.",
          recommendedAction: issue.solution,
          expectedOutcome: "Cleaner first impression and better crawl clarity",
          priority: issue.priority === "Critical" ? "CRITICAL" : "HIGH",
          confidence: "HIGH",
          estimatedEffort: "Low-Medium",
          successMetric: "Re-run website audit shows issue cleared",
          suggestedOwner: "Client web owner",
          sourceKind: "WEBSITE",
        });
      }
    }

    const socialRun = runs.find((r) => r.kind === "SOCIAL");
    const socialResult = socialRun?.result as { accounts?: unknown[] } | undefined;
    if (socialResult && Array.isArray(socialResult.accounts) && socialResult.accounts.length === 0) {
      push({
        key: "connect-social",
        title: "Connect at least one social account",
        description: "Social audit found zero connected accounts for this client.",
        evidence: "Social audit accounts list empty",
        whyItMatters: "Execution and measurement need authorised connections.",
        recommendedAction: "Connect Facebook/Instagram/LinkedIn/X/etc. from Social Accounts, then re-run Social Audit.",
        expectedOutcome: "Authorised publishing path + richer audits",
        priority: "HIGH",
        confidence: "HIGH",
        estimatedEffort: "Low",
        successMetric: ">=1 CONNECTED social account",
        suggestedOwner: "Client",
        sourceKind: "SOCIAL",
      });
    }

    if (profile.uniqueSellingPoints) {
      push({
        key: `usp-content:${profile.uniqueSellingPoints.slice(0, 60)}`,
        title: "Ship USP-led proof content",
        description: "Translate unique selling points into weekly proof posts and a landing block.",
        evidence: `USP on profile: ${profile.uniqueSellingPoints}`,
        whyItMatters: "Differentiation only works when buyers see it repeatedly.",
        recommendedAction: "Create 3 posts via Create Post using USP angles; send through Approval Inbox.",
        expectedOutcome: "Clearer brand memory and higher save/share potential",
        priority: "MEDIUM",
        confidence: "MEDIUM",
        estimatedEffort: "Medium",
        successMetric: "3 USP posts published or approved",
        suggestedOwner: "Company creative",
        sourceKind: "BUSINESS",
      });
    }

    if (!out.length) {
      push({
        key: "maintain-cadence",
        title: "Maintain a measured weekly marketing cadence",
        description: "No urgent gaps detected from current evidence. Keep shipping and logging results.",
        evidence: "Opportunity sweep found no critical gaps",
        whyItMatters: "Consistency compounds more than one-off bursts.",
        recommendedAction: "Schedule 3 posts this week and capture a Results Tracker snapshot.",
        expectedOutcome: "Stable operating rhythm",
        priority: "LOW",
        confidence: "MEDIUM",
        estimatedEffort: "Low",
        successMetric: "Weekly snapshot saved",
        suggestedOwner: "Company manager",
        sourceKind: null,
      });
    }

    return out;
  }

  private async audit(
    user: AuthUser,
    companyId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: object,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId,
        action,
        entityType,
        entityId,
        metadata: metadata as object,
      },
    });
  }
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
