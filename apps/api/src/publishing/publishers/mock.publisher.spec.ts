import { MockCapablePublisher } from "./mock.publisher";

describe("MockCapablePublisher", () => {
  it("publishes mock LinkedIn posts", async () => {
    const publisher = new MockCapablePublisher("LINKEDIN", "li");
    const result = await publisher.publish({
      platformCode: "LINKEDIN",
      accessToken: "mock_li_access_x",
      externalAccountId: "mock_li_acct",
      connectionMode: "mock",
      caption: "Hello LinkedIn",
      media: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("mock");
      expect(result.externalPostId.startsWith("mock_li_post_")).toBe(true);
    }
  });

  it("requires assisted flow for live non-Facebook publish", async () => {
    const publisher = new MockCapablePublisher("X", "x");
    const result = await publisher.publish({
      platformCode: "X",
      accessToken: "live-token",
      externalAccountId: "123",
      connectionMode: "live",
      caption: "Hello X",
      media: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("ASSISTED_REQUIRED");
  });
});
