import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async companyOverview(companyId: string, user: AuthUser, days = 30) {
    await this.assertCompanyAccess(companyId, user);
    const since = new Date(Date.now() - days * 86400000);

    const [posts, jobs, byPlatform, campaigns] = await Promise.all([
      this.prisma.contentPost.groupBy({
        by: ["status"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.publishingJob.groupBy({
        by: ["status"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.publishingJob.groupBy({
        by: ["platformCode", "status"],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.campaign.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          _count: { select: { posts: true } },
        },
        take: 20,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const postTotal = posts.reduce((s, p) => s + p._count._all, 0);
    const published = posts.find((p) => p.status === "PUBLISHED")?._count._all ?? 0;
    const failedPosts = posts.find((p) => p.status === "FAILED")?._count._all ?? 0;
    const jobPublished = jobs.find((j) => j.status === "PUBLISHED")?._count._all ?? 0;
    const jobFailed = jobs.find((j) => j.status === "FAILED")?._count._all ?? 0;
    const jobTotal = jobs.reduce((s, j) => s + j._count._all, 0);

    const platformMap = new Map<string, { published: number; failed: number; total: number }>();
    for (const row of byPlatform) {
      const cur = platformMap.get(row.platformCode) ?? { published: 0, failed: 0, total: 0 };
      cur.total += row._count._all;
      if (row.status === "PUBLISHED") cur.published += row._count._all;
      if (row.status === "FAILED") cur.failed += row._count._all;
      platformMap.set(row.platformCode, cur);
    }

    return {
      rangeDays: days,
      posts: {
        total: postTotal,
        published,
        failed: failedPosts,
        byStatus: posts.map((p) => ({ status: p.status, count: p._count._all })),
      },
      publishing: {
        totalJobs: jobTotal,
        published: jobPublished,
        failed: jobFailed,
        successRate:
          jobPublished + jobFailed > 0
            ? Number((jobPublished / (jobPublished + jobFailed)).toFixed(3))
            : null,
        byStatus: jobs.map((j) => ({ status: j.status, count: j._count._all })),
        byPlatform: [...platformMap.entries()].map(([platformCode, v]) => ({
          platformCode,
          ...v,
          successRate:
            v.published + v.failed > 0
              ? Number((v.published / (v.published + v.failed)).toFixed(3))
              : null,
        })),
      },
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        posts: c._count.posts,
      })),
      externalMetrics: {
        impressions: { available: false, value: null, note: "Requires live provider insights" },
        reach: { available: false, value: null, note: "Requires live provider insights" },
        engagement: { available: false, value: null, note: "Requires live provider insights" },
        videoViews: { available: false, value: null, note: "Requires live provider insights" },
      },
      note: "Internal metrics only. Provider impressions/reach are shown as unavailable until authorized APIs return them.",
    };
  }

  async clientOverview(clientId: string, user: AuthUser, days = 30) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException("Client not found");
    await this.assertCompanyAccess(client.companyId, user);

    const since = new Date(Date.now() - days * 86400000);
    const [posts, jobs] = await Promise.all([
      this.prisma.contentPost.groupBy({
        by: ["status"],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.publishingJob.groupBy({
        by: ["status"],
        where: { clientId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const published = jobs.find((j) => j.status === "PUBLISHED")?._count._all ?? 0;
    const failed = jobs.find((j) => j.status === "FAILED")?._count._all ?? 0;

    return {
      clientId,
      clientName: client.name,
      rangeDays: days,
      posts: posts.map((p) => ({ status: p.status, count: p._count._all })),
      publishing: {
        published,
        failed,
        successRate:
          published + failed > 0 ? Number((published / (published + failed)).toFixed(3)) : null,
      },
      externalMetrics: {
        impressions: { available: false, value: null },
        reach: { available: false, value: null },
        engagement: { available: false, value: null },
      },
      note: "Internal metrics only. External engagement is unavailable without provider insights.",
    };
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
