import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { GlobalRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { extname, join } from "path";
import { hashToken } from "../common/crypto.util";
import { allocateUserCode } from "../common/user-code.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./jwt.strategy";
import type { AcceptInviteDto } from "./dto/accept-invite.dto";
import type { RegisterDto } from "./dto/register.dto";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    globalRole: "SUPER_ADMIN" | "USER";
  };
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: string }>;
    clients: Array<{ id: string; name: string; companyId: string; role: string }>;
  };
  redirectTo: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
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

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive || (!user.emailVerifiedAt && user.globalRole !== GlobalRole.SUPER_ADMIN)) {
      throw new ForbiddenException(
        "Account not activated. Check your email for the activation link.",
      );
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

    const tokens = await this.issueSessionTokens(user.id, user.email, user.globalRole);

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
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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

  async refreshSession(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken?.trim()) throw new UnauthorizedException("Refresh token required");
    const tokenHash = createHash("sha256").update(refreshToken.trim()).digest("hex");
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Session is no longer valid");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSessionTokens(user.id, user.email, user.globalRole);
  }

  async me(user: AuthUser) {
    let dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !dbUser.isActive) throw new UnauthorizedException("Session is no longer valid");

    if (!dbUser.userCode) {
      dbUser = await this.prisma.user.update({
        where: { id: dbUser.id },
        data: { userCode: await allocateUserCode(this.prisma) },
      });
    }

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
      user: {
        id: dbUser.id,
        userCode: dbUser.userCode,
        email: dbUser.email,
        fullName: dbUser.fullName,
        globalRole: dbUser.globalRole as AuthUser["globalRole"],
        phone: dbUser.phone,
        accountKind: dbUser.accountKind,
        emailVerifiedAt: dbUser.emailVerifiedAt?.toISOString() ?? null,
        lastLoginAt: dbUser.lastLoginAt?.toISOString() ?? null,
        createdAt: dbUser.createdAt.toISOString(),
        isActive: dbUser.isActive,
      },
      workspaces: {
        isSuperAdmin: dbUser.globalRole === GlobalRole.SUPER_ADMIN,
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

  async register(dto: RegisterDto, gstFile?: Express.Multer.File) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    if (dto.accountKind === "COMPANY") {
      if (!dto.companyName?.trim()) throw new BadRequestException("Company name is required");
      if (!dto.gstNumber?.trim()) throw new BadRequestException("GST number is required");
      if (!gstFile) throw new BadRequestException("GST certificate PDF is required");
      if (gstFile.mimetype !== "application/pdf") {
        throw new BadRequestException("GST document must be a PDF");
      }
      if (gstFile.size > 8 * 1024 * 1024) {
        throw new BadRequestException("GST PDF must be under 8MB");
      }
    }

    const starter = await this.prisma.subscriptionPlan.findUnique({ where: { code: "STARTER" } });
    const system = await this.prisma.systemSetting.findUnique({ where: { key: "system" } });
    const trialDays =
      Number((system?.value as { trialDays?: number } | null)?.trialDays ?? 7) || 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const companyName =
      dto.accountKind === "COMPANY"
        ? dto.companyName!.trim()
        : `${dto.fullName.trim()}'s Workspace`;
    const slugBase = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    let slug = slugBase || `workspace-${Date.now()}`;
    let n = 1;
    while (await this.prisma.company.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${n++}`;
    }

    const user = await this.prisma.user.create({
      data: {
        userCode: await allocateUserCode(this.prisma),
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        accountKind: dto.accountKind,
        globalRole: GlobalRole.USER,
        isActive: false,
        emailVerifiedAt: null,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });

    let gstDocumentPath: string | null = null;
    if (gstFile) {
      const mediaRoot = this.config.get<string>("MEDIA_ROOT") || join(process.cwd(), ".data", "media");
      const dir = join(mediaRoot, "registrations", user.id);
      mkdirSync(dir, { recursive: true });
      const filename = `gst_${Date.now()}${extname(gstFile.originalname) || ".pdf"}`;
      const abs = join(dir, filename);
      writeFileSync(abs, gstFile.buffer);
      gstDocumentPath = join("registrations", user.id, filename).replace(/\\/g, "/");
    }

    const company = await this.prisma.company.create({
      data: {
        name: companyName,
        slug,
        status: "TRIAL",
        timezone: "Asia/Kolkata",
        trialEndsAt,
        planId: starter?.id,
        website: dto.website?.trim() || null,
        phone: dto.phone?.trim() || null,
        billingEmail: email,
        gstNumber: dto.gstNumber?.trim().toUpperCase() || null,
        gstDocumentPath,
      },
    });

    await this.prisma.companyMember.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    if (starter) {
      await this.prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: starter.id,
          status: "TRIALING",
          interval: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
          provider: "mock",
        },
      });
    }

    const rawToken = await this.issueAuthToken(user.id, "ACTIVATE", 48);
    const web = this.config.get<string>("WEB_URL") || "http://localhost:3000";
    const activateUrl = `${web}/activate?token=${encodeURIComponent(rawToken)}`;
    const kindLabel = dto.accountKind === "COMPANY" ? "company" : "individual";
    await this.mail.sendMail({
      to: email,
      subject: "Activate your SR Social Hub account",
      html: this.mail.shellHtml({
        accent: "activate",
        title: "Click to light up your workspace",
        preheader: "One click activates your SR Social Hub trial",
        bodyHtml: `<p style="margin:0 0 12px">Hi <strong style="color:#fff">${user.fullName}</strong>,</p>
<p style="margin:0 0 12px">Your <strong style="color:#00d2ff">${kindLabel}</strong> workspace <strong style="color:#fff">${companyName}</strong> is ready. Confirm this email to activate the account and start your free trial.</p>
<ul style="margin:0 0 12px;padding-left:18px;color:#9aa3b8">
  <li>Secure one-time activation link</li>
  <li>Expires in 48 hours</li>
  <li>No password needed for this step</li>
</ul>
<p style="color:#6b7388;font-size:13px;margin:0">If you did not create this account, you can ignore this email.</p>`,
        ctaLabel: "Activate my account",
        ctaUrl: activateUrl,
      }),
      text: `Hi ${user.fullName},\n\nActivate your SR Social Hub ${kindLabel} workspace "${companyName}":\n${activateUrl}\n\nThis link expires in 48 hours.`,
    });

    return {
      ok: true,
      message: "Registration successful. Check your email to activate your account.",
      email,
    };
  }

  async activateAccount(token: string) {
    const record = await this.consumeAuthToken(token, "ACTIVATE");
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { isActive: true, emailVerifiedAt: new Date() },
    });
    return { ok: true, message: "Account activated. You can sign in now." };
  }

  async forgotPassword(emailRaw: string) {
    const email = emailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return ok to avoid account enumeration
    if (!user) return { ok: true, message: "If that email exists, a reset link was sent." };

    const rawToken = await this.issueAuthToken(user.id, "RESET", 2);
    const web = this.config.get<string>("WEB_URL") || "http://localhost:3000";
    const resetUrl = `${web}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await this.mail.sendMail({
      to: email,
      subject: "Reset your SR Social Hub password",
      html: this.mail.shellHtml({
        accent: "reset",
        title: "Choose a new password",
        preheader: "Secure 2-hour link to reset your SR Social Hub password",
        bodyHtml: `<p style="margin:0 0 12px">Hi <strong style="color:#fff">${user.fullName}</strong>,</p>
<p style="margin:0 0 12px">Someone requested a password reset for <strong style="color:#FFB020">${email}</strong>. Use the button below to set a new password.</p>
<p style="margin:0 0 12px;padding:12px 14px;border-radius:12px;background:rgba(255,176,32,.1);border:1px solid rgba(255,176,32,.25);color:#ffd089;font-size:13px">This link expires in <strong>2 hours</strong> and can be used once.</p>
<p style="color:#6b7388;font-size:13px;margin:0">If you did not request this, ignore this email — your password stays the same.</p>`,
        ctaLabel: "Choose new password",
        ctaUrl: resetUrl,
      }),
      text: `Hi ${user.fullName},\n\nReset your SR Social Hub password (expires in 2 hours):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    });
    return { ok: true, message: "If that email exists, a reset link was sent." };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.consumeAuthToken(token, "RESET");
    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true, message: "Password updated. You can sign in now." };
  }

  private async issueAuthToken(userId: string, type: "ACTIVATE" | "RESET", hours: number) {
    const raw = randomBytes(32).toString("hex");
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      },
    });
    return raw;
  }

  private async consumeAuthToken(raw: string, type: "ACTIVATE" | "RESET") {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: hashToken(raw) },
    });
    if (!record || record.type !== type || record.usedAt) {
      throw new BadRequestException("Link is invalid or already used");
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Link has expired");
    }
    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return record;
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
          userCode: await allocateUserCode(this.prisma),
          email,
          fullName: dto.fullName,
          globalRole: GlobalRole.USER,
          passwordHash: await bcrypt.hash(dto.password, 10),
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: true, emailVerifiedAt: new Date() },
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

  private async issueSessionTokens(
    userId: string,
    email: string,
    globalRole: GlobalRole | string,
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
      globalRole,
    });

    const refreshRaw = randomBytes(48).toString("hex");
    const refreshHash = createHash("sha256").update(refreshRaw).digest("hex");
    const refreshTtl = this.config.get<string>("JWT_REFRESH_TTL") ?? "30d";
    const refreshDays = Number.parseInt(refreshTtl, 10);
    const ttlDays = Number.isFinite(refreshDays) && refreshDays > 0 ? refreshDays : 30;
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: refreshRaw };
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
