/** Default keyword pool — rotated daily so meta keywords stay fresh. */
export const DEFAULT_KEYWORD_POOL = [
  "social media management",
  "agency social hub",
  "multi network publishing",
  "Facebook scheduling",
  "Instagram content approval",
  "LinkedIn agency tools",
  "Threads publisher",
  "YouTube social workflow",
  "Pinterest scheduler",
  "X Twitter management",
  "client approval workflow",
  "social command center",
  "SR Social Hub",
  "agency client portals",
  "content calendar India",
  "social media SaaS",
  "brand publishing platform",
  "team collaboration social",
  "draft approve publish",
  "neon social OS",
];

/** Deterministic daily rotation from a keyword pool (UTC day index). */
export function dailyKeywords(pool: string[] | string | undefined, count = 10): string {
  const list = Array.isArray(pool)
    ? pool.map((k) => k.trim()).filter(Boolean)
    : typeof pool === "string"
      ? pool
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [];
  const source = list.length ? list : DEFAULT_KEYWORD_POOL;
  const day = Math.floor(Date.now() / 86_400_000);
  const picked: string[] = [];
  for (let i = 0; i < Math.min(count, source.length); i++) {
    picked.push(source[(day * 7 + i * 3) % source.length]!);
  }
  return [...new Set(picked)].join(", ");
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://srsocialhub.in";
export const SITE_AUTHOR = "SR Social Hub";
export const SITE_PUBLISHER = "SR Social Hub";
