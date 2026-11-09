import { SocialPlatformCode } from "@prisma/client";
import { execFile } from "child_process";
import { createHash, randomBytes } from "crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { MEDIA_ROOT } from "../../media/media.constants";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

const execFileAsync = promisify(execFile);

/**
 * YouTube publisher:
 * - VIDEO → Data API resumable upload
 * - IMAGE → short video derived from the image (official Data API)
 *
 * Google has no public Community / Posts API. Studio Innertube needs browser
 * cookies (SAPISIDHASH), not OAuth Bearer — so Community attempts always 400.
 * Image posts are therefore published as a short public video with the caption
 * as title/description.
 */
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

    if (payload.media?.kind === "IMAGE") {
      return this.publishImageAsVideo(payload);
    }

    if (payload.media?.kind === "VIDEO") {
      return this.publishVideo(payload);
    }

    return {
      ok: false,
      status: "FAILED",
      retryable: false,
      error:
        "YouTube has no public Community/Posts API. Attach a video (or an image — we publish it as a short video), then Retry.",
    };
  }

  private async publishImageAsVideo(payload: PublishPayload): Promise<PublishResult> {
    if (!payload.media?.storageKey) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube image publish requires an image attachment.",
      };
    }
    const abs = join(MEDIA_ROOT, payload.media.storageKey);
    if (!existsSync(abs)) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "Image file missing on server. Re-upload, then Publish again.",
      };
    }

    const workDir = mkdtempSync(join(tmpdir(), "yt-img-"));
    const outPath = join(workDir, "slide.mp4");
    const relKey = `_tmp/yt_${Date.now()}_${randomBytes(4).toString("hex")}.mp4`;
    const dest = join(MEDIA_ROOT, relKey);

    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-loop",
          "1",
          "-i",
          abs,
          "-t",
          "5",
          "-vf",
          "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-movflags",
          "+faststart",
          outPath,
        ],
        { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
      );

      mkdirSync(join(MEDIA_ROOT, "_tmp"), { recursive: true });
      copyFileSync(outPath, dest);

      const result = await this.publishVideo({
        ...payload,
        media: {
          kind: "VIDEO",
          mimeType: "video/mp4",
          storageKey: relKey,
          assetId: payload.media.assetId,
        },
      });

      if (result.ok) {
        return {
          ...result,
          raw: {
            ...(result.raw || {}),
            imageAsVideo: true,
            note: "YouTube Community API is unavailable via OAuth; image posted as a 5s public video.",
          },
        };
      }
      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: `YouTube image→video convert failed (${detail.slice(0, 160)}). Ensure ffmpeg is on the API host, then Retry.`,
      };
    } finally {
      try {
        if (existsSync(dest)) unlinkSync(dest);
      } catch {
        /* ignore */
      }
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  private async publishVideo(payload: PublishPayload): Promise<PublishResult> {
    if (!payload.media || payload.media.kind !== "VIDEO") {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube video publishing requires a video attachment.",
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
    if (status === 401 || status === 403 || /token|auth|login|unauthenticated/i.test(message)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        error:
          "YouTube auth rejected this action. Disconnect → Connect YouTube again (allow channel + upload), then Retry.",
        retryable: false,
      };
    }
    if (status === 429 || /rate/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
