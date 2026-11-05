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
});
