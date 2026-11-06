import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { buildSignedMediaUrl } from "../../media/media-public-url";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * Threads API publisher (graph.threads.net).
 * Create a media container, then publish it.
 */
export class ThreadsPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.THREADS;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (payload.connectionMode === "mock" || payload.accessToken.startsWith("mock_")) {
      const id = `mock_th_post_${createHash("sha256")
        .update(`${payload.externalAccountId}:${payload.caption}:${randomBytes(4).toString("hex")}`)
        .digest("hex")
        .slice(0, 12)}`;
      return {
        ok: true,
        externalPostId: id,
        mode: "mock",
        raw: { mock: true, provider: "THREADS" },
      };
    }

    try {
      const version = process.env.THREADS_GRAPH_VERSION || "v1.0";
      const text = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n");
      const userId = await this.resolveUserId(payload, version);
      if (!userId) {
        return {
          ok: false,
          status: "REQUIRES_REAUTH",
          retryable: false,
          error:
            "Threads account ID is invalid. Disconnect Threads, connect again, then Publish.",
        };
      }

      const createBody = new URLSearchParams({
        access_token: payload.accessToken,
        text,
      });

      if (payload.media?.kind === "IMAGE" && payload.media.assetId) {
        createBody.set("media_type", "IMAGE");
        createBody.set("image_url", buildSignedMediaUrl(payload.media.assetId, 3600));
      } else {
        createBody.set("media_type", "TEXT");
      }

      const createRes = await fetch(
        `https://graph.threads.net/${version}/${userId}/threads`,
        { method: "POST", body: createBody },
      );
      const createJson = (await createRes.json()) as {
        id?: string;
        error?: { message: string; code?: number };
      };
      if (!createRes.ok || createJson.error || !createJson.id) {
        return this.mapError(
          createJson.error?.message ?? "Threads container create failed",
          createJson.error?.code,
        );
      }

      const publishBody = new URLSearchParams({
        creation_id: createJson.id,
        access_token: payload.accessToken,
      });
      const publishRes = await fetch(
        `https://graph.threads.net/${version}/${userId}/threads_publish`,
        { method: "POST", body: publishBody },
      );
      const publishJson = (await publishRes.json()) as {
        id?: string;
        error?: { message: string; code?: number };
      };
      if (!publishRes.ok || publishJson.error) {
        return this.mapError(
          publishJson.error?.message ?? "Threads publish failed",
          publishJson.error?.code,
        );
      }

      return {
        ok: true,
        externalPostId: publishJson.id || createJson.id,
        mode: "live",
        raw: { create: createJson, publish: publishJson, userId },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Threads publish error";
      return {
        ok: false,
        status: "RETRY_PENDING",
        retryable: true,
        error: message,
      };
    }
  }

  private async resolveUserId(payload: PublishPayload, version: string): Promise<string | null> {
    if (/^\d+$/.test(payload.externalAccountId)) return payload.externalAccountId;

    for (const base of [
      `https://graph.threads.net/${version}/me`,
      "https://graph.threads.net/v1.0/me",
      "https://graph.threads.net/me",
    ]) {
      const meUrl = new URL(base);
      meUrl.searchParams.set("fields", "id,username");
      meUrl.searchParams.set("access_token", payload.accessToken);
      const res = await fetch(meUrl);
      if (!res.ok) continue;
      const json = (await res.json()) as { id?: string; username?: string };
      if (json.id && /^\d+$/.test(json.id)) return json.id;
    }
    return null;
  }

  private mapError(message: string, code?: number): PublishResult {
    if (code === 190 || /session|oauth|token|login/i.test(message)) {
      return { ok: false, status: "REQUIRES_REAUTH", error: message, retryable: false };
    }
    if (code === 4 || code === 17 || /rate limit/i.test(message)) {
      return { ok: false, status: "RETRY_PENDING", error: message, retryable: true };
    }
    return { ok: false, status: "FAILED", error: message, retryable: false };
  }
}
