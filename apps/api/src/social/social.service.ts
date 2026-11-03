import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SocialPlatformCode } from "@prisma/client";
import { randomBytes } from "crypto";
import { EntitlementsService } from "../billing/entitlements.service";
import { decryptSecret, encryptSecret } from "../common/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "../auth/jwt.strategy";
import { createAdapterRegistry } from "./adapters/adapter.registry";
import type { SocialAdapter } from "./adapters/social-adapter";

@Injectable()
export class SocialService {
  private readonly adapters = createAdapterRegistry();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  getAdapter(code: SocialPlatformCode): SocialAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) throw new NotFoundException(`No adapter for ${code}`);
    return adapter;
  }

  async listForClientId(clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, isArchived: false },
    });
    if (!client) throw new NotFoundException("Client not found");
    return this.listForClient(client.companyId, clientId);
  }

  async listForClient(companyId: string, clientId: string) {
    await this.assertClientInCompany(companyId, clientId);

    const platforms = await this.prisma.socialPlatform.findMany({
      orderBy: { name: "asc" },
      include: { appConfig: true },
    });
    const accounts = await this.prisma.socialAccount.findMany({
      where: { clientId, status: { not: "DISCONNECTED" } },
      orderBy: { updatedAt: "desc" },
    });

    return platforms.map((platform) => {
      const adapter = this.getAdapter(platform.code);
      const hasCredentials = Boolean(
        platform.appConfig?.oauthClientId && platform.appConfig?.clientSecretEncrypted,
      );
      const mode = adapter.resolveMode(hasCredentials);
      const connected = accounts.filter((a) => a.platformCode === platform.code);
      return {
        platform: {
          code: platform.code,
          name: platform.name,
          enabled: platform.enabled,
          mode,
          capabilities: adapter.getCapabilities(),
          connectable: platform.enabled && mode !== "unavailable",
        },
        accounts: connected.map((a) => ({
          id: a.id,
          accountName: a.accountName,
          username: a.username,
          pageIdentifier: a.pageIdentifier,
          status: a.status,
          capabilities: a.capabilities,
          lastSyncedAt: a.lastSyncedAt,
          tokenExpiresAt: a.tokenExpiresAt,
          connectionMode: a.connectionMode,
          lastError: a.lastError,
        })),
      };
    });
  }

  async listForCompany(companyId: string) {
    const clients = await this.prisma.client.findMany({
      where: { companyId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const accounts = await this.prisma.socialAccount.findMany({
      where: { companyId, status: { not: "DISCONNECTED" } },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const platforms = await this.prisma.socialPlatform.findMany({
      orderBy: { name: "asc" },
      include: { appConfig: true },
    });

    return {
      clients,
      platforms: platforms.map((p) => {
        const adapter = this.getAdapter(p.code);
        const hasCredentials = Boolean(
          p.appConfig?.oauthClientId && p.appConfig?.clientSecretEncrypted,
        );
        const mode = adapter.resolveMode(hasCredentials);
        return {
          code: p.code,
          name: p.name,
          enabled: p.enabled,
          mode,
          capabilities: adapter.getCapabilities(),
          connectable: p.enabled && mode !== "unavailable",
        };
      }),
      accounts: accounts.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        clientName: a.client.name,
        platformCode: a.platformCode,
        accountName: a.accountName,
        username: a.username,
        status: a.status,
        connectionMode: a.connectionMode,
        tokenExpiresAt: a.tokenExpiresAt,
        lastSyncedAt: a.lastSyncedAt,
      })),
    };
  }

  async startConnect(input: {
    companyId: string;
    clientId: string;
    platformCode: SocialPlatformCode;
    user: AuthUser;
    redirectTo?: string;
  }) {
    await this.assertCanManage(input.companyId, input.user);
    await this.assertClientInCompany(input.companyId, input.clientId);

    const platform = await this.prisma.socialPlatform.findUnique({
      where: { code: input.platformCode },
      include: { appConfig: true },
    });
    if (!platform) throw new NotFoundException("Platform not found");
    if (!platform.enabled) {
      throw new BadRequestException(`${platform.name} is disabled by super admin`);
    }

    const existingActive = await this.prisma.socialAccount.findFirst({
      where: {
        companyId: input.companyId,
        clientId: input.clientId,
        platformCode: input.platformCode,
        status: { not: "DISCONNECTED" },
      },
    });
    if (!existingActive) {
      await this.entitlements.assertCanConnectAccount(input.companyId);
    }

    const adapter = this.getAdapter(input.platformCode);
    const hasCredentials = Boolean(
      platform.appConfig?.oauthClientId && platform.appConfig?.clientSecretEncrypted,
    );
    const mode = adapter.resolveMode(hasCredentials);
    if (mode === "unavailable") {
      throw new BadRequestException(`${platform.name} adapter is not available yet`);
    }

    const redirectUri =
      platform.appConfig?.redirectUri ||
      `${process.env.API_URL ?? "http://localhost:4000"}/api/v1/oauth/callback`;
    const scopes =
      platform.appConfig?.scopes?.length
        ? platform.appConfig.scopes
        : adapter.getDefaultScopes();

    const state = randomBytes(24).toString("hex");
    await this.prisma.oAuthState.create({
      data: {
        state,
        platformCode: input.platformCode,
        companyId: input.companyId,
        clientId: input.clientId,
        userId: input.user.id,
        redirectTo:
          input.redirectTo ||
          `${process.env.WEB_URL ?? "http://localhost:3000"}/client/${input.clientId}/social-accounts`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const authorizeUrl = adapter.buildAuthorizeUrl(
      {
        clientId: platform.appConfig?.oauthClientId || "mock-client-id",
        redirectUri,
        scopes,
        state,
        apiVersion: platform.appConfig?.apiVersion,
      },
      mode,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: input.user.id,
        companyId: input.companyId,
        action: "SOCIAL_CONNECT_STARTED",
        entityType: "SocialPlatform",
        entityId: platform.id,
        metadata: { platform: input.platformCode, mode, clientId: input.clientId },
      },
    });

    return {
      authorizeUrl,
      mode,
      platform: input.platformCode,
      state,
      note:
        mode === "mock"
          ? `Mock OAuth: validates ${platform.name} connect/disconnect architecture. Not a real provider authorization.`
          : `Live OAuth: redirects to the official ${platform.name} authorization dialog.`,
    };
  }

  async handleCallback(code: string, state: string) {
    const oauthState = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!oauthState || oauthState.consumedAt) {
      throw new BadRequestException("Invalid OAuth state");
    }
    if (oauthState.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("OAuth state expired");
    }

    const platform = await this.prisma.socialPlatform.findUnique({
      where: { code: oauthState.platformCode },
      include: { appConfig: true },
    });
    if (!platform?.enabled) throw new BadRequestException("Platform disabled");

    const adapter = this.getAdapter(oauthState.platformCode);
    const hasCredentials = Boolean(
      platform.appConfig?.oauthClientId && platform.appConfig?.clientSecretEncrypted,
    );
    const mode = adapter.resolveMode(hasCredentials);
    const redirectUri =
      platform.appConfig?.redirectUri ||
      `${process.env.API_URL ?? "http://localhost:4000"}/api/v1/oauth/callback`;

    const secret = platform.appConfig?.clientSecretEncrypted
      ? decryptSecret(platform.appConfig.clientSecretEncrypted)
      : "mock-secret";

    const exchanged = await adapter.exchangeCode({
      code,
      redirectUri,
      clientId: platform.appConfig?.oauthClientId || "mock-client-id",
      clientSecret: secret,
      mode,
      apiVersion: platform.appConfig?.apiVersion,
    });

    const account = await this.prisma.socialAccount.upsert({
      where: {
        clientId_platformCode_externalAccountId: {
          clientId: oauthState.clientId,
          platformCode: oauthState.platformCode,
          externalAccountId: exchanged.externalAccountId,
        },
      },
      create: {
        companyId: oauthState.companyId,
        clientId: oauthState.clientId,
        platformId: platform.id,
        platformCode: oauthState.platformCode,
        externalAccountId: exchanged.externalAccountId,
        accountName: exchanged.accountName,
        username: exchanged.username,
        pageIdentifier: exchanged.pageIdentifier,
        status: "CONNECTED",
        capabilities: exchanged.capabilities as object,
        lastSyncedAt: new Date(),
        tokenExpiresAt: exchanged.expiresAt,
        connectionMode: exchanged.mode,
        connectedByUserId: oauthState.userId,
      },
      update: {
        accountName: exchanged.accountName,
        username: exchanged.username,
        pageIdentifier: exchanged.pageIdentifier,
        status: "CONNECTED",
        capabilities: exchanged.capabilities as object,
        lastSyncedAt: new Date(),
        tokenExpiresAt: exchanged.expiresAt,
        connectionMode: exchanged.mode,
        lastError: null,
        connectedByUserId: oauthState.userId,
      },
    });

    await this.prisma.socialAccountToken.upsert({
      where: { socialAccountId: account.id },
      create: {
        socialAccountId: account.id,
        accessTokenEncrypted: encryptSecret(exchanged.accessToken),
        refreshTokenEncrypted: exchanged.refreshToken
          ? encryptSecret(exchanged.refreshToken)
          : null,
        tokenType: exchanged.tokenType,
        scopes: exchanged.scopes,
        expiresAt: exchanged.expiresAt,
        rawMetaEncrypted: exchanged.rawMeta
          ? encryptSecret(JSON.stringify(exchanged.rawMeta))
          : null,
      },
      update: {
        accessTokenEncrypted: encryptSecret(exchanged.accessToken),
        refreshTokenEncrypted: exchanged.refreshToken
          ? encryptSecret(exchanged.refreshToken)
          : null,
        tokenType: exchanged.tokenType,
        scopes: exchanged.scopes,
        expiresAt: exchanged.expiresAt,
        rawMetaEncrypted: exchanged.rawMeta
          ? encryptSecret(JSON.stringify(exchanged.rawMeta))
          : null,
      },
    });

    await this.prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { consumedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: oauthState.userId,
        companyId: oauthState.companyId,
        action: "SOCIAL_ACCOUNT_CONNECTED",
        entityType: "SocialAccount",
        entityId: account.id,
        metadata: {
          platform: oauthState.platformCode,
          mode: exchanged.mode,
          externalAccountId: exchanged.externalAccountId,
        },
      },
    });

    const redirect = new URL(
      oauthState.redirectTo ||
        `${process.env.WEB_URL ?? "http://localhost:3000"}/client/${oauthState.clientId}/social-accounts`,
    );
    redirect.searchParams.set("connected", oauthState.platformCode);
    redirect.searchParams.set("mode", exchanged.mode);
    return { redirectTo: redirect.toString(), accountId: account.id, mode: exchanged.mode };
  }

  async disconnect(accountId: string, user: AuthUser) {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: {
        token: true,
        platform: { include: { appConfig: true } },
      },
    });
    if (!account) throw new NotFoundException("Social account not found");
    await this.assertCanManage(account.companyId, user);

    const adapter = this.getAdapter(account.platformCode);
    if (account.token && adapter.revoke) {
      try {
        const secret = account.platform.appConfig?.clientSecretEncrypted
          ? decryptSecret(account.platform.appConfig.clientSecretEncrypted)
          : "mock-secret";
        await adapter.revoke({
          accessToken: decryptSecret(account.token.accessTokenEncrypted),
          clientId: account.platform.appConfig?.oauthClientId || "mock-client-id",
          clientSecret: secret,
          mode: account.connectionMode === "live" ? "live" : "mock",
        });
      } catch {
        // still disconnect locally
      }
    }

    await this.prisma.socialAccountToken.deleteMany({ where: { socialAccountId: accountId } });
    const updated = await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: { status: "DISCONNECTED", lastError: null },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        companyId: account.companyId,
        action: "SOCIAL_ACCOUNT_DISCONNECTED",
        entityType: "SocialAccount",
        entityId: accountId,
        metadata: { platform: account.platformCode },
      },
    });

    return updated;
  }

  private async assertClientInCompany(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, isArchived: false },
    });
    if (!client) throw new NotFoundException("Client not found in company");
    return client;
  }

  private async assertCanManage(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("No access to this company");
    }
  }
}
