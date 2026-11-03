import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../auth/jwt.strategy";

@Injectable()
export class ClientAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthUser;
      params: { clientId?: string };
      clientAccess?: unknown;
    }>();
    const clientId = request.params.clientId;
    if (!clientId) {
      throw new ForbiddenException("clientId is required");
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.isArchived) {
      throw new NotFoundException("Client workspace not found");
    }

    if (request.user.globalRole === "SUPER_ADMIN") {
      request.clientAccess = { via: "SUPER_ADMIN", client };
      return true;
    }

    const clientMembership = await this.prisma.clientMember.findUnique({
      where: { clientId_userId: { clientId, userId: request.user.id } },
    });
    if (clientMembership?.status === "ACTIVE") {
      request.clientAccess = { via: "CLIENT_MEMBER", client, membership: clientMembership };
      return true;
    }

    const companyMembership = await this.prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId: client.companyId, userId: request.user.id },
      },
    });
    if (companyMembership?.status === "ACTIVE") {
      request.clientAccess = { via: "COMPANY_MEMBER", client, membership: companyMembership };
      return true;
    }

    throw new ForbiddenException("No access to this client workspace");
  }
}
