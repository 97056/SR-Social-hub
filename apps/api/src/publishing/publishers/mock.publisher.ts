import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * Architecture-confirming publisher for platforms with mock-connected accounts.
 * Never claims a live provider publication.
 */
export class MockCapablePublisher implements PlatformPublisher {
  constructor(
    readonly code: SocialPlatformCode,
    private readonly prefix: string,
  ) {}

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_${this.prefix}_post_${createHash("sha256")
        .update(
          `${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`,
        )
        .digest("hex")
        .slice(0, 12)}`;
      return {
        ok: true,
        externalPostId: id,
        mode: "mock",
        raw: { mock: true, provider: this.code },
      };
    }

    // Live auto-publish for non-Facebook platforms ships incrementally after provider approval.
    return {
      ok: false,
      status: "ASSISTED_REQUIRED",
      error: `${this.code} live auto-publish requires verified provider credentials and adapter certification. Mock mode is available for architecture testing.`,
      retryable: false,
    };
  }
}
