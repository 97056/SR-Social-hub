import { SocialPlatformCode } from "@prisma/client";

export type PlatformRule = {
  captionMax: number;
  titleMax?: number;
  descriptionMax?: number;
  requiresTitle?: boolean;
  supportsHashtags: boolean;
  supportsLink: boolean;
  imageRequired?: boolean;
  notes: string;
};

export const PLATFORM_RULES: Record<SocialPlatformCode, PlatformRule> = {
  FACEBOOK: {
    captionMax: 63206,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Page posts support text, image, and video.",
  },
  INSTAGRAM: {
    captionMax: 2200,
    supportsHashtags: true,
    supportsLink: false,
    imageRequired: true,
    notes: "Feed posts require image/video; link stickers are limited.",
  },
  LINKEDIN: {
    captionMax: 3000,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Professional tone recommended.",
  },
  X: {
    captionMax: 280,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Concise posts; media optional.",
  },
  YOUTUBE: {
    captionMax: 5000,
    titleMax: 100,
    descriptionMax: 5000,
    requiresTitle: true,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Requires title + description; video preferred.",
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
    notes: "Title and description recommended for pins.",
  },
  THREADS: {
    captionMax: 500,
    supportsHashtags: true,
    supportsLink: true,
    notes: "Text/image/video where officially supported.",
  },
  // Kept for Prisma enum compatibility; product UI/API exclude Google Business.
  GOOGLE_BUSINESS: {
    captionMax: 1500,
    supportsHashtags: false,
    supportsLink: true,
    notes: "Unavailable — Google Business Profile is not offered.",
  },
};
