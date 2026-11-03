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
export class CompanyAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthUser;
      params: { companyId?: string };
      companyMembership?: unknown;
    }>();
    const companyId = request.params.companyId;
    if (!companyId) {
      throw new ForbiddenException("companyId is required");
    }

    if (request.user.globalRole === "SUPER_ADMIN") {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundException("Company not found");
      request.companyMembership = { role: "OWNER", company };
      return true;
    }

    const membership = await this.prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId: request.user.id },
      },
      include: { company: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No access to this company workspace");
    }
    if (membership.company.status === "SUSPENDED" || membership.company.status === "CANCELLED") {
      throw new ForbiddenException("Company workspace is not active");
    }

    request.companyMembership = membership;
    return true;
  }
}
