import { SocialPlatformCode } from "@prisma/client";
import type { AdapterCapabilities } from "./social-adapter";

export type PlatformCatalogEntry = {
  code: SocialPlatformCode;
  displayName: string;
  mockPrefix: string;
  scopes: string[];
  capabilities: AdapterCapabilities;
  /** Official authorize endpoint for live mode (docs-backed). */
  liveAuthorizeUrl: (input: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    apiVersion?: string | null;
  }) => string;
  /** Optional live token exchange. When omitted, live mode falls back with a clear error. */
  liveTokenUrl?: string;
  accountLabel: string;
};

export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  {
    code: "INSTAGRAM",
    displayName: "Instagram",
    mockPrefix: "ig",
    accountLabel: "Instagram Professional Account",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ],
    capabilities: {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: false,
      assistedOnly: false,
      notes: "Requires Facebook Login + Instagram professional account linked to a Page.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state, apiVersion }) => {
      const version = apiVersion || "v21.0";
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        scope: scopes.join(","),
      });
      return `https://www.facebook.com/${version}/dialog/oauth?${q.toString()}`;
    },
    liveTokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
  },
  {
    code: "LINKEDIN",
    displayName: "LinkedIn",
    mockPrefix: "li",
    accountLabel: "LinkedIn Organization",
    scopes: ["openid", "profile", "w_member_social"],
    capabilities: {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: false,
      assistedOnly: false,
      notes: "Organization posting may require Marketing Developer Program access.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state }) => {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: scopes.join(" "),
      });
      return `https://www.linkedin.com/oauth/v2/authorization?${q.toString()}`;
    },
    liveTokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  },
  {
    code: "X",
    displayName: "X",
    mockPrefix: "x",
    accountLabel: "X User",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    capabilities: {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: false,
      assistedOnly: false,
      notes: "Write access depends on X API tier and app permissions.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state }) => {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(" "),
        state,
        code_challenge: "challenge",
        code_challenge_method: "plain",
      });
      return `https://twitter.com/i/oauth2/authorize?${q.toString()}`;
    },
    liveTokenUrl: "https://api.twitter.com/2/oauth2/token",
  },
  {
    code: "YOUTUBE",
    displayName: "YouTube",
    mockPrefix: "yt",
    accountLabel: "YouTube Channel",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    capabilities: {
      publishText: false,
      publishImage: false,
      publishVideo: true,
      schedule: true,
      assistedOnly: false,
      notes: "Requires Google OAuth + YouTube Data API quota. Video upload primary.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state }) => {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        state,
        prompt: "consent",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
    },
    liveTokenUrl: "https://oauth2.googleapis.com/token",
  },
  {
    code: "PINTEREST",
    displayName: "Pinterest",
    mockPrefix: "pin",
    accountLabel: "Pinterest Board Account",
    scopes: ["boards:read", "boards:write", "pins:read", "pins:write"],
    capabilities: {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: false,
      assistedOnly: false,
      notes: "Production pin creation requires approved Pinterest API access.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state }) => {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(","),
        state,
      });
      return `https://www.pinterest.com/oauth/?${q.toString()}`;
    },
    liveTokenUrl: "https://api.pinterest.com/v5/oauth/token",
  },
  {
    code: "THREADS",
    displayName: "Threads",
    mockPrefix: "th",
    accountLabel: "Threads Profile",
    scopes: ["threads_basic", "threads_content_publish"],
    capabilities: {
      publishText: true,
      publishImage: true,
      publishVideo: true,
      schedule: false,
      assistedOnly: false,
      notes: "Uses Meta Threads API where officially available for the account type.",
    },
    liveAuthorizeUrl: ({ clientId, redirectUri, scopes, state }) => {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(","),
        response_type: "code",
        state,
      });
      return `https://threads.net/oauth/authorize?${q.toString()}`;
    },
    liveTokenUrl: "https://graph.threads.net/oauth/access_token",
  },
];
