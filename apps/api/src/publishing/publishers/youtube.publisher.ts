import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { MEDIA_ROOT } from "../../media/media.constants";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/** YouTube Data API — video upload only. */
export class YouTubePublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.YOUTUBE;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_yt_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return { ok: true, externalPostId: id, mode: "mock", raw: { mock: true } };
    }

    if (!payload.media || payload.media.kind !== "VIDEO") {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube publishing requires a video attachment.",
      };
    }

    const abs = join(MEDIA_ROOT, payload.media.storageKey);
    if (!existsSync(abs)) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "Video file missing on server. Re-upload, then Publish again.",
      };
    }

    try {
      const title = (payload.title || payload.caption || "SR Social Hub video").slice(0, 100);
      const description = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n").slice(0, 5000);
      const metadata = {
        snippet: {
          title,
          description,
          categoryId: "22",
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      };

      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": payload.media.mimeType || "video/mp4",
          },
          body: JSON.stringify(metadata),
        },
      );
      if (!initRes.ok) {
        const errText = await initRes.text();
        return this.mapError(errText.slice(0, 220), initRes.status);
      }
      const uploadUrl = initRes.headers.get("location");
      if (!uploadUrl) {
        return { ok: false, status: "FAILED", error: "YouTube did not return an upload URL", retryable: false };
      }

      const bytes = readFileSync(abs);
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          "Content-Type": payload.media.mimeType || "video/mp4",
          "Content-Length": String(bytes.length),
        },
        body: bytes,
      });
      const json = (await uploadRes.json()) as { id?: string; error?: { message?: string } };
      if (!uploadRes.ok || !json.id) {
        return this.mapError(json.error?.message || "YouTube upload failed", uploadRes.status);
      }
      return { ok: true, externalPostId: json.id, mode: "live", raw: json as Record<string, unknown> };
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "YouTube publish error",
      };
    }
  }

  private mapError(message: string, status?: number): PublishResult {
    if (status === 401 || status === 403 || /token|auth|login/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (status === 429 || /rate/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
