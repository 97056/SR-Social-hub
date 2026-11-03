import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: {
    userId: string;
    companyId?: string | null;
    clientId?: string | null;
    type: string;
    title: string;
    body: string;
    href?: string;
    metadata?: Record<string, unknown>;
    dedupeKey: string;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: input.userId,
          companyId: input.companyId ?? null,
          clientId: input.clientId ?? null,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          dedupeKey: input.dedupeKey,
          emailStatus: process.env.EMAIL_NOTIFICATIONS === "true" ? "QUEUED" : "SKIPPED",
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
      }
      throw err;
    }
  }

  async notifyCompanyMembers(
    companyId: string,
    input: Omit<Parameters<NotificationsService["notify"]>[0], "userId" | "companyId"> & {
      roles?: string[];
    },
  ) {
    const members = await this.prisma.companyMember.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        ...(input.roles?.length ? { role: { in: input.roles as never[] } } : {}),
      },
      select: { userId: true },
    });
    const created = [];
    for (const m of members) {
      created.push(
        await this.notify({
          ...input,
          userId: m.userId,
          companyId,
          dedupeKey: `${input.dedupeKey}:user:${m.userId}`,
        }),
      );
    }
    return created;
  }

  async listForUser(user: AuthUser, opts?: { unreadOnly?: boolean; take?: number }) {
    return this.prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(opts?.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 50,
    });
  }

  async unreadCount(user: AuthUser) {
    return this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
  }

  async markRead(id: string, user: AuthUser) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw new NotFoundException("Notification not found");
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
