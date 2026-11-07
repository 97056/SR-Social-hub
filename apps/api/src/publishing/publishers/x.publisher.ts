import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/** X (Twitter) API v2 tweets. */
export class XPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.X;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_x_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return { ok: true, externalPostId: id, mode: "mock", raw: { mock: true } };
    }

    if (/^x_live_/i.test(payload.externalAccountId)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        retryable: false,
        error: "X account profile is incomplete. Disconnect X, connect again, then Publish.",
      };
    }

    const text = [payload.caption, payload.hashtags, payload.linkUrl]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 280);

    try {
      const body: Record<string, unknown> = { text };
      // Media upload for X needs v1.1 media/upload — attach public URL as text link when image present.
      if (payload.media?.kind === "IMAGE" && payload.media.assetId && !payload.linkUrl) {
        const url = buildSignedMediaUrl(payload.media.assetId, 3600);
        body.text = `${text}\n${url}`.slice(0, 280);
      }

      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: { id?: string };
        errors?: Array<{ message?: string; detail?: string }>;
        title?: string;
        detail?: string;
      };
      if (!res.ok || !json.data?.id) {
        const message =
          json.errors?.[0]?.detail ||
          json.errors?.[0]?.message ||
          json.detail ||
          json.title ||
          "X publish failed";
        return this.mapError(message, res.status);
      }
      return {
        ok: true,
        externalPostId: json.data.id,
        mode: "live",
        raw: json as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "X publish error",
      };
    }
  }

  private mapError(message: string, status?: number): PublishResult {
    if (status === 401 || status === 403 || /token|auth|unauthorized|forbidden/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (status === 429 || /rate/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
