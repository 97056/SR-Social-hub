import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { GlobalRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import type { LoginResponse } from "@sr/shared";
import { hashToken } from "../common/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./jwt.strategy";
import type { AcceptInviteDto } from "./dto/accept-invite.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, adminOnly = false): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        companyMemberships: {
          where: { status: "ACTIVE" },
          include: { company: true },
        },
        clientMemberships: {
          where: { status: "ACTIVE" },
          include: { client: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (adminOnly && user.globalRole !== GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException("Super admin credentials required");
    }

    if (!adminOnly && user.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException("Use the super admin login portal");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
    });

    const refreshRaw = randomBytes(48).toString("hex");
    const refreshHash = createHash("sha256").update(refreshRaw).digest("hex");
    const refreshTtlDays = 7;
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: adminOnly ? "AUTH_ADMIN_LOGIN" : "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id,
      },
    });

    const companies = user.companyMemberships
      .filter((m) => m.company.status !== "SUSPENDED" && m.company.status !== "CANCELLED")
      .map((m) => ({
        id: m.companyId,
        name: m.company.name,
        role: m.role as LoginResponse["workspaces"]["companies"][number]["role"],
      }));

    const clients = user.clientMemberships
      .filter((m) => !m.client.isArchived)
      .map((m) => ({
        id: m.clientId,
        name: m.client.name,
        companyId: m.client.companyId,
        role: m.role as LoginResponse["workspaces"]["clients"][number]["role"],
      }));

    const redirectTo = this.resolveRedirect({
      isSuperAdmin: user.globalRole === GlobalRole.SUPER_ADMIN,
      companies,
      clients,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        globalRole: user.globalRole as LoginResponse["user"]["globalRole"],
      },
      workspaces: {
        isSuperAdmin: user.globalRole === GlobalRole.SUPER_ADMIN,
        companies,
        clients,
      },
      redirectTo,
    };
  }

  async me(user: AuthUser) {
    const [companyMemberships, clientMemberships] = await Promise.all([
      this.prisma.companyMember.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        include: { company: true },
      }),
      this.prisma.clientMember.findMany({
        where: { userId: user.id, status: "ACTIVE" },
        include: { client: true },
      }),
    ]);

    return {
      user,
      workspaces: {
        isSuperAdmin: user.globalRole === "SUPER_ADMIN",
        companies: companyMemberships.map((m) => ({
          id: m.companyId,
          name: m.company.name,
          role: m.role,
          status: m.company.status,
        })),
        clients: clientMemberships
          .filter((m) => !m.client.isArchived)
          .map((m) => ({
            id: m.clientId,
            name: m.client.name,
            companyId: m.client.companyId,
            role: m.role,
          })),
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!invitation || invitation.status !== "INVITED") {
      throw new BadRequestException("Invitation is invalid");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invitation has expired");
    }

    const email = invitation.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          fullName: dto.fullName,
          globalRole: GlobalRole.USER,
          passwordHash: await bcrypt.hash(dto.password, 10),
        },
      });
    }

    if (invitation.companyId && invitation.companyRole) {
      await this.prisma.companyMember.upsert({
        where: {
          companyId_userId: { companyId: invitation.companyId, userId: user.id },
        },
        create: {
          companyId: invitation.companyId,
          userId: user.id,
          role: invitation.companyRole,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
        update: {
          role: invitation.companyRole,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });
    }

    if (invitation.clientId && invitation.clientRole) {
      await this.prisma.clientMember.upsert({
        where: {
          clientId_userId: { clientId: invitation.clientId, userId: user.id },
        },
        create: {
          clientId: invitation.clientId,
          userId: user.id,
          role: invitation.clientRole,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
        update: {
          role: invitation.clientRole,
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACTIVE", acceptedAt: new Date() },
    });

    return this.login(email, dto.password, false);
  }

  private resolveRedirect(input: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string }>;
    clients: Array<{ id: string }>;
  }) {
    if (input.isSuperAdmin) return "/admin";
    if (input.companies.length > 0) return `/app/${input.companies[0].id}/dashboard`;
    if (input.clients.length > 0) return `/client/${input.clients[0].id}/dashboard`;
    return "/login";
  }
}
