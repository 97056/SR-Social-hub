import { SocialPlatformCode } from "@prisma/client";

export type AdapterAuthMode = "live" | "mock" | "unavailable";

export type AdapterCapabilities = {
  publishText: boolean;
  publishImage: boolean;
  publishVideo: boolean;
  schedule: boolean;
  assistedOnly: boolean;
  notes?: string;
};

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  apiVersion?: string | null;
  /** Meta Login for Business configuration id. */
  configId?: string | null;
};

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  expiresAt?: Date | null;
  scopes: string[];
  externalAccountId: string;
  accountName?: string | null;
  username?: string | null;
  pageIdentifier?: string | null;
  capabilities: AdapterCapabilities;
  mode: AdapterAuthMode;
  rawMeta?: Record<string, unknown>;
};

export interface SocialAdapter {
  readonly code: SocialPlatformCode;
  readonly displayName: string;
  getDefaultScopes(): string[];
  getCapabilities(): AdapterCapabilities;
  resolveMode(hasCredentials: boolean): AdapterAuthMode;
  buildAuthorizeUrl(params: AuthorizeParams, mode: AdapterAuthMode): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
    mode: AdapterAuthMode;
    apiVersion?: string | null;
    /** PKCE verifier (required for X / Twitter OAuth 2.0). */
    codeVerifier?: string | null;
  }): Promise<TokenExchangeResult>;
  revoke?(input: {
    accessToken: string;
    clientId: string;
    clientSecret: string;
    mode: AdapterAuthMode;
  }): Promise<void>;
  /** Re-fetch provider profile for an existing access token (username / account id). */
  refreshProfile?(accessToken: string): Promise<{
    externalAccountId?: string;
    accountName?: string | null;
    username?: string | null;
    pageIdentifier?: string | null;
    accessToken?: string;
  }>;
}
