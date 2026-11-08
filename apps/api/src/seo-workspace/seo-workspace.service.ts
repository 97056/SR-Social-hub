import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildFullSitemap,
  buildRobotsTxt,
  deepAnalyzeWebsite,
  normalizeWebsiteUrl,
  resolveReachableWebsite,
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
      include: { growthProfile: { select: { id: true, websiteUrl: true } } },
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
      client,
      website: normalized,
    };
  }

  /** When DNS typo is auto-fixed (path2carrer → path2career), persist the working URL. */
  private async persistCorrectedWebsite(
    client: { id: string; website: string | null; growthProfile: { id: string; websiteUrl: string | null } | null },
    correctedUrl: string,
  ) {
    const updates: Promise<unknown>[] = [];
    if (client.website) {
      updates.push(this.prisma.client.update({ where: { id: client.id }, data: { website: correctedUrl } }));
    }
    if (client.growthProfile?.websiteUrl) {
      updates.push(
        this.prisma.growthBusinessProfile.update({
          where: { id: client.growthProfile.id },
          data: { websiteUrl: correctedUrl },
        }),
      );
    }
    if (!client.website && !client.growthProfile?.websiteUrl) {
      updates.push(this.prisma.client.update({ where: { id: client.id }, data: { website: correctedUrl } }));
    }
    await Promise.all(updates);
  }

  async analyze(companyId: string, user: AuthUser, clientId: string) {
    const { client, website } = await this.requireClientWebsite(companyId, clientId);
    try {
      const { snapshot, seo, resolvedFrom, correctionNote } = await deepAnalyzeWebsite(website);
      if (resolvedFrom) {
        await this.persistCorrectedWebsite(client, snapshot.finalUrl);
      }
      await this.audit(user, companyId, "SEO_WORKSPACE_ANALYZE", client.id, {
        website: snapshot.finalUrl,
        resolvedFrom: resolvedFrom || null,
      });
      return {
        client: {
          id: client.id,
          name: client.businessName || client.name,
          website: snapshot.finalUrl,
          industry: client.industry,
        },
        website: snapshot.finalUrl,
        resolvedFrom: resolvedFrom || null,
        correctionNote: correctionNote || null,
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
      if (result.resolvedFrom) {
        await this.persistCorrectedWebsite(client, result.baseUrl);
      }
      await this.audit(user, companyId, "SEO_WORKSPACE_SITEMAP", client.id, {
        website: result.baseUrl,
        urls: result.urls.length,
        complete: result.complete,
        resolvedFrom: result.resolvedFrom || null,
      });
      return {
        client: {
          id: client.id,
          name: client.businessName || client.name,
          website: result.baseUrl,
        },
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
    try {
      const resolved = await resolveReachableWebsite(website);
      if (resolved.corrected) {
        await this.persistCorrectedWebsite(client, resolved.origin);
      }
      const robotsTxt = buildRobotsTxt(resolved.origin);
      await this.audit(user, companyId, "SEO_WORKSPACE_ROBOTS", client.id, { website: resolved.origin });
      return {
        client: {
          id: client.id,
          name: client.businessName || client.name,
          website: resolved.origin,
        },
        origin: resolved.origin,
        robotsTxt,
        sitemapHint: `${resolved.origin}/sitemap.xml`,
        correctionNote: resolved.correctionNote,
        note: "Download and upload robots.txt to your website document root. Adjust Disallow paths for your stack before publishing.",
      };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "robots.txt generation failed");
    }
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
