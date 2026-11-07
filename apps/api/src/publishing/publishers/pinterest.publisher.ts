import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/** Pinterest v5 pins (requires image + board). */
export class PinterestPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.PINTEREST;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_pin_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return { ok: true, externalPostId: id, mode: "mock", raw: { mock: true } };
    }

    if (!payload.media || payload.media.kind !== "IMAGE" || !payload.media.assetId) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "Pinterest requires an image attachment to publish.",
      };
    }

    try {
      const boardId = await this.resolveBoardId(payload.accessToken);
      if (!boardId) {
        return {
          ok: false,
          status: "FAILED",
          retryable: false,
          error: "No Pinterest board found. Create a board on Pinterest, then Publish again.",
        };
      }

      const imageUrl = buildSignedMediaUrl(payload.media.assetId, 3600);
      const body = {
        board_id: boardId,
        title: (payload.title || payload.caption || "SR Social Hub").slice(0, 100),
        description: [payload.caption, payload.hashtags].filter(Boolean).join("\n\n").slice(0, 500),
        media_source: {
          source_type: "image_url",
          url: imageUrl,
        },
        ...(payload.linkUrl ? { link: payload.linkUrl } : {}),
      };

      const res = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        id?: string;
        message?: string;
        code?: number;
      };
      if (!res.ok || !json.id) {
        return this.mapError(json.message || "Pinterest pin create failed", res.status);
      }
      return { ok: true, externalPostId: json.id, mode: "live", raw: json as Record<string, unknown> };
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "Pinterest publish error",
      };
    }
  }

  private async resolveBoardId(accessToken: string): Promise<string | null> {
    const res = await fetch("https://api.pinterest.com/v5/boards?page_size=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: Array<{ id?: string }> };
    return json.items?.[0]?.id || null;
  }

  private mapError(message: string, status?: number): PublishResult {
    if (status === 401 || status === 403 || /token|auth/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (status === 429 || /rate/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
