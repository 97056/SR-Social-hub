import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildFacebookDialogAuthorizeUrl } from "./meta-oauth";
import type {
  AdapterAuthMode,
  AdapterCapabilities,
  AuthorizeParams,
  SocialAdapter,
  TokenExchangeResult,
} from "./social-adapter";

/**
 * Facebook Graph API adapter.
 * Live mode uses official OAuth dialog + token exchange.
 * Mock mode validates architecture without claiming a real Facebook publication.
 * Docs: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 */
export class FacebookAdapter implements SocialAdapter {
  readonly code = SocialPlatformCode.FACEBOOK;
  readonly displayName = "Facebook";

  getDefaultScopes(): string[] {
    return ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "public_profile"];
  }

  getCapabilities(): AdapterCapabilities {
    return {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: true,
      assistedOnly: false,
      notes: "Page publishing requires a Facebook Page and pages_manage_posts permission.",
    };
  }

  resolveMode(hasCredentials: boolean): AdapterAuthMode {
    if (process.env.SOCIAL_OAUTH_MODE === "mock") return "mock";
    if (hasCredentials) return "live";
    if (process.env.SOCIAL_OAUTH_MODE === "live") return "unavailable";
    return "mock";
  }

  buildAuthorizeUrl(params: AuthorizeParams, mode: AdapterAuthMode): string {
    if (mode === "mock") {
      const base = process.env.API_URL ?? "http://localhost:4000";
      const q = new URLSearchParams({
        code: `mock_fb_${randomBytes(8).toString("hex")}`,
        state: params.state,
      });
      return `${base}/api/v1/oauth/callback?${q.toString()}`;
    }

    return buildFacebookDialogAuthorizeUrl({
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      state: params.state,
      scopes: params.scopes,
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
    if (input.mode === "mock" || input.code.startsWith("mock_fb_")) {
      const suffix = createHash("sha256").update(input.code).digest("hex").slice(0, 8);
      return {
        accessToken: `mock_fb_access_${suffix}`,
        refreshToken: null,
        tokenType: "bearer",
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        scopes: this.getDefaultScopes(),
        externalAccountId: `mock_page_${suffix}`,
        accountName: "Demo Facebook Page",
        username: `demo.page.${suffix}`,
        pageIdentifier: `mock_page_${suffix}`,
        capabilities: this.getCapabilities(),
        mode: "mock",
        rawMeta: { mock: true, provider: "facebook" },
      };
    }

    const version = input.apiVersion || "v21.0";
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", input.clientId);
    tokenUrl.searchParams.set("client_secret", input.clientSecret);
    tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
    tokenUrl.searchParams.set("code", input.code);

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Facebook token exchange failed: ${body}`);
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };

    // Upgrade short-lived user token → long-lived (~60d) before resolving pages.
    let userToken = tokenJson.access_token;
    let expiresIn = tokenJson.expires_in;
    try {
      const llUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
      llUrl.searchParams.set("grant_type", "fb_exchange_token");
      llUrl.searchParams.set("client_id", input.clientId);
      llUrl.searchParams.set("client_secret", input.clientSecret);
      llUrl.searchParams.set("fb_exchange_token", userToken);
      const llRes = await fetch(llUrl);
      if (llRes.ok) {
        const llJson = (await llRes.json()) as { access_token?: string; expires_in?: number };
        if (llJson.access_token) {
          userToken = llJson.access_token;
          expiresIn = llJson.expires_in ?? 60 * 24 * 60 * 60;
        }
      }
    } catch {
      /* keep short-lived */
    }

    const meUrl = new URL(`https://graph.facebook.com/${version}/me`);
    meUrl.searchParams.set("fields", "id,name");
    meUrl.searchParams.set("access_token", userToken);
    const meRes = await fetch(meUrl);
    if (!meRes.ok) {
      throw new Error(`Facebook profile fetch failed: ${await meRes.text()}`);
    }
    const me = (await meRes.json()) as { id: string; name?: string };

    let pageId = me.id;
    let pageName = me.name ?? "Facebook User";
    let username: string | null = null;
    let accessToken = userToken;
    // Page tokens from a long-lived user token typically do not expire.
    let pageTokenExpires: number | null = null;

    const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
    pagesUrl.searchParams.set("access_token", userToken);
    const pagesRes = await fetch(pagesUrl);
    if (pagesRes.ok) {
      const pagesJson = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string; access_token?: string }>;
      };
      if (pagesJson.data?.length) {
        pageId = pagesJson.data[0].id;
        pageName = pagesJson.data[0].name;
        username = pagesJson.data[0].name;
        if (pagesJson.data[0].access_token) {
          accessToken = pagesJson.data[0].access_token;
          pageTokenExpires = null;
        }
      }
    }

    return {
      accessToken,
      refreshToken: null,
      tokenType: tokenJson.token_type ?? "bearer",
      expiresAt:
        pageTokenExpires === null && accessToken !== userToken
          ? null
          : expiresIn
            ? new Date(Date.now() + expiresIn * 1000)
            : null,
      scopes: this.getDefaultScopes(),
      externalAccountId: pageId,
      accountName: pageName,
      username,
      pageIdentifier: pageId,
      capabilities: this.getCapabilities(),
      mode: "live",
      rawMeta: { provider: "facebook", userId: me.id },
    };
  }

  async refreshProfile(accessToken: string) {
    const version = "v21.0";
    const meUrl = new URL(`https://graph.facebook.com/${version}/me`);
    meUrl.searchParams.set("fields", "id,name");
    meUrl.searchParams.set("access_token", accessToken);
    const meRes = await fetch(meUrl);
    if (!meRes.ok) return {};
    const me = (await meRes.json()) as { id: string; name?: string };

    const pagesUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
    pagesUrl.searchParams.set("access_token", accessToken);
    const pagesRes = await fetch(pagesUrl);
    if (pagesRes.ok) {
      const pagesJson = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string; access_token?: string }>;
      };
      if (pagesJson.data?.length) {
        return {
          externalAccountId: pagesJson.data[0].id,
          accountName: pagesJson.data[0].name,
          username: pagesJson.data[0].name,
          pageIdentifier: pagesJson.data[0].id,
          accessToken: pagesJson.data[0].access_token || accessToken,
        };
      }
    }
    return {
      externalAccountId: me.id,
      accountName: me.name ?? "Facebook User",
      username: me.name ?? me.id,
      pageIdentifier: me.id,
    };
  }

  async revoke(input: {
    accessToken: string;
    clientId: string;
    clientSecret: string;
    mode: AdapterAuthMode;
  }): Promise<void> {
    if (input.mode === "mock" || input.accessToken.startsWith("mock_")) return;
    const url = new URL("https://graph.facebook.com/me/permissions");
    url.searchParams.set("access_token", input.accessToken);
    await fetch(url, { method: "DELETE" });
  }
}
