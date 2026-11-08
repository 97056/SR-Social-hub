import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildFullSitemap,
  buildRobotsTxt,
  deepAnalyzeWebsite,
  normalizeWebsiteUrl,
  SEO_CRAWL_MAX_URLS,
} from "./seo-crawl.util";

@Injectable()
export class SeoWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listClientSites(companyId: string) {
    const clients = await this.prisma.client.findMany({
      where: { companyId, isArchived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        businessName: true,
        website: true,
        industry: true,
        growthProfile: { select: { websiteUrl: true } },
      },
    });

    return {
      clients: clients
        .map((c) => {
          const website = (c.website || c.growthProfile?.websiteUrl || "").trim() || null;
          return {
            id: c.id,
            name: c.businessName || c.name,
            website,
            industry: c.industry,
            eligible: Boolean(website),
          };
        })
        .filter((c) => c.eligible),
      note: "Only clients with a website URL on the client profile (or Growth profile) are listed.",
    };
  }

  private async requireClientWebsite(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, isArchived: false },
      include: { growthProfile: { select: { websiteUrl: true } } },
    });
    if (!client) throw new NotFoundException("Client not found in this company");
    const website = (client.website || client.growthProfile?.websiteUrl || "").trim();
    if (!website) {
      throw new BadRequestException("This client has no website URL. Add it on the Clients page first.");
    }
    let normalized: string;
    try {
      normalized = normalizeWebsiteUrl(website);
    } catch {
      throw new BadRequestException("Client website URL is invalid");
    }
    return {
      client: {
        id: client.id,
        name: client.businessName || client.name,
        website: normalized,
        industry: client.industry,
      },
      website: normalized,
    };
  }

  async analyze(companyId: string, user: AuthUser, clientId: string) {
    const { client, website } = await this.requireClientWebsite(companyId, clientId);
    try {
      const { snapshot, seo } = await deepAnalyzeWebsite(website);
      await this.audit(user, companyId, "SEO_WORKSPACE_ANALYZE", client.id, { website: snapshot.finalUrl });
      return {
        client,
        website: snapshot.finalUrl,
        analysis: seo,
        snapshot: {
          title: snapshot.title,
          description: snapshot.description,
          headings: snapshot.headings,
          status: snapshot.status,
          hasViewport: snapshot.hasViewport,
          ctaHints: snapshot.ctaHints,
          contactHints: snapshot.contactHints,
        },
      };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Website analysis failed");
    }
  }

  async generateSitemap(companyId: string, user: AuthUser, clientId: string) {
    const { client, website } = await this.requireClientWebsite(companyId, clientId);
    try {
      const result = await buildFullSitemap(website);
      await this.audit(user, companyId, "SEO_WORKSPACE_SITEMAP", client.id, {
        website: result.baseUrl,
        urls: result.urls.length,
        complete: result.complete,
      });
      return {
        client,
        ...result,
        honesty: {
          unlimitedClaim: false,
          maxUrls: SEO_CRAWL_MAX_URLS,
          explanation:
            "A 100% unlimited sitemap of every possible internet URL for a site is not achievable (JS-only routes, infinite filters, auth pages, bot blocks). This generator imports existing sitemaps and crawls all discoverable same-host HTML links up to the safety ceiling, which is the correct production approach.",
        },
      };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Sitemap generation failed");
    }
  }

  async generateRobots(companyId: string, user: AuthUser, clientId: string) {
    const { client, website } = await this.requireClientWebsite(companyId, clientId);
    let origin: string;
    try {
      origin = new URL(normalizeWebsiteUrl(website)).origin;
    } catch {
      throw new BadRequestException("Invalid website URL");
    }
    const robotsTxt = buildRobotsTxt(origin);
    await this.audit(user, companyId, "SEO_WORKSPACE_ROBOTS", client.id, { website: origin });
    return {
      client,
      origin,
      robotsTxt,
      sitemapHint: `${origin}/sitemap.xml`,
      note: "Download and upload robots.txt to your website document root. Adjust Disallow paths for your stack before publishing.",
    };
  }

  private async audit(user: AuthUser, companyId: string, action: string, entityId: string, metadata?: object) {
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId,
        action,
        entityType: "Client",
        entityId,
        metadata: (metadata || {}) as object,
      },
    });
  }
}
