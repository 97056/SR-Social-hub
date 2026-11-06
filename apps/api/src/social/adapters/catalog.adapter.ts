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

    const profile = await this.fetchLiveProfile(json.access_token);
    const accessToken = profile.accessToken || json.access_token;
    const suffix = createHash("sha256").update(accessToken).digest("hex").slice(0, 8);
    const requiresRealProfile =
      this.entry.code === "THREADS" ||
      this.entry.code === "INSTAGRAM" ||
      this.entry.code === "FACEBOOK";
    if (requiresRealProfile && !profile.externalAccountId) {
      throw new Error(
        `${this.displayName} connected but profile lookup failed. Check app permissions / Live mode, then reconnect.`,
      );
    }
    return {
      accessToken,
      refreshToken: json.refresh_token ?? null,
      tokenType: json.token_type ?? "bearer",
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
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
        const res = await fetch("https://api.pinterest.com/v5/user_account", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return {};
        const user = (await res.json()) as {
          id?: string;
          username?: string;
          business_name?: string;
          account_type?: string;
        };
        const username = user.username || null;
        return {
          externalAccountId: user.id || username || undefined,
          accountName: user.business_name || username || "Pinterest Account",
          username,
          pageIdentifier: user.id || username || null,
          rawMeta: { accountType: user.account_type ?? null },
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
    } catch {
      return {};
    }
    return {};
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
