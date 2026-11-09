/**
 * Platforms that share Meta Facebook Login / Login for Business.
 * Threads uses its own threads.net OAuth + Threads App ID/Secret — keep it out of this set
 * so it does not inherit Facebook Login config_id / dialog settings.
 */
export const META_LOGIN_PLATFORMS = new Set(["FACEBOOK", "INSTAGRAM"]);

export function resolveMetaRedirectUri(platformRedirectUri?: string | null): string {
  return (
    platformRedirectUri ||
    process.env.FACEBOOK_REDIRECT_URI ||
    process.env.META_REDIRECT_URI ||
    `${process.env.API_URL ?? "http://localhost:4000"}/api/v1/oauth/callback`
  );
}

export function resolveMetaConfigId(
  platformCode: string,
  platformConfigId?: string | null,
): string | null {
  if (!META_LOGIN_PLATFORMS.has(platformCode)) return platformConfigId ?? null;
  return (
    platformConfigId ||
    process.env.FACEBOOK_CONFIG_ID ||
    process.env.META_CONFIG_ID ||
    null
  );
}

/**
 * Facebook Login / Login for Business authorize URL.
 * When configId is set, scopes come from the Meta configuration (do not send scope).
 */
export function buildFacebookDialogAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  apiVersion?: string | null;
  configId?: string | null;
}): string {
  const version = input.apiVersion || "v21.0";
  const q = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
  });
  if (input.configId) {
    q.set("config_id", input.configId);
  } else if (input.scopes.length) {
    q.set("scope", input.scopes.join(","));
  }
  return `https://www.facebook.com/${version}/dialog/oauth?${q.toString()}`;
}
