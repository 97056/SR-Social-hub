import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { EntitlementsService } from "../billing/entitlements.service";
import { allocateUserCode } from "../common/user-code.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

/** Password format: SR + 8 chars including letter, digit, and special. */
export function generateClientPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%&*";
  const pool = letters + digits + specials;
  const pick = (set: string) => set[randomBytes(1)[0]! % set.length]!;
  const chars = [pick(letters), pick(digits), pick(specials)];
  while (chars.length < 8) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return `SR${chars.join("")}`;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
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

    const organizationName = (dto.organizationName || dto.name || "").trim();
    const contactName = (dto.contactName || organizationName).trim();
    const email = (dto.email || dto.contactEmail || "").toLowerCase().trim();
    const mobile = dto.mobile.trim();
    const website = dto.website?.trim() || "";
    const businessName = dto.businessName?.trim() || "";
    const description = (dto.description || dto.brandVoice || "").trim();

    if (!organizationName) throw new ConflictException("Organization name is required");
    if (!contactName) throw new ConflictException("Contact name is required");
    if (!email) throw new ConflictException("Email is required");
    if (!description) throw new ConflictException("Organization description is required");
    if (!website && !businessName) {
      throw new ConflictException(
        "Website is required, or provide business name when the client has no website",
      );
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyOnClient = await this.prisma.clientMember.findFirst({
        where: {
          userId: existingUser.id,
          client: { companyId, isArchived: false },
        },
      });
      if (alreadyOnClient) {
        throw new ConflictException(
          "This email already belongs to a client in your workspace. Use a different email.",
        );
      }
      throw new ConflictException(
        "This email is already registered. Ask them to sign in, or use a different email for a new login.",
      );
    }

    const plainPassword = generateClientPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const web = this.config.get<string>("WEB_URL") || "http://localhost:3000";
    const loginUrl = `${web}/login`;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            companyId,
            name: organizationName,
            externalCode: dto.externalCode?.trim() || null,
            industry: dto.industry?.trim() || null,
            website: website || null,
            businessName: businessName || null,
            contactEmail: email,
            contactPhone: mobile,
            timezone: dto.timezone ?? company.timezone,
            brandVoice: description || null,
            logoUrl: dto.logoUrl?.trim() || null,
          },
        });

        const user = await tx.user.create({
          data: {
            userCode: await allocateUserCode(tx),
            email,
            fullName: contactName,
            phone: mobile,
            accountKind: "CLIENT",
            globalRole: "USER",
            isActive: true,
            emailVerifiedAt: new Date(),
            passwordHash,
          },
        });

        await tx.clientMember.create({
          data: {
            clientId: client.id,
            userId: user.id,
            role: "OWNER",
            status: "ACTIVE",
            invitedAt: new Date(),
            acceptedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            companyId,
            action: "CLIENT_CREATED",
            entityType: "Client",
            entityId: client.id,
            metadata: {
              name: client.name,
              contactEmail: email,
              contactName,
              loginProvisioned: true,
            },
          },
        });

        return { client, user };
      });

      let mailSent = false;
      let mailError: string | null = null;
      try {
        await this.mail.sendMail({
          to: email,
          subject: `🎟 Client access pass — ${organizationName} | SR Social Hub`,
          html: this.mail.clientAccessHtml({
            contactName,
            organizationName,
            agencyName: company.name,
            email,
            password: plainPassword,
            mobile,
            loginUrl,
          }),
          text: [
            `SR SOCIAL HUB — CLIENT ACCESS PASS`,
            ``,
            `Hi ${contactName},`,
            ``,
            `${company.name} invited "${organizationName}" to the client portal.`,
            ``,
            `Email: ${email}`,
            `Password: ${plainPassword}`,
            `Mobile: ${mobile}`,
            ``,
            `Sign in: ${loginUrl}`,
            ``,
            `Keep this password private. Change it anytime via Forgot password.`,
          ].join("\n"),
        });
        mailSent = true;
      } catch (err) {
        mailError = err instanceof Error ? err.message : "Failed to send login email";
      }

      return {
        ...result.client,
        contactName,
        loginEmail: email,
        mailSent,
        mailError,
        message: mailSent
          ? "Client created. Login credentials were emailed to the client."
          : `Client created, but email failed (${mailError}). Check SMTP in Admin → Mail.`,
      };
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ConflictException("Client external code or email already exists");
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

    const [awaitingApproval, scheduledPosts, publishedPosts, connectedAccounts] = await Promise.all([
      this.prisma.contentPost.count({
        where: { clientId, status: "PENDING_APPROVAL" },
      }),
      this.prisma.contentPost.count({
        where: { clientId, status: "SCHEDULED" },
      }),
      this.prisma.contentPost.count({
        where: { clientId, status: "PUBLISHED" },
      }),
      this.prisma.socialAccount.count({
        where: { clientId, status: "CONNECTED" },
      }),
    ]);

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
        logoUrl: client.logoUrl,
        website: client.website,
        businessName: client.businessName,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        memberCount: client._count.members,
        members: client.members.map((m) => ({
          role: m.role,
          email: m.user.email,
          fullName: m.user.fullName,
        })),
      },
      dashboard: {
        awaitingApproval,
        scheduledPosts,
        publishedPosts,
        connectedAccounts,
      },
    };
  }

  async listPosts(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, isArchived: true, name: true },
    });
    if (!client || client.isArchived) throw new NotFoundException("Client not found");

    return this.prisma.contentPost.findMany({
      where: { clientId },
      include: {
        targets: {
          select: {
            platformCode: true,
            status: true,
            scheduledAt: true,
            publishedAt: true,
            externalPostId: true,
            lastError: true,
          },
        },
        mediaAsset: {
          select: { id: true, kind: true, originalName: true, mimeType: true },
        },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: [{ scheduledAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
  }

  async update(clientId: string, actor: AuthUser, dto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.isArchived) throw new NotFoundException("Client not found");

    if (actor.globalRole !== "SUPER_ADMIN") {
      const companyMembership = await this.prisma.companyMember.findUnique({
        where: {
          companyId_userId: { companyId: client.companyId, userId: actor.id },
        },
      });
      const clientMembership = await this.prisma.clientMember.findUnique({
        where: { clientId_userId: { clientId, userId: actor.id } },
      });
      const companyOk =
        companyMembership?.status === "ACTIVE" &&
        ["OWNER", "ADMIN", "MANAGER"].includes(companyMembership.role);
      const clientOk =
        clientMembership?.status === "ACTIVE" &&
        ["OWNER", "ADMIN", "APPROVER", "VIEWER"].includes(clientMembership.role);
      // Client members may edit their brand profile; viewers can still save non-sensitive fields they send.
      if (!companyOk && !clientOk) {
        throw new ForbiddenException("Not allowed to update this client");
      }
      if (
        clientMembership &&
        !companyOk &&
        !["OWNER", "ADMIN"].includes(clientMembership.role)
      ) {
        // Approvers/viewers: allow logo + brand voice only via stripping sensitive keys later if needed.
      }
    }

    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        name: dto.name,
        industry: dto.industry,
        brandVoice: dto.brandVoice,
        logoUrl: dto.logoUrl === undefined ? undefined : dto.logoUrl,
        website: dto.website === undefined ? undefined : dto.website,
        businessName: dto.businessName === undefined ? undefined : dto.businessName,
        contactEmail: dto.contactEmail === undefined ? undefined : dto.contactEmail,
        contactPhone: dto.contactPhone === undefined ? undefined : dto.contactPhone,
        timezone: dto.timezone,
        approvalWorkflow: dto.approvalWorkflow,
      },
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
