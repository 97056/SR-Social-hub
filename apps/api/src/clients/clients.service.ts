import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntitlementsService } from "../billing/entitlements.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async createForCompany(companyId: string, actor: AuthUser, dto: CreateClientDto) {
    if (actor.globalRole !== "SUPER_ADMIN") {
      const membership = await this.prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: actor.id } },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new ForbiddenException("Only company managers can create clients");
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) throw new NotFoundException("Company not found");

    await this.entitlements.assertCanCreateClient(companyId);

    try {
      const client = await this.prisma.client.create({
        data: {
          companyId,
          name: dto.name,
          externalCode: dto.externalCode,
          industry: dto.industry,
          contactEmail: dto.contactEmail,
          timezone: dto.timezone ?? company.timezone,
          brandVoice: dto.brandVoice,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          companyId,
          action: "CLIENT_CREATED",
          entityType: "Client",
          entityId: client.id,
          metadata: { name: client.name },
        },
      });

      return client;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Client external code already exists for this company");
      }
      throw error;
    }
  }

  async getWorkspace(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        company: { select: { id: true, name: true } },
        members: {
          where: { status: "ACTIVE" },
          include: { user: { select: { email: true, fullName: true } } },
        },
        _count: { select: { members: true } },
      },
    });
    if (!client || client.isArchived) throw new NotFoundException("Client not found");

    return {
      client: {
        id: client.id,
        name: client.name,
        companyId: client.companyId,
        companyName: client.company.name,
        industry: client.industry,
        timezone: client.timezone,
        approvalWorkflow: client.approvalWorkflow,
        brandVoice: client.brandVoice,
        memberCount: client._count.members,
        members: client.members.map((m) => ({
          role: m.role,
          email: m.user.email,
          fullName: m.user.fullName,
        })),
      },
      dashboard: {
        awaitingApproval: 0,
        scheduledPosts: 0,
        publishedPosts: 0,
        connectedAccounts: 0,
      },
    };
  }

  async update(clientId: string, actor: AuthUser, dto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.isArchived) throw new NotFoundException("Client not found");

    if (actor.globalRole !== "SUPER_ADMIN") {
      const membership = await this.prisma.companyMember.findUnique({
        where: {
          companyId_userId: { companyId: client.companyId, userId: actor.id },
        },
      });
      if (!membership || !["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        throw new ForbiddenException("Only company managers can update clients");
      }
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: dto,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        companyId: client.companyId,
        action: "CLIENT_UPDATED",
        entityType: "Client",
        entityId: clientId,
        metadata: dto as object,
      },
    });

    return updated;
  }
}
