import { FacebookPublisher } from "./facebook.publisher";

describe("FacebookPublisher", () => {
  const publisher = new FacebookPublisher();

  it("publishes mock posts without calling Graph API", async () => {
    const result = await publisher.publish({
      platformCode: "FACEBOOK",
      accessToken: "mock_fb_access_abc",
      externalAccountId: "mock_page_1",
      connectionMode: "mock",
      caption: "Hello world",
      media: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("mock");
      expect(result.externalPostId.startsWith("mock_fb_post_")).toBe(true);
    }
  });
});
