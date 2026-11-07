import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * LinkedIn member posts via REST Posts API (OpenID / w_member_social).
 */
export class LinkedInPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.LINKEDIN;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_li_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return { ok: true, externalPostId: id, mode: "mock", raw: { mock: true } };
    }

    const authorUrn = payload.externalAccountId.startsWith("urn:")
      ? payload.externalAccountId
      : `urn:li:person:${payload.externalAccountId}`;
    const text = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n");

    try {
      const body: Record<string, unknown> = {
        author: authorUrn,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };

      if (payload.media?.kind === "IMAGE" && payload.media.assetId) {
        // Image share via article/link fallback when upload API isn't available.
        body.content = {
          article: {
            source: buildSignedMediaUrl(payload.media.assetId, 3600),
            title: (payload.title || text).slice(0, 200),
            description: text.slice(0, 300),
          },
        };
      } else if (payload.linkUrl) {
        body.content = {
          article: {
            source: payload.linkUrl,
            title: (payload.title || text).slice(0, 200),
            description: text.slice(0, 300),
          },
        };
      }

      const res = await fetch("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202405",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let json: { id?: string; message?: string; status?: number } = {};
      try {
        json = JSON.parse(rawText) as typeof json;
      } catch {
        /* empty */
      }
      if (!res.ok) {
        return this.mapError(json.message || rawText.slice(0, 200) || "LinkedIn publish failed");
      }
      const postId = json.id || res.headers.get("x-restli-id") || "linkedin-post";
      return { ok: true, externalPostId: postId, mode: "live", raw: { id: postId } };
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "LinkedIn publish error",
      };
    }
  }

  private mapError(message: string): PublishResult {
    if (/token|auth|unauthorized|403|401/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (/rate|throttle|429/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
