import { CatalogSocialAdapter } from "./catalog.adapter";
import { PLATFORM_CATALOG } from "./platform-catalog";

describe("CatalogSocialAdapter", () => {
  it("covers six non-Facebook platforms", () => {
    expect(PLATFORM_CATALOG).toHaveLength(6);
  });

  it.each(PLATFORM_CATALOG.map((e) => [e.code, e]))(
    "%s mock authorize hits local callback",
    (_code, entry) => {
      const adapter = new CatalogSocialAdapter(entry);
      const url = adapter.buildAuthorizeUrl(
        {
          clientId: "x",
          redirectUri: "http://localhost:4000/api/v1/oauth/callback",
          scopes: adapter.getDefaultScopes(),
          state: "state1",
        },
        "mock",
      );
      expect(url).toContain("/api/v1/oauth/callback");
      expect(url).toContain(`code=mock_${entry.mockPrefix}_`);
      expect(url).toContain("state=state1");
    },
  );

  it("exchanges Instagram mock code", async () => {
    const ig = PLATFORM_CATALOG.find((e) => e.code === "INSTAGRAM")!;
    const adapter = new CatalogSocialAdapter(ig);
    const result = await adapter.exchangeCode({
      code: "mock_ig_abc",
      redirectUri: "http://localhost:4000/api/v1/oauth/callback",
      clientId: "x",
      clientSecret: "y",
      mode: "mock",
    });
    expect(result.mode).toBe("mock");
    expect(result.accessToken.startsWith("mock_ig_access_")).toBe(true);
    expect(result.accountName).toContain("Instagram");
  });

  it("exchanges Pinterest live code with Basic auth and form body (no JSON)", async () => {
    const pin = PLATFORM_CATALOG.find((e) => e.code === "PINTEREST")!;
    const adapter = new CatalogSocialAdapter(pin);
    const fetchMock = jest.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/oauth/token")) {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("1634460:secret").toString("base64")}`,
        });
        const body = String(init?.body);
        expect(body).toContain("grant_type=authorization_code");
        expect(body).toContain("code=auth-code");
        expect(body).toContain(
          `redirect_uri=${encodeURIComponent("https://api.srsocialhub.in/api/v1/oauth/callback")}`,
        );
        expect(body).not.toContain("client_id=");
        expect(body).not.toContain("client_secret=");
        expect(body.trim().startsWith("{")).toBe(false);
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              access_token: "pin-access",
              refresh_token: "pin-refresh",
              token_type: "bearer",
              expires_in: 2592000,
              scope: "boards:read,boards:write,pins:read,pins:write",
            }),
        } as Response;
      }
      if (href.includes("/user_account")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: "pin-user-1",
            username: "gopi",
            business_name: "Path2carrer",
            account_type: "BUSINESS",
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${href}`);
    });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const result = await adapter.exchangeCode({
        code: "auth-code",
        redirectUri: "https://api.srsocialhub.in/api/v1/oauth/callback",
        clientId: "1634460",
        clientSecret: "secret",
        mode: "live",
      });
      expect(result.mode).toBe("live");
      expect(result.accessToken).toBe("pin-access");
      expect(result.refreshToken).toBe("pin-refresh");
      expect(result.externalAccountId).toBe("pin-user-1");
      expect(result.username).toBe("gopi");
      expect(result.accountName).toBe("Path2carrer");
    } finally {
      global.fetch = original;
    }
  });
});
