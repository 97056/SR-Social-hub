import { SocialPlatformCode } from "@prisma/client";
import { FacebookPublisher } from "./facebook.publisher";
import { MockCapablePublisher } from "./mock.publisher";
import type { PlatformPublisher } from "./publisher.types";

const MOCK_PREFIX: Partial<Record<SocialPlatformCode, string>> = {
  INSTAGRAM: "ig",
  LINKEDIN: "li",
  X: "x",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  PINTEREST: "pin",
  THREADS: "th",
  GOOGLE_BUSINESS: "gbp",
};

export function createPublisherRegistry(): Map<SocialPlatformCode, PlatformPublisher> {
  const map = new Map<SocialPlatformCode, PlatformPublisher>();
  map.set(SocialPlatformCode.FACEBOOK, new FacebookPublisher());
  for (const [code, prefix] of Object.entries(MOCK_PREFIX) as Array<
    [SocialPlatformCode, string]
  >) {
    map.set(code, new MockCapablePublisher(code, prefix));
  }
  return map;
}
