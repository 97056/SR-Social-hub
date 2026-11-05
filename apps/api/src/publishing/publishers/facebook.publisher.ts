import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { MEDIA_ROOT } from "../../media/media.constants";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * Facebook Page publisher.
 * Mock mode confirms architecture only — never claimed as a live Facebook publication.
 * Live mode posts to Graph API /{page-id}/feed when a live token is present.
 */
export class FacebookPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.FACEBOOK;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_fb_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return {
        ok: true,
        externalPostId: id,
        mode: "mock",
        raw: { mock: true, pageId: payload.externalAccountId },
      };
    }

    try {
      const version = process.env.FACEBOOK_GRAPH_VERSION || "v21.0";
      const message = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n");

      if (payload.media?.kind === "IMAGE") {
        const abs = join(MEDIA_ROOT, payload.media.storageKey);
        const form = new FormData();
        form.set("message", message);
        form.set("access_token", payload.accessToken);

        if (existsSync(abs)) {
          const bytes = readFileSync(abs);
          form.set(
            "source",
            new Blob([new Uint8Array(bytes)], { type: payload.media.mimeType }),
            "upload.jpg",
          );
        } else if (payload.media.assetId) {
          // Prefer public URL when the file isn't on this disk (or after a prior no-volume deploy).
          form.set("url", buildSignedMediaUrl(payload.media.assetId, 3600));
        } else {
          return {
            ok: false,
            status: "FAILED",
            retryable: false,
            error:
              "Media file missing on server. Re-upload the image on the post, then Publish again.",
          };
        }

        const res = await fetch(
          `https://graph.facebook.com/${version}/${payload.externalAccountId}/photos`,
          { method: "POST", body: form },
        );
        const json = (await res.json()) as {
          id?: string;
          post_id?: string;
          error?: { message: string; code?: number };
        };
        if (!res.ok || json.error) {
          return this.mapError(json.error?.message ?? "Facebook photo publish failed", json.error?.code);
        }
        return {
          ok: true,
          externalPostId: json.post_id || json.id || "unknown",
          mode: "live",
          raw: json,
        };
      }

      const body = new URLSearchParams({
        message,
        access_token: payload.accessToken,
      });
      if (payload.linkUrl) body.set("link", payload.linkUrl);

      const res = await fetch(
        `https://graph.facebook.com/${version}/${payload.externalAccountId}/feed`,
        { method: "POST", body },
      );
      const json = (await res.json()) as { id?: string; error?: { message: string; code?: number } };
      if (!res.ok || json.error) {
        return this.mapError(json.error?.message ?? "Facebook feed publish failed", json.error?.code);
      }
      return {
        ok: true,
        externalPostId: json.id || "unknown",
        mode: "live",
        raw: json,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Facebook publish error";
      if (/ENOENT|no such file/i.test(message)) {
        return {
          ok: false,
          status: "FAILED",
          retryable: false,
          error: "Media file missing on server. Re-upload the image on the post, then Publish again.",
        };
      }
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: message,
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
