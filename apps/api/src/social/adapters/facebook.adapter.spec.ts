import { FacebookAdapter } from "./facebook.adapter";

describe("FacebookAdapter", () => {
  const adapter = new FacebookAdapter();

  it("uses mock authorize URL that hits local callback", () => {
    const url = adapter.buildAuthorizeUrl(
      {
        clientId: "x",
        redirectUri: "http://localhost:4000/api/v1/oauth/callback",
        scopes: adapter.getDefaultScopes(),
        state: "abc123",
      },
      "mock",
    );
    expect(url).toContain("/api/v1/oauth/callback");
    expect(url).toContain("state=abc123");
    expect(url).toContain("code=mock_fb_");
  });

  it("exchanges mock code without calling Facebook", async () => {
    const result = await adapter.exchangeCode({
      code: "mock_fb_testcode",
      redirectUri: "http://localhost:4000/api/v1/oauth/callback",
      clientId: "x",
      clientSecret: "y",
      mode: "mock",
    });
    expect(result.mode).toBe("mock");
    expect(result.accessToken.startsWith("mock_fb_access_")).toBe(true);
    expect(result.accountName).toContain("Demo Facebook Page");
  });

  it("builds live Facebook dialog URL", () => {
    const url = adapter.buildAuthorizeUrl(
      {
        clientId: "123",
        redirectUri: "https://example.com/callback",
        scopes: ["pages_manage_posts"],
        state: "s1",
        apiVersion: "v21.0",
      },
      "live",
    );
    expect(url).toContain("https://www.facebook.com/v21.0/dialog/oauth");
    expect(url).toContain("client_id=123");
  });
});
