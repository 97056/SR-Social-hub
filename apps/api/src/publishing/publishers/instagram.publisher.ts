import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * Instagram professional account publisher (Graph Content Publishing).
 * Live mode: create media container with public image_url, then media_publish.
 */
export class InstagramPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.INSTAGRAM;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_ig_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return {
        ok: true,
        externalPostId: id,
        mode: "mock",
        raw: { mock: true, provider: "INSTAGRAM" },
      };
    }

    // Old connects stored a hash placeholder (ig_live_…) instead of a real IG user id.
    if (/^ig_live_/i.test(payload.externalAccountId) || !/^\d+$/.test(payload.externalAccountId)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        retryable: false,
        error:
          "Instagram account ID is invalid. Disconnect Instagram, connect again (must link a Professional account to a Facebook Page), then Publish.",
      };
    }

    if (!payload.media || payload.media.kind !== "IMAGE") {
      return {
        ok: false,
        status: "FAILED",
        error: "Instagram requires an image attachment to publish via API",
        retryable: false,
      };
    }

    try {
      const version = process.env.FACEBOOK_GRAPH_VERSION || "v21.0";
      const caption = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n");
      if (!payload.media.assetId) {
        return {
          ok: false,
          status: "FAILED",
          error: "Instagram publish needs a media asset id for a public image URL",
          retryable: false,
        };
      }
      const imageUrl = buildSignedMediaUrl(payload.media.assetId, 3600);

      const createBody = new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: payload.accessToken,
      });
      const createRes = await fetch(
        `https://graph.facebook.com/${version}/${payload.externalAccountId}/media`,
        { method: "POST", body: createBody },
      );
      const createJson = (await createRes.json()) as {
        id?: string;
        error?: { message: string; code?: number };
      };
      if (!createRes.ok || createJson.error || !createJson.id) {
        return this.mapError(
          createJson.error?.message ?? "Instagram media container failed",
          createJson.error?.code,
        );
      }

      // Brief wait helps container finish processing before publish.
      await new Promise((r) => setTimeout(r, 1500));

      const publishBody = new URLSearchParams({
        creation_id: createJson.id,
        access_token: payload.accessToken,
      });
      const publishRes = await fetch(
        `https://graph.facebook.com/${version}/${payload.externalAccountId}/media_publish`,
        { method: "POST", body: publishBody },
      );
      const publishJson = (await publishRes.json()) as {
        id?: string;
        error?: { message: string; code?: number };
      };
      if (!publishRes.ok || publishJson.error || !publishJson.id) {
        return this.mapError(
          publishJson.error?.message ?? "Instagram media_publish failed",
          publishJson.error?.code,
        );
      }

      return {
        ok: true,
        externalPostId: publishJson.id,
        mode: "live",
        raw: { containerId: createJson.id, mediaId: publishJson.id },
      };
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "Instagram publish error",
      };
    }
  }

  private mapError(message: string, code?: number): PublishResult {
    if (code === 190 || /session|oauth|token/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (code === 4 || code === 17 || /rate limit/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
