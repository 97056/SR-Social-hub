import { MockAiProvider } from "./ai.provider";

describe("MockAiProvider", () => {
  const provider = new MockAiProvider();

  it("returns editable caption draft with disclaimer", async () => {
    const result = await provider.generate({
      feature: "caption",
      prompt: "Launch week",
      platform: "LINKEDIN",
      tone: "confident",
    });
    expect(result.provider).toBe("mock");
    expect(result.text).toContain("Launch week");
    expect(result.disclaimer.toLowerCase()).toContain("do not guarantee");
  });

  it("suggests hashtags", async () => {
    const result = await provider.generate({
      feature: "hashtags",
      prompt: "retail",
      industry: "Retail",
    });
    expect(result.suggestions?.length).toBeGreaterThan(0);
    expect(result.text).toContain("#");
  });
});
