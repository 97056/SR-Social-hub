import { SocialPlatformCode } from "@prisma/client";
import { CatalogSocialAdapter } from "./catalog.adapter";
import { FacebookAdapter } from "./facebook.adapter";
import { PLATFORM_CATALOG } from "./platform-catalog";
import type { SocialAdapter } from "./social-adapter";

export function createAdapterRegistry(): Map<SocialPlatformCode, SocialAdapter> {
  const map = new Map<SocialPlatformCode, SocialAdapter>();
  map.set(SocialPlatformCode.FACEBOOK, new FacebookAdapter());
  for (const entry of PLATFORM_CATALOG) {
    map.set(entry.code, new CatalogSocialAdapter(entry));
  }
  return map;
}
