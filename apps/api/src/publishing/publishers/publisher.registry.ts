import { SocialPlatformCode } from "@prisma/client";
import { FacebookPublisher } from "./facebook.publisher";
import { InstagramPublisher } from "./instagram.publisher";
import { MockCapablePublisher } from "./mock.publisher";
import { ThreadsPublisher } from "./threads.publisher";
import type { PlatformPublisher } from "./publisher.types";

const MOCK_PREFIX: Partial<Record<SocialPlatformCode, string>> = {
  LINKEDIN: "li",
  X: "x",
  YOUTUBE: "yt",
  PINTEREST: "pin",
};

export function createPublisherRegistry(): Map<SocialPlatformCode, PlatformPublisher> {
  const map = new Map<SocialPlatformCode, PlatformPublisher>();
  map.set(SocialPlatformCode.FACEBOOK, new FacebookPublisher());
  map.set(SocialPlatformCode.INSTAGRAM, new InstagramPublisher());
  map.set(SocialPlatformCode.THREADS, new ThreadsPublisher());
  for (const [code, prefix] of Object.entries(MOCK_PREFIX) as Array<
    [SocialPlatformCode, string]
  >) {
    map.set(code, new MockCapablePublisher(code, prefix));
  }
  return map;
}
