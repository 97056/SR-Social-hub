import { createHash, randomBytes } from "crypto";
import type { PlatformCatalogEntry } from "./platform-catalog";
import type {
  AdapterAuthMode,
  AdapterCapabilities,
  AuthorizeParams,
  SocialAdapter,
  TokenExchangeResult,
} from "./social-adapter";

/**
 * Shared OAuth adapter driven by the platform catalog.
 * Mock mode validates connect/disconnect/publish architecture.
 * Live mode builds official authorize URLs; token exchange uses provider token endpoints when configured.
 */
export class CatalogSocialAdapter implements SocialAdapter {
  readonly code;
  readonly displayName;

  constructor(private readonly entry: PlatformCatalogEntry) {
    this.code = entry.code;
    this.displayName = entry.displayName;
  }

  getDefaultScopes(): string[] {
    return [...this.entry.scopes];
  }

  getCapabilities(): AdapterCapabilities {
    return { ...this.entry.capabilities };
  }

  resolveMode(hasCredentials: boolean): AdapterAuthMode {
    // Explicit mock for architecture tests only.
    if (process.env.SOCIAL_OAUTH_MODE === "mock") return "mock";
    // Live OAuth when app credentials are configured in Admin → Integrations.
    if (hasCredentials) return "live";
    // Live mode without credentials: block connect (no dummy accounts).
    if (process.env.SOCIAL_OAUTH_MODE === "live") return "unavailable";
    return "mock";
  }

