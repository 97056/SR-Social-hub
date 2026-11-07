export type PublicBranding = {
  platformName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  loginHeadline: string;
  loginSubcopy: string;
  supportEmail: string;
  themeDefault: string;
  seoTitle?: string;
  seoDescription?: string;
  seoAuthor?: string;
  seoPublisher?: string;
  /** Comma-separated keyword pool; site rotates a subset every day. */
  seoKeywordPool?: string;
};

export const FALLBACK_BRANDING: PublicBranding = {
  platformName: "SR Social Hub",
  primaryColor: "#00D2FF",
  secondaryColor: "#C026FF",
  logoUrl: "/brand/logo.png",
  faviconUrl: "/brand/favicon.png",
  loginHeadline: "One spark. Every feed.",
  loginSubcopy:
    "Draft, approve, and publish across your networks from one neon command — without the tab chaos.",
  supportEmail: "support@srsocialhub.in",
  themeDefault: "dark",
  seoTitle: "SR Social Hub — Agency Social Media Command Center",
  seoDescription:
    "All-in-one social media management for agencies — create, approve, and publish across Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads.",
  seoAuthor: "SR Social Hub",
  seoPublisher: "SR Social Hub",
  seoKeywordPool: "",
};

export async function fetchPublicBranding(): Promise<PublicBranding> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${api}/api/v1/branding`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return FALLBACK_BRANDING;
    const data = (await res.json()) as Partial<PublicBranding>;
    return {
      ...FALLBACK_BRANDING,
      ...data,
      logoUrl: data.logoUrl || FALLBACK_BRANDING.logoUrl,
      faviconUrl: data.faviconUrl || FALLBACK_BRANDING.faviconUrl,
    };
  } catch {
    return FALLBACK_BRANDING;
  }
}
