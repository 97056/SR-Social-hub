import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { EntitlementsService } from "../billing/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CompetitorAnalysisDto } from "./dto/analysis.dto";

export type CompetitorCard = {
  name: string;
  why: string;
  likelyChannels: string[];
  contentAngle: string;
  strength: "strong" | "moderate" | "emerging";
};

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async competitorLandscape(companyId: string, user: AuthUser, dto: CompetitorAnalysisDto) {
    await this.assertCompanyAccess(companyId, user);
    const e = await this.entitlements.getEntitlements(companyId);
    if (e.quotas.ai.remaining <= 0) {
      throw new ForbiddenException("AI / analysis quota exceeded for this plan this month");
    }

    let industry = dto.industry?.trim() || "";
    let website = dto.websiteUrl?.trim() || "";
    let description = dto.businessDescription.trim();
    let clientName: string | null = null;

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, companyId, isArchived: false },
      });
      if (!client) throw new BadRequestException("Client not found in this company");
      clientName = client.businessName || client.name;
      industry = industry || client.industry || "";
      website = website || client.website || "";
      if (!description && client.brandVoice) {
        description = `${client.name} — ${client.brandVoice}`;
      }
    }

    if (description.length < 20) {
      throw new BadRequestException(
        "Add a clearer business description (at least a couple of sentences) so we can map competitors.",
      );
    }

    const websiteSnapshot = website ? await this.safeFetchWebsiteSignals(website) : null;
    const signals = this.inferSignals(description, industry, websiteSnapshot);
    const competitors = this.buildCompetitors(signals);
    const channelGaps = this.buildChannelGaps(signals);
    const nextActions = this.buildNextActions(signals, competitors);

    await this.prisma.aiUsageRecord.create({
      data: {
        companyId,
        userId: user.id,
        feature: "competitor_analysis",
        provider: "sr-analysis",
        units: 1,
        metadata: {
          clientId: dto.clientId ?? null,
          industry: signals.industry,
          website: website || null,
        },
      },
    });

    const usage = await this.entitlements.getEntitlements(companyId);

    return {
      generatedAt: new Date().toISOString(),
      clientName,
      summary: this.buildSummary(signals, competitors),
      brandSignals: signals,
      websiteSnapshot,
      competitors,
      channelGaps,
      nextActions,
      disclaimer:
        "This landscape is a planning aid based on your description and public website signals. It is not scraped competitor analytics, not a guarantee of rankings, and not legal or financial advice. Validate every competitor before acting.",
      usage: usage.quotas.ai,
    };
  }

  private inferSignals(
    description: string,
    industry: string,
    website: { title: string | null; description: string | null; headings: string[] } | null,
  ) {
    const blob = `${description} ${industry} ${website?.title ?? ""} ${website?.description ?? ""} ${website?.headings.join(" ")}`.toLowerCase();
    const detectedIndustry =
      industry ||
      (/\b(real estate|property|housing)\b/.test(blob)
        ? "Real estate"
        : /\b(fashion|apparel|clothing|boutique)\b/.test(blob)
          ? "Fashion & retail"
          : /\b(food|restaurant|cafe|cloud kitchen)\b/.test(blob)
            ? "Food & hospitality"
            : /\b(saas|software|app|platform)\b/.test(blob)
              ? "Software / SaaS"
              : /\b(education|coaching|course|training)\b/.test(blob)
                ? "Education & coaching"
                : /\b(agency|marketing|branding)\b/.test(blob)
                  ? "Marketing agency"
                  : /\b(health|clinic|wellness|fitness)\b/.test(blob)
                    ? "Health & wellness"
                    : "General consumer brand");

    const audience = /\b(b2b|enterprise|agenc(y|ies)|wholesale)\b/.test(blob)
      ? "Business buyers / partners"
      : /\b(gen z|students|young)\b/.test(blob)
        ? "Younger consumers"
        : "Local and online customers";

    const positioning = /\b(premium|luxury|exclusive)\b/.test(blob)
      ? "Premium / quality-led"
      : /\b(affordable|budget|value)\b/.test(blob)
        ? "Value / accessible"
        : /\b(fast|same.?day|quick)\b/.test(blob)
          ? "Speed / convenience"
          : "Trust and clarity led";

    const primaryChannels = [
      "Instagram",
      "Facebook",
      detectedIndustry.includes("Software") || detectedIndustry.includes("agency")
        ? "LinkedIn"
        : "YouTube",
      "Threads",
      detectedIndustry.includes("Fashion") || detectedIndustry.includes("Food")
        ? "Pinterest"
        : "X",
    ];

    return {
      industry: detectedIndustry,
      audience,
      positioning,
      primaryChannels,
      keywords: this.extractKeywords(blob),
    };
  }

  private extractKeywords(blob: string) {
    const stop = new Set([
      "the",
      "and",
      "for",
      "with",
      "that",
      "this",
      "from",
      "your",
      "our",
      "are",
      "was",
      "have",
      "will",
      "into",
      "about",
      "based",
      "their",
      "they",
      "them",
      "http",
      "https",
      "www",
    ]);
    const counts = new Map<string, number>();
    for (const raw of blob.split(/[^a-z0-9]+/g)) {
      if (raw.length < 4 || stop.has(raw)) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);
  }

  private buildCompetitors(signals: {
    industry: string;
    audience: string;
    positioning: string;
    primaryChannels: string[];
    keywords: string[];
  }): CompetitorCard[] {
    const niche = signals.industry;
    const kw = signals.keywords[0] || niche.split(" ")[0] || "category";
    return [
      {
        name: `${niche} category leaders`,
        why: `Established brands already own search and social attention in ${niche}. They set the creative bar your posts will be compared against.`,
        likelyChannels: signals.primaryChannels.slice(0, 4),
        contentAngle: "Polished product proof, offers, and frequent launches",
        strength: "strong",
      },
      {
        name: `Regional ${kw} specialists`,
        why: `Local or regional players often win on trust, WhatsApp response, and location-specific offers — especially if your audience is ${signals.audience.toLowerCase()}.`,
        likelyChannels: ["Instagram", "Facebook", "YouTube", "WhatsApp / status"],
        contentAngle: "Community stories, testimonials, and city-specific campaigns",
        strength: "moderate",
      },
      {
        name: `${signals.positioning} challenger brands`,
        why: `Brands with a similar ${signals.positioning.toLowerCase()} stance will compete for the same creative formats and hashtags.`,
        likelyChannels: signals.primaryChannels,
        contentAngle: "Sharp positioning hooks and comparison-style content",
        strength: "moderate",
      },
      {
        name: "Creator / influencer substitutes",
        why: "Independent creators can siphon discovery even when they are not direct business rivals.",
        likelyChannels: ["Instagram", "YouTube", "Threads", "X"],
        contentAngle: "Personality-led tutorials and behind-the-scenes clips",
        strength: "emerging",
      },
      {
        name: "Marketplace & aggregator listings",
        why: "When buyers compare options on marketplaces, those listing pages become de-facto competitors for attention.",
        likelyChannels: ["Google", "Marketplace apps", "Facebook"],
        contentAngle: "Reviews, ratings, and offer stacking",
        strength: "strong",
      },
    ];
  }

  private buildChannelGaps(signals: { primaryChannels: string[]; industry: string }) {
    return [
      {
        channel: "Instagram",
        opportunity: "Weekly Reels + Stories that show process, not only finished offers.",
      },
      {
        channel: "YouTube / short video",
        opportunity: `Explainers for ${signals.industry} buyers who research before they message you.`,
      },
      {
        channel: "LinkedIn",
        opportunity:
          signals.industry.includes("Software") || signals.industry.includes("agency")
            ? "Thought leadership and case studies for B2B trust."
            : "Partner / hiring / brand-authority posts if you sell to businesses.",
      },
      {
        channel: "Pinterest",
        opportunity: "Evergreen pins for visual discovery if your offer is image-led.",
      },
      {
        channel: "Threads / X",
        opportunity: "Fast commentary and customer Q&A to stay present between big posts.",
      },
    ];
  }

  private buildNextActions(
    signals: { industry: string; primaryChannels: string[] },
    competitors: CompetitorCard[],
  ) {
    return [
      `List 5 named competitors in ${signals.industry} and save their Instagram + YouTube handles.`,
      `Compare posting cadence on ${signals.primaryChannels[0]} vs the strongest competitor card (${competitors[0]?.name}).`,
      "Turn one competitor content theme into an original series — do not copy captions or creatives.",
      "Publish 3 proof posts (review, before/after, or process) in the next 14 days.",
      "Connect the priority networks in Social Accounts so scheduling can match this plan.",
    ];
  }

  private buildSummary(
    signals: { industry: string; audience: string; positioning: string },
    competitors: CompetitorCard[],
  ) {
    return `Based on your description, you sit in ${signals.industry} with a ${signals.positioning.toLowerCase()} stance for ${signals.audience.toLowerCase()}. The competitive set is less about one brand and more about ${competitors.length} pressure sources — category leaders, regional specialists, positioning peers, creators, and marketplaces. Use the channel gaps below to decide where SR Social Hub should prioritize publishing first.`;
  }

  private async safeFetchWebsiteSignals(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    } catch {
      throw new BadRequestException("Website URL looks invalid");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new BadRequestException("Only http/https website URLs are allowed");
    }
    if (
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/i.test(url.hostname) ||
      url.hostname.endsWith(".local")
    ) {
      throw new BadRequestException("That website host is not allowed");
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "SRSocialHubAnalysis/1.0 (+https://srsocialhub.in)" },
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          url: url.toString(),
          title: null,
          description: null,
          headings: [] as string[],
          note: `Website responded with ${res.status}; analysis continues from your description.`,
        };
      }
      const html = (await res.text()).slice(0, 200_000);
      const title = this.matchMeta(html, /<title[^>]*>([^<]*)<\/title>/i);
      const description =
        this.matchMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        this.matchMeta(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
      const headings = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .slice(0, 5);
      return {
        url: url.toString(),
        title,
        description,
        headings,
        note: null as string | null,
      };
    } catch {
      return {
        url: url.toString(),
        title: null,
        description: null,
        headings: [] as string[],
        note: "Could not fetch the website right now; analysis continues from your description.",
      };
    }
  }

  private matchMeta(html: string, re: RegExp) {
    const m = html.match(re);
    return m?.[1]?.replace(/\s+/g, " ").trim() || null;
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
