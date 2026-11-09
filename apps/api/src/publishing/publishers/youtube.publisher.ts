import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { MEDIA_ROOT } from "../../media/media.constants";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

const YT_WEB_CLIENT = {
  clientName: "WEB",
  clientVersion: "2.20250222.10.00",
};

/**
 * YouTube publisher:
 * - VIDEO → Data API resumable video upload
 * - IMAGE (+ text) → Community / Posts tab via Studio backstage create_post
 *
 * Community posts are not in the public Data API; we use the same Studio
 * Innertube flow YouTube Studio uses, authenticated with the channel OAuth token.
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
      return this.publishCommunityImagePost(payload);
    }

    if (payload.media?.kind === "VIDEO") {
      return this.publishVideo(payload);
    }

    // Text-only community post
    return this.publishCommunityTextPost(payload);
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

  private async publishCommunityImagePost(payload: PublishPayload): Promise<PublishResult> {
    if (!payload.media?.storageKey) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube Community image post requires an image attachment.",
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

    const channelId = payload.externalAccountId;
    if (!channelId || !/^UC[\w-]{20,}$/i.test(channelId)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        retryable: false,
        error: "YouTube channel id missing. Disconnect YouTube, reconnect, then Publish.",
      };
    }

    try {
      const bytes = readFileSync(abs);
      const text = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n").slice(0, 5000);
      const blobId = await this.uploadCommunityImage({
        accessToken: payload.accessToken,
        channelId,
        bytes,
        mimeType: payload.media.mimeType || "image/jpeg",
        fileName: payload.media.assetId || "community.jpg",
      });
      if (!blobId.ok) return blobId;

      return this.createCommunityPost({
        accessToken: payload.accessToken,
        channelId,
        commentText: text || " ",
        encryptedBlobId: blobId.encryptedBlobId,
      });
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "YouTube Community post error",
      };
    }
  }

  private async publishCommunityTextPost(payload: PublishPayload): Promise<PublishResult> {
    const channelId = payload.externalAccountId;
    if (!channelId || !/^UC[\w-]{20,}$/i.test(channelId)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        retryable: false,
        error: "YouTube channel id missing. Disconnect YouTube, reconnect, then Publish.",
      };
    }
    const text = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n").slice(0, 5000);
    if (!text.trim()) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube Community post needs caption text or an image.",
      };
    }
    try {
      return this.createCommunityPost({
        accessToken: payload.accessToken,
        channelId,
        commentText: text,
      });
    } catch (error) {
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: error instanceof Error ? error.message : "YouTube Community post error",
      };
    }
  }

  private async uploadCommunityImage(input: {
    accessToken: string;
    channelId: string;
    bytes: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<
    | { ok: true; encryptedBlobId: string }
    | { ok: false; status: "FAILED" | "REQUIRES_REAUTH" | "RETRY_PENDING"; error: string; retryable: boolean }
  > {
    const startRes = await fetch("https://www.youtube.com/channel_image_upload/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "X-YouTube-Channel-Id": input.channelId,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(input.bytes.length),
        "X-Goog-Upload-Header-Content-Type": input.mimeType,
        "X-Goog-Upload-File-Name": input.fileName,
        Origin: "https://www.youtube.com",
        Referer: `https://www.youtube.com/channel/${input.channelId}/posts`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
    });
    if (!startRes.ok) {
      const body = await startRes.text().catch(() => "");
      return this.asFailure(
        this.mapError(
          body.slice(0, 200) ||
            `YouTube Community image upload start failed (HTTP ${startRes.status}). Reconnect YouTube with full channel access, then Retry.`,
          startRes.status,
        ),
      );
    }

    const uploadUrl =
      startRes.headers.get("x-goog-upload-url") ||
      startRes.headers.get("X-Goog-Upload-URL");
    const uploadId =
      startRes.headers.get("x-guploader-uploadid") ||
      startRes.headers.get("X-GUploader-UploadID");
    if (!uploadUrl && !uploadId) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "YouTube did not return a Community image upload URL.",
      };
    }

    const putUrl =
      uploadUrl ||
      `https://www.youtube.com/channel_image_upload/posts?upload_id=${encodeURIComponent(
        uploadId!,
      )}&upload_protocol=resumable`;

    const putRes = await fetch(putUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "X-YouTube-Channel-Id": input.channelId,
        "X-Goog-Upload-Command": "upload, finalize",
        "X-Goog-Upload-Offset": "0",
        "Content-Type": input.mimeType,
        Origin: "https://www.youtube.com",
        Referer: `https://www.youtube.com/channel/${input.channelId}/posts`,
      },
      body: new Uint8Array(input.bytes),
    });
    const putText = await putRes.text();
    if (!putRes.ok) {
      return this.asFailure(
        this.mapError(
          putText.slice(0, 200) || `YouTube Community image upload failed (HTTP ${putRes.status})`,
          putRes.status,
        ),
      );
    }

    let encryptedBlobId: string | undefined;
    try {
      const json = JSON.parse(putText) as {
        encryptedBlobId?: string;
        scottyResourceId?: string;
        id?: string;
      };
      encryptedBlobId = json.encryptedBlobId || json.scottyResourceId || json.id;
    } catch {
      // Sometimes the blob id is returned as plain text.
      const trimmed = putText.trim();
      if (trimmed && trimmed.length < 500 && !trimmed.startsWith("<")) {
        encryptedBlobId = trimmed;
      }
    }

    if (!encryptedBlobId) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error:
          "YouTube Community image uploaded but no blob id returned. Reconnect YouTube (grant Studio/posts access) and Retry.",
      };
    }

    return { ok: true, encryptedBlobId };
  }

  private async createCommunityPost(input: {
    accessToken: string;
    channelId: string;
    commentText: string;
    encryptedBlobId?: string;
  }): Promise<PublishResult> {
    const body: Record<string, unknown> = {
      context: {
        client: YT_WEB_CLIENT,
        user: { lockedSafetyMode: false },
      },
      createBackstagePostParams: this.encodeCreateBackstagePostParams(input.channelId),
      commentText: input.commentText,
    };
    if (input.encryptedBlobId) {
      body.imagesAttachment = {
        imagesData: [{ encryptedBlobId: input.encryptedBlobId }],
      };
    }

    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/backstage/create_post?prettyPrint=false",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          Origin: "https://www.youtube.com",
          Referer: `https://www.youtube.com/channel/${input.channelId}/posts`,
          "X-Youtube-Client-Name": "1",
          "X-Youtube-Client-Version": YT_WEB_CLIENT.clientVersion,
        },
        body: JSON.stringify(body),
      },
    );
    const rawText = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    if (!res.ok) {
      const errObj = json.error as { message?: string; status?: string } | undefined;
      const msg =
        errObj?.message ||
        rawText.slice(0, 220) ||
        `YouTube Community post failed (HTTP ${res.status})`;
      if (/PERMISSION_DENIED|forbidden|not (able|allowed)|Posts? (tab )?not available/i.test(msg)) {
        return {
          ok: false,
          status: "FAILED",
          retryable: false,
          error:
            "YouTube Community / Posts not available for this channel (or missing Studio permission). Enable Posts on the channel, reconnect YouTube, then Retry. Video uploads still work with a video file.",
        };
      }
      return this.mapError(msg, res.status);
    }

    const postId =
      this.findCommunityPostId(json) ||
      `yt-community-${createHash("sha256").update(`${input.channelId}:${input.commentText}:${Date.now()}`).digest("hex").slice(0, 12)}`;

    return {
      ok: true,
      externalPostId: postId,
      mode: "live",
      raw: { community: true, ...(json as Record<string, unknown>) },
    };
  }

  /** Minimal protobuf for createBackstagePostParams: field1=channelId, field2=1 */
  private encodeCreateBackstagePostParams(channelId: string): string {
    const idBytes = Buffer.from(channelId, "utf8");
    const out: number[] = [];
    // field 1 (string): tag 0x0a
    out.push(0x0a);
    out.push(...this.encodeVarint(idBytes.length));
    for (const b of idBytes) out.push(b);
    // field 2 (varint)=1: tag 0x10, value 1
    out.push(0x10, 0x01);
    return Buffer.from(out).toString("base64");
  }

  private encodeVarint(value: number): number[] {
    const bytes: number[] = [];
    let v = value >>> 0;
    while (v >= 0x80) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v);
    return bytes;
  }

  private findCommunityPostId(json: Record<string, unknown>): string | null {
    const asText = JSON.stringify(json);
    const match =
      asText.match(/"postId"\s*:\s*"([^"]+)"/i) ||
      asText.match(/"backstagePostId"\s*:\s*"([^"]+)"/i) ||
      asText.match(/\/post\/([A-Za-z0-9_-]+)/);
    return match?.[1] || null;
  }

  private mapError(message: string, status?: number): PublishResult {
    if (status === 401 || status === 403 || /token|auth|login|unauthenticated/i.test(message)) {
      return {
        ok: false,
        status: "REQUIRES_REAUTH",
        error:
          "YouTube auth rejected this action. Disconnect → Connect YouTube again (allow channel access), then Retry.",
        retryable: false,
      };
    }
    if (status === 429 || /rate/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }

  private asFailure(result: PublishResult): {
    ok: false;
    status: "FAILED" | "REQUIRES_REAUTH" | "RETRY_PENDING";
    error: string;
    retryable: boolean;
  } {
    if (!result.ok) {
      return {
        ok: false,
        status: result.status === "ASSISTED_REQUIRED" ? "FAILED" : result.status,
        error: result.error,
        retryable: Boolean(result.retryable),
      };
    }
    return {
      ok: false,
      status: "FAILED",
      error: "YouTube Community image upload failed",
      retryable: false,
    };
  }
}
