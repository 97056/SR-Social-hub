import { SocialPlatformCode } from "@prisma/client";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/** Platforms without a verified auto-publish adapter yet. */
export class AssistedPublisher implements PlatformPublisher {
  constructor(readonly code: SocialPlatformCode) {}

  async publish(_payload: PublishPayload): Promise<PublishResult> {
    return {
      ok: false,
      status: "ASSISTED_REQUIRED",
      error: `${this.code} automatic publishing is not available yet. Use assisted publishing.`,
      retryable: false,
    };
  }
}
