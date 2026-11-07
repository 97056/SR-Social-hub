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
import {
  META_LOGIN_PLATFORMS,
  resolveMetaConfigId,
  resolveMetaRedirectUri,
} from "./adapters/meta-oauth";
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
      where: { code: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] } },
      orderBy: { name: "asc" },
      include: { appConfig: true },
    });
    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        clientId,
        status: { not: "DISCONNECTED" },
        platformCode: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] },
      },
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
          externalAccountId: a.externalAccountId,
          pageIdentifier: a.pageIdentifier,
          status: a.status,
          capabilities: a.capabilities,
          lastSyncedAt: a.lastSyncedAt,
          tokenExpiresAt: a.tokenExpiresAt,
          connectionMode: a.connectionMode,
          lastError: a.lastError,
          needsReconnect: this.isIncompleteProfile(a),
        })),
      };
    });
  }

  async listForCompany(companyId: string) {
    const [clients, accounts, platforms, entitlements] = await Promise.all([
      this.prisma.client.findMany({
        where: { companyId, isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.socialAccount.findMany({
        where: {
          companyId,
          status: { not: "DISCONNECTED" },
          platformCode: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] },
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.socialPlatform.findMany({
        where: { code: { notIn: ["TIKTOK", "GOOGLE_BUSINESS"] } },
        orderBy: { name: "asc" },
        include: { appConfig: true },
      }),
      this.entitlements.getEntitlements(companyId),
    ]);

    const oauthModeEnv = process.env.SOCIAL_OAUTH_MODE ?? "live";

    return {
      oauthMode: oauthModeEnv,
      plan: {
        code: entitlements.planCode,
        name: entitlements.planName,
        maxSocialNetworks: entitlements.maxSocialNetworks,
        networksUsed: entitlements.networksUsed,
        accountQuota: entitlements.quotas.accounts,
      },
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
          hasCredentials,
          capabilities: adapter.getCapabilities(),
          connectable: p.enabled && mode !== "unavailable",
          setupHint:
            mode === "unavailable"
              ? "Add OAuth Client ID + Secret in Admin → Integrations, then enable this network."
              : mode === "mock"
                ? "Mock mode is on — connects create demo accounts only."
                : "Ready for real OAuth connect.",
        };
      }),
      accounts: accounts.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        clientName: a.client.name,
        platformCode: a.platformCode,
        accountName: a.accountName,
        username: a.username,
        externalAccountId: a.externalAccountId,
        status: a.status,
        connectionMode: a.connectionMode,
        tokenExpiresAt: a.tokenExpiresAt,
        lastSyncedAt: a.lastSyncedAt,
        needsReconnect: this.isIncompleteProfile(a),
      })),
    };
  }

  private isIncompleteProfile(a: {
    externalAccountId: string;
    username: string | null;
    accountName: string | null;
    connectionMode: string;
  }) {
    if (!a.externalAccountId) return true;
    if (/_live_[a-f0-9]+$/i.test(a.externalAccountId)) return true;
    if (a.username && /_live_[a-f0-9]+$/i.test(a.username)) return true;
    if (a.connectionMode === "live" && !a.username && !a.accountName) return true;
    return false;
  }

  /** Client portal users are ClientMembers, not CompanyMembers — resolve company from client. */
  async startConnectForClient(input: {
    clientId: string;
    platformCode: SocialPlatformCode;
    user: AuthUser;
    redirectTo?: string;
  }) {
    const client = await this.prisma.client.findFirst({
      where: { id: input.clientId, isArchived: false },
    });
    if (!client) throw new NotFoundException("Client not found");
    await this.assertClientPortalAccess(client.id, client.companyId, input.user);
    return this.startConnect({
      companyId: client.companyId,
      clientId: client.id,
      platformCode: input.platformCode,
      user: input.user,
      redirectTo: input.redirectTo,
      skipCompanyManageCheck: true,
    });
  }

  async startConnect(input: {
    companyId: string;
    clientId: string;
    platformCode: SocialPlatformCode;
    user: AuthUser;
    redirectTo?: string;
    skipCompanyManageCheck?: boolean;
  }) {
    if (!input.skipCompanyManageCheck) {
      await this.assertCanManage(input.companyId, input.user);
    }
    await this.assertClientInCompany(input.companyId, input.clientId);

    if (input.platformCode === "TIKTOK") {
      throw new BadRequestException("TikTok is not available — developer access is not offered");
    }
    if (input.platformCode === "GOOGLE_BUSINESS") {
      throw new BadRequestException("Google Business Profile is not available");
    }

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
      await this.entitlements.assertCanConnectAccount(input.companyId, input.platformCode);
    }

    const adapter = this.getAdapter(input.platformCode);
    const hasCredentials = Boolean(
      platform.appConfig?.oauthClientId && platform.appConfig?.clientSecretEncrypted,
    );
    const mode = adapter.resolveMode(hasCredentials);
    if (mode === "unavailable") {
      throw new BadRequestException(`${platform.name} adapter is not available yet`);
    }

    const redirectUri = META_LOGIN_PLATFORMS.has(input.platformCode)
      ? resolveMetaRedirectUri(platform.appConfig?.redirectUri)
      : platform.appConfig?.redirectUri ||
        `${process.env.API_URL ?? "http://localhost:4000"}/api/v1/oauth/callback`;
    const scopes =
      platform.appConfig?.scopes?.length
        ? platform.appConfig.scopes
        : adapter.getDefaultScopes();
    const configId = resolveMetaConfigId(input.platformCode, platform.appConfig?.configId);

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
        configId,
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
    const redirectUri = META_LOGIN_PLATFORMS.has(oauthState.platformCode)
      ? resolveMetaRedirectUri(platform.appConfig?.redirectUri)
      : platform.appConfig?.redirectUri ||
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
      codeVerifier: oauthState.platformCode === "X" ? "challenge" : null,
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

  async buildOAuthErrorRedirect(state: string, message: string): Promise<string | null> {
    const oauthState = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!oauthState) return null;
    const redirect = new URL(
      oauthState.redirectTo ||
        `${process.env.WEB_URL ?? "http://localhost:3000"}/client/${oauthState.clientId}/social-accounts`,
    );
    redirect.searchParams.set("oauth_error", message.slice(0, 180));
    return redirect.toString();
  }

  async refreshProfile(accountId: string, user: AuthUser) {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { token: true },
    });
    if (!account) throw new NotFoundException("Social account not found");
    await this.assertCanManageOrClient(account.companyId, account.clientId, user);
    if (!account.token?.accessTokenEncrypted) {
      throw new BadRequestException("No access token — disconnect and connect again.");
    }

    const accessToken = decryptSecret(account.token.accessTokenEncrypted);
    if (accessToken.startsWith("mock_") || account.connectionMode !== "live") {
      throw new BadRequestException(
        "Mock accounts cannot refresh a live profile. Connect in live OAuth mode.",
      );
    }

    const adapter = this.getAdapter(account.platformCode);
    if (!adapter.refreshProfile) {
      throw new BadRequestException("Profile refresh is not supported for this network yet.");
    }
    const profile = await adapter.refreshProfile(accessToken);
    if (!profile.externalAccountId || /_live_[a-f0-9]+$/i.test(profile.externalAccountId)) {
      throw new BadRequestException(
        `${account.platformCode} profile lookup failed. Disconnect, connect again with the correct app permissions, then retry.`,
      );
    }

    const updated = await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        externalAccountId: profile.externalAccountId,
        accountName: profile.accountName ?? account.accountName,
        username: profile.username ?? account.username,
        pageIdentifier: profile.pageIdentifier ?? account.pageIdentifier,
        lastSyncedAt: new Date(),
        lastError: null,
        status: "CONNECTED",
      },
    });

    if (profile.accessToken && profile.accessToken !== accessToken) {
      await this.prisma.socialAccountToken.update({
        where: { socialAccountId: account.id },
        data: { accessTokenEncrypted: encryptSecret(profile.accessToken) },
      });
    }

    return {
      id: updated.id,
      platformCode: updated.platformCode,
      accountName: updated.accountName,
      username: updated.username,
      externalAccountId: updated.externalAccountId,
      needsReconnect: this.isIncompleteProfile(updated),
    };
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
    await this.assertCanManageOrClient(account.companyId, account.clientId, user);

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

  private async assertCanManageOrClient(
    companyId: string,
    clientId: string,
    user: AuthUser,
  ) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const companyMembership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (companyMembership?.status === "ACTIVE") return;
    await this.assertClientPortalAccess(clientId, companyId, user);
  }

  private async assertClientPortalAccess(
    clientId: string,
    companyId: string,
    user: AuthUser,
  ) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const clientMembership = await this.prisma.clientMember.findUnique({
      where: { clientId_userId: { clientId, userId: user.id } },
    });
    if (clientMembership?.status === "ACTIVE") return;
    const companyMembership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (companyMembership?.status === "ACTIVE") return;
    throw new ForbiddenException("No access to this client workspace");
  }
}
