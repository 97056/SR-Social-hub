import { SocialPlatformCode } from "@prisma/client";
import { FacebookPublisher } from "./facebook.publisher";
import { InstagramPublisher } from "./instagram.publisher";
import { LinkedInPublisher } from "./linkedin.publisher";
import { PinterestPublisher } from "./pinterest.publisher";
import { ThreadsPublisher } from "./threads.publisher";
import { XPublisher } from "./x.publisher";
import { YouTubePublisher } from "./youtube.publisher";
import type { PlatformPublisher } from "./publisher.types";

export function createPublisherRegistry(): Map<SocialPlatformCode, PlatformPublisher> {
  const map = new Map<SocialPlatformCode, PlatformPublisher>();
  map.set(SocialPlatformCode.FACEBOOK, new FacebookPublisher());
  map.set(SocialPlatformCode.INSTAGRAM, new InstagramPublisher());
  map.set(SocialPlatformCode.THREADS, new ThreadsPublisher());
  map.set(SocialPlatformCode.LINKEDIN, new LinkedInPublisher());
  map.set(SocialPlatformCode.X, new XPublisher());
  map.set(SocialPlatformCode.PINTEREST, new PinterestPublisher());
  map.set(SocialPlatformCode.YOUTUBE, new YouTubePublisher());
  return map;
}
