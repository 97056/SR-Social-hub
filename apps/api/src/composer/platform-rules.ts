import { SocialPlatformCode } from "@prisma/client";

export type PlatformRule = {
  captionMax: number;
  titleMax?: number;
  descriptionMax?: number;
  requiresTitle?: boolean;
  supportsHashtags: boolean;
  supportsLink: boolean;
  imageRequired?: boolean;
  /** Platform only accepts video media (e.g. YouTube). */
  videoRequired?: boolean;
  notes: string;
};

/**
 * Official / documented API text ceilings we enforce in composer validation.
 * Facebook’s ~63k is a soft practical ceiling (rarely hit); X/Threads/Pinterest are hard.
 */
export const PLATFORM_RULES: Record<SocialPlatformCode, PlatformRule> = {
  FACEBOOK: {
    captionMax: 63206,
    supportsHashtags: true,
    supportsLink: true,
    notes: "No practical short caption limit (API allows up to ~63k). Text, image, and video.",
  },
  INSTAGRAM: {
    captionMax: 2200,
    supportsHashtags: true,
    supportsLink: false,
    imageRequired: true,
    notes: "Caption max 2,200. Feed posts require image/video.",
  },
  LINKEDIN: {
    captionMax: 3000,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Caption max 3,000. Professional tone recommended.",
  },
  X: {
    captionMax: 280,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Hard limit 280 characters (links count toward the limit).",
  },
  YOUTUBE: {
    captionMax: 5000,
    titleMax: 100,
    descriptionMax: 5000,
    requiresTitle: true,
    supportsHashtags: true,
    supportsLink: true,
    notes:
      "Title max 100 · description max 5,000. Video → channel upload. Image → published as a short public video (no Community API).",
  },
  // Kept for Prisma enum compatibility; product UI/API exclude TikTok.
  TIKTOK: {
    captionMax: 2200,
    supportsHashtags: true,
    supportsLink: false,
    notes: "Unavailable — TikTok developer access is not offered.",
  },
  PINTEREST: {
    captionMax: 500,
    titleMax: 100,
    descriptionMax: 500,
    requiresTitle: true,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Title max 100 · pin description/caption max 500.",
  },
  THREADS: {
    captionMax: 500,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Hard limit 500 characters per Threads post.",
  },
  // Kept for Prisma enum compatibility; product UI/API exclude Google Business.
  GOOGLE_BUSINESS: {
    captionMax: 1500,
    supportsHashtags: false,
    supportsLink: true,
    notes: "Unavailable — Google Business Profile is not offered.",
  },
};
