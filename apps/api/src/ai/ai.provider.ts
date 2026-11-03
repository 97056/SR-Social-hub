export type AiGenerateInput = {
  feature: string;
  prompt: string;
  tone?: string;
  language?: string;
  platform?: string;
  industry?: string;
  audience?: string;
  brandVoice?: string;
};

export type AiGenerateResult = {
  provider: string;
  text: string;
  suggestions?: string[];
  disclaimer: string;
};

export interface AiProvider {
  readonly name: string;
  generate(input: AiGenerateInput): Promise<AiGenerateResult>;
}

const DISCLAIMER =
  "AI suggestions are drafts for editing. They do not guarantee engagement or conversions.";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async generate(input: AiGenerateInput): Promise<AiGenerateResult> {
    const tone = input.tone || "professional";
    const lang = input.language || "English";
    const platform = input.platform || "social";
    const voice = input.brandVoice || input.industry || "your brand";

    if (input.feature === "hashtags") {
      const tags = [
        "#SRSocialHub",
        `#${(input.industry || "Marketing").replace(/\s+/g, "")}`,
        "#ContentMarketing",
        "#SocialMedia",
        "#Growth",
        `#${platform}`,
      ];
      return {
        provider: this.name,
        text: tags.join(" "),
        suggestions: tags,
        disclaimer: DISCLAIMER,
      };
    }

    if (input.feature === "cta") {
      return {
        provider: this.name,
        text: `Ready to take the next step with ${voice}? Tap learn more today.`,
        disclaimer: DISCLAIMER,
      };
    }

    if (input.feature === "rewrite") {
      return {
        provider: this.name,
        text: `[${platform} · ${tone} · ${lang}] ${input.prompt.trim()} — crafted for clarity and on-brand pacing.`,
        disclaimer: DISCLAIMER,
      };
    }

    if (input.feature === "ideas") {
      const ideas = [
        `Behind-the-scenes look at ${voice}`,
        `Customer story spotlight in a ${tone} tone`,
        `Seasonal tip series for ${input.audience || "your audience"}`,
        `Myth vs fact carousel about ${input.industry || "your category"}`,
      ];
      return {
        provider: this.name,
        text: ideas.map((i, idx) => `${idx + 1}. ${i}`).join("\n"),
        suggestions: ideas,
        disclaimer: DISCLAIMER,
      };
    }

    // caption default
    return {
      provider: this.name,
      text: `${input.prompt.trim() || `Fresh update from ${voice}`}\n\nWritten for ${platform} in a ${tone} ${lang} voice. Keep what fits your brand—edit freely before publishing.`,
      disclaimer: DISCLAIMER,
    };
  }
}