  buildAuthorizeUrl(params: AuthorizeParams, mode: AdapterAuthMode): string {
    if (mode === "mock") {
      const base = process.env.API_URL ?? "http://localhost:4000";
      const q = new URLSearchParams({
        code: `mock_${this.entry.mockPrefix}_${randomBytes(8).toString("hex")}`,
        state: params.state,
      });
      return `${base}/api/v1/oauth/callback?${q.toString()}`;
    }
    return this.entry.liveAuthorizeUrl({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      scopes: params.scopes,
      state: params.state,
      apiVersion: params.apiVersion,
      configId: params.configId,
    });
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
    mode: AdapterAuthMode;
    apiVersion?: string | null;
    codeVerifier?: string | null;
  }): Promise<TokenExchangeResult> {
    const mockCode = `mock_${this.entry.mockPrefix}_`;
    if (input.mode === "mock" || input.code.startsWith(mockCode)) {
      const suffix = createHash("sha256").update(input.code).digest("hex").slice(0, 8);
      return {
        accessToken: `mock_${this.entry.mockPrefix}_access_${suffix}`,
        refreshToken: `mock_${this.entry.mockPrefix}_refresh_${suffix}`,
        tokenType: "bearer",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        scopes: this.getDefaultScopes(),
        externalAccountId: `mock_${this.entry.mockPrefix}_acct_${suffix}`,
        accountName: `Demo ${this.entry.accountLabel}`,
        username: `demo.${this.entry.mockPrefix}.${suffix}`,
        pageIdentifier: `mock_${this.entry.mockPrefix}_acct_${suffix}`,
        capabilities: this.getCapabilities(),
        mode: "mock",
        rawMeta: { mock: true, provider: this.entry.code },
      };
    }

    if (!this.entry.liveTokenUrl) {
      throw new Error(
        `${this.displayName} live token exchange requires additional provider setup. Use mock mode locally or complete provider onboarding.`,
      );
    }

    const usesBasicAuth = this.entry.code === "X" || this.entry.code === "PINTEREST";
    const body = new URLSearchParams({
      redirect_uri: input.redirectUri,
      code: input.code,
      grant_type: "authorization_code",
    });
    // Most providers accept client credentials in the form body.
    // Pinterest + X require HTTP Basic auth and reject credentials in the body.
    if (!usesBasicAuth) {
      body.set("client_id", input.clientId);
      body.set("client_secret", input.clientSecret);
    }
    // X OAuth 2.0 authorize uses code_challenge_method=plain with fixed "challenge".
    const verifier =
      input.codeVerifier ||
      (this.entry.code === "X" ? "challenge" : null);
    if (verifier) body.set("code_verifier", verifier);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (usesBasicAuth) {
      headers.Authorization = `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
      ).toString("base64")}`;
    }

    const res = await fetch(this.entry.liveTokenUrl, {
      method: "POST",
      headers,
      body,
    });
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(
        `${this.displayName} token exchange failed (${res.status}): ${this.safeOAuthError(rawText)}`,
      );
    }

    let json: {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string | string[];
    };
    try {
      json = JSON.parse(rawText) as typeof json;
    } catch {
      throw new Error(`${this.displayName} token exchange returned non-JSON response (${res.status})`);
    }
    if (!json.access_token) {
      throw new Error(`${this.displayName} token exchange returned no access_token`);
    }

    const scopes = Array.isArray(json.scope)
      ? json.scope
      : json.scope
        ? json.scope.split(/[,\s]+/).filter(Boolean)
        : this.getDefaultScopes();

    let accessToken = json.access_token;
    let refreshToken = json.refresh_token ?? null;
    let expiresIn = json.expires_in;

    // Threads short-lived tokens die in ~1h; upgrade to long-lived (~60d) at connect.
    if (this.entry.code === "THREADS") {
      const upgraded = await this.upgradeThreadsToken(accessToken, input.clientSecret);
      if (upgraded) {
        accessToken = upgraded.accessToken;
        expiresIn = upgraded.expiresIn;
        // Threads refreshes via the long-lived access token itself.
        refreshToken = upgraded.accessToken;
      }
    }

    // Instagram: upgrade Meta user token before resolving the Page/IG business account.
    if (this.entry.code === "INSTAGRAM") {
      const upgraded = await this.upgradeMetaUserToken(
        accessToken,
        input.clientId,
        input.clientSecret,
        input.apiVersion || "v21.0",
      );
      if (upgraded) {
        accessToken = upgraded.accessToken;
        expiresIn = upgraded.expiresIn;
      }
    }

    const profile = await this.fetchLiveProfile(accessToken);
    const usedPageToken = Boolean(
      profile.accessToken && profile.accessToken !== accessToken,
    );
    accessToken = profile.accessToken || accessToken;
    const suffix = createHash("sha256").update(accessToken).digest("hex").slice(0, 8);
    const requiresRealProfile =
      this.entry.code === "THREADS" ||
      this.entry.code === "INSTAGRAM" ||
      this.entry.code === "FACEBOOK" ||
      this.entry.code === "LINKEDIN" ||
      this.entry.code === "X" ||
      this.entry.code === "YOUTUBE" ||
      this.entry.code === "PINTEREST";
    if (requiresRealProfile && !profile.externalAccountId) {
      const hint =
        typeof profile.rawMeta?.hint === "string"
          ? ` ${profile.rawMeta.hint}`
          : this.entry.code === "PINTEREST"
            ? " Add the user_accounts:read scope in your Pinterest developer app, save, then reconnect."
            : " Check app permissions / Live mode, then reconnect.";
      throw new Error(
        `${this.displayName} connected but profile lookup failed.${hint}`,
      );
    }
    return {
      accessToken,
      refreshToken,
      tokenType: json.token_type ?? "bearer",
      // IG/FB page tokens from a long-lived user token typically do not expire.
      expiresAt:
        usedPageToken
          ? null
          : expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
      scopes,
      externalAccountId: profile.externalAccountId || `${this.entry.mockPrefix}_live_${suffix}`,
      accountName: profile.accountName || `${this.displayName} Connected Account`,
      username: profile.username || profile.externalAccountId || `${this.entry.mockPrefix}_live_${suffix}`,
      pageIdentifier: profile.pageIdentifier || profile.externalAccountId || `${this.entry.mockPrefix}_live_${suffix}`,
      capabilities: this.getCapabilities(),
      mode: "live",
      rawMeta: { provider: this.entry.code, live: true, ...(profile.rawMeta ?? {}) },
    };
  }

  async refreshAccessToken(input: {
    accessToken: string;
    refreshToken?: string | null;
    clientId: string;
    clientSecret: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  }> {
    if (input.accessToken.startsWith("mock_")) {
      return {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    }

    if (this.entry.code === "THREADS") {
      const token = input.refreshToken || input.accessToken;
      const url = new URL("https://graph.threads.net/refresh_access_token");
      url.searchParams.set("grant_type", "th_refresh_token");
      url.searchParams.set("access_token", token);
      const res = await fetch(url);
      const rawText = await res.text();
      if (!res.ok) {
        throw new Error(
          `Threads token refresh failed (${res.status}): ${this.safeOAuthError(rawText)}`,
        );
      }
      const json = JSON.parse(rawText) as { access_token?: string; expires_in?: number };
      if (!json.access_token) throw new Error("Threads token refresh returned no access_token");
      return {
        accessToken: json.access_token,
        refreshToken: json.access_token,
        expiresAt: json.expires_in
          ? new Date(Date.now() + json.expires_in * 1000)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    }

    if (!this.entry.liveTokenUrl) {
      throw new Error(`${this.displayName} does not support token refresh`);
    }
    if (!input.refreshToken) {
      throw new Error(`${this.displayName} has no refresh token — reconnect the account`);
    }

    const usesBasicAuth = this.entry.code === "X" || this.entry.code === "PINTEREST";
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    });
    if (!usesBasicAuth) {
      body.set("client_id", input.clientId);
      body.set("client_secret", input.clientSecret);
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (usesBasicAuth) {
      headers.Authorization = `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
      ).toString("base64")}`;
    }

    const res = await fetch(this.entry.liveTokenUrl, {
      method: "POST",
      headers,
      body,
    });
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(
        `${this.displayName} token refresh failed (${res.status}): ${this.safeOAuthError(rawText)}`,
      );
    }
    const json = JSON.parse(rawText) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error(`${this.displayName} token refresh returned no access_token`);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? input.refreshToken,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    };
  }

  private async upgradeThreadsToken(
    shortLivedToken: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const url = new URL("https://graph.threads.net/access_token");
      url.searchParams.set("grant_type", "th_exchange_token");
      url.searchParams.set("client_secret", clientSecret);
      url.searchParams.set("access_token", shortLivedToken);
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) return null;
      return {
        accessToken: json.access_token,
        expiresIn: json.expires_in || 60 * 24 * 60 * 60,
      };
    } catch {
      return null;
    }
  }

  private async upgradeMetaUserToken(
    shortLivedToken: string,
    clientId: string,
    clientSecret: string,
    version: string,
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
      url.searchParams.set("grant_type", "fb_exchange_token");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("client_secret", clientSecret);
      url.searchParams.set("fb_exchange_token", shortLivedToken);
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!json.access_token) return null;
      return {
        accessToken: json.access_token,
        expiresIn: json.expires_in || 60 * 24 * 60 * 60,
      };
    } catch {
      return null;
    }
  }

  /** Strip secrets/tokens from provider error payloads before surfacing. */
  private safeOAuthError(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const code = parsed.code ?? parsed.error ?? parsed.error_code;
      const message =
        parsed.message ??
        parsed.error_description ??
        parsed.error_message ??
        (typeof parsed.error === "string" ? parsed.error : null);
      return JSON.stringify({
        code: code ?? null,
        message: typeof message === "string" ? message.slice(0, 180) : "token exchange rejected",
      });
    } catch {
      return raw.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]").slice(0, 180);
    }
  }

  private async fetchLiveProfile(accessToken: string): Promise<{
    externalAccountId?: string;
    accountName?: string | null;
    username?: string | null;
    pageIdentifier?: string | null;
    accessToken?: string;
    rawMeta?: Record<string, unknown>;
  }> {
    try {
      if (this.entry.code === "PINTEREST") {
        // Requires user_accounts:read. Fall back to boards if profile is restricted.
        const meRes = await fetch("https://api.pinterest.com/v5/user_account", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (meRes.ok) {
          const user = (await meRes.json()) as {
            id?: string;
            username?: string;
            business_name?: string;
            account_type?: string;
            profile_image?: string;
          };
          const username = user.username?.replace(/^@/, "") || null;
          const externalAccountId = user.id || username || undefined;
          if (externalAccountId) {
            return {
              externalAccountId,
              accountName: user.business_name || username || "Pinterest Account",
              username: username || externalAccountId,
              pageIdentifier: user.id || username || null,
              rawMeta: {
                accountType: user.account_type ?? null,
                profileImage: user.profile_image ?? null,
                profileSource: "user_account",
              },
            };
          }
        }

        const boardsRes = await fetch("https://api.pinterest.com/v5/boards?page_size=5", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (boardsRes.ok) {
          const boardsJson = (await boardsRes.json()) as {
            items?: Array<{ id?: string; name?: string; owner?: { username?: string } }>;
          };
          const board = boardsJson.items?.[0];
          const username = board?.owner?.username?.replace(/^@/, "") || null;
          if (username || board?.id) {
            return {
              externalAccountId: username || board!.id!,
              accountName: username || board?.name || "Pinterest Account",
              username: username || board?.id || null,
              pageIdentifier: board?.id || username || null,
              rawMeta: {
                profileSource: "boards_fallback",
                boardId: board?.id ?? null,
                meStatus: meRes.status,
              },
            };
          }
        }

        return {
          rawMeta: {
            profileSource: "failed",
            meStatus: meRes.status,
            hint: "Enable user_accounts:read on the Pinterest app, then reconnect.",
          },
        };
      }

      if (this.entry.code === "INSTAGRAM") {
        const version = "v21.0";
        const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
        pagesUrl.searchParams.set(
          "fields",
          "id,name,access_token,instagram_business_account{id,username,name}",
        );
        pagesUrl.searchParams.set("access_token", accessToken);
        const pagesRes = await fetch(pagesUrl);
        if (!pagesRes.ok) return {};
        const pagesJson = (await pagesRes.json()) as {
          data?: Array<{
            id: string;
            name: string;
            access_token?: string;
            instagram_business_account?: { id: string; username?: string; name?: string };
          }>;
        };
        const page = pagesJson.data?.find((p) => p.instagram_business_account?.id);
        const ig = page?.instagram_business_account;
        if (!page || !ig?.id) return {};
        return {
          externalAccountId: ig.id,
          accountName: ig.name || ig.username || page.name,
          username: ig.username || null,
          pageIdentifier: page.id,
          // Page token is required for Instagram content publishing.
          accessToken: page.access_token || accessToken,
          rawMeta: { pageId: page.id, igUserId: ig.id },
        };
      }

      if (this.entry.code === "THREADS") {
        // Prefer Threads Graph; fall back to Facebook Graph debug if token is Meta-shared.
        const attempts = [
          "https://graph.threads.net/v1.0/me",
          "https://graph.threads.net/me",
        ];
        for (const base of attempts) {
          const meUrl = new URL(base);
          meUrl.searchParams.set("fields", "id,username,name,threads_profile_picture_url");
          meUrl.searchParams.set("access_token", accessToken);
          const meRes = await fetch(meUrl);
          if (!meRes.ok) continue;
          const me = (await meRes.json()) as {
            id?: string;
            username?: string;
            name?: string;
            error?: { message?: string };
          };
          if (me.error || !me.id) continue;
          return {
            externalAccountId: me.id,
            accountName: me.name || (me.username ? `@${me.username}` : "Threads Profile"),
            username: me.username || me.id,
            pageIdentifier: me.id,
            rawMeta: { threadsUserId: me.id, profileSource: base },
          };
        }
        return {};
      }

      if (this.entry.code === "LINKEDIN") {
        const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) return {};
        const me = (await meRes.json()) as {
          sub?: string;
          name?: string;
          given_name?: string;
          family_name?: string;
          email?: string;
          picture?: string;
        };
        if (!me.sub) return {};
        const display =
          me.name ||
          [me.given_name, me.family_name].filter(Boolean).join(" ") ||
          me.email ||
          "LinkedIn Member";
        return {
          externalAccountId: me.sub,
          accountName: display,
          username: me.email || me.sub,
          pageIdentifier: me.sub,
          rawMeta: { linkedInSub: me.sub, picture: me.picture ?? null },
        };
      }

      if (this.entry.code === "X") {
        const meUrl = new URL("https://api.twitter.com/2/users/me");
        meUrl.searchParams.set("user.fields", "username,name,profile_image_url");
        const meRes = await fetch(meUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!meRes.ok) return {};
        const meJson = (await meRes.json()) as {
          data?: { id?: string; username?: string; name?: string; profile_image_url?: string };
        };
        const me = meJson.data;
        if (!me?.id) return {};
        return {
          externalAccountId: me.id,
          accountName: me.name || (me.username ? `@${me.username}` : "X Account"),
          username: me.username || me.id,
          pageIdentifier: me.id,
          rawMeta: { xUserId: me.id, profileImage: me.profile_image_url ?? null },
        };
      }

      if (this.entry.code === "YOUTUBE") {
        const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
        chUrl.searchParams.set("part", "snippet");
        chUrl.searchParams.set("mine", "true");
        const chRes = await fetch(chUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!chRes.ok) return {};
        const chJson = (await chRes.json()) as {
          items?: Array<{
            id?: string;
            snippet?: { title?: string; customUrl?: string };
          }>;
        };
        const channel = chJson.items?.[0];
        if (!channel?.id) return {};
        const custom = channel.snippet?.customUrl?.replace(/^@/, "") || null;
        return {
          externalAccountId: channel.id,
          accountName: channel.snippet?.title || "YouTube Channel",
          username: custom || channel.snippet?.title || channel.id,
          pageIdentifier: channel.id,
          rawMeta: { youtubeChannelId: channel.id, customUrl: custom },
        };
      }
    } catch {
      return {};
    }
    return {};
  }

  async refreshProfile(accessToken: string) {
    return this.fetchLiveProfile(accessToken);
  }

  async revoke(input: {
    accessToken: string;
    clientId: string;
    clientSecret: string;
    mode: AdapterAuthMode;
  }): Promise<void> {
    if (input.mode === "mock" || input.accessToken.startsWith("mock_")) return;
    // Provider-specific revocation varies; local disconnect always clears encrypted tokens.
  }
}
