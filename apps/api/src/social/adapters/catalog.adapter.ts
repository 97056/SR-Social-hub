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

    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
      grant_type: "authorization_code",
    });
    // X OAuth 2.0 authorize uses code_challenge_method=plain with fixed "challenge".
    const verifier =
      input.codeVerifier ||
      (this.entry.code === "X" ? "challenge" : null);
    if (verifier) body.set("code_verifier", verifier);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    // X requires HTTP Basic client authentication for confidential clients.
    if (this.entry.code === "X") {
      headers.Authorization = `Basic ${Buffer.from(
        `${input.clientId}:${input.clientSecret}`,
      ).toString("base64")}`;
    }

    const res = await fetch(this.entry.liveTokenUrl, {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) {
      throw new Error(`${this.displayName} token exchange failed: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!json.access_token) {
      throw new Error(`${this.displayName} token exchange returned no access_token`);
    }

    const suffix = createHash("sha256").update(json.access_token).digest("hex").slice(0, 8);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      tokenType: json.token_type ?? "bearer",
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: json.scope ? json.scope.split(/[,\s]+/) : this.getDefaultScopes(),
      externalAccountId: `${this.entry.mockPrefix}_live_${suffix}`,
      accountName: `${this.displayName} Connected Account`,
      username: `${this.entry.mockPrefix}_live_${suffix}`,
      pageIdentifier: `${this.entry.mockPrefix}_live_${suffix}`,
      capabilities: this.getCapabilities(),
      mode: "live",
      rawMeta: { provider: this.entry.code, live: true },
    };
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
