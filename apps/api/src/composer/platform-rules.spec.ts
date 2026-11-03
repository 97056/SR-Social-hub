import { PLATFORM_RULES } from "./platform-rules";

describe("PLATFORM_RULES", () => {
  it("defines rules for all nine platforms", () => {
    expect(Object.keys(PLATFORM_RULES)).toHaveLength(9);
    expect(PLATFORM_RULES.X.captionMax).toBe(280);
    expect(PLATFORM_RULES.INSTAGRAM.imageRequired).toBe(true);
    expect(PLATFORM_RULES.YOUTUBE.requiresTitle).toBe(true);
  });
});
