import { SocialPlatformCode } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { MEDIA_ROOT } from "../../media/media.constants";
import type { PlatformPublisher, PublishPayload, PublishResult } from "./publisher.types";

/**
 * LinkedIn member posts via REST Posts API (OpenID / w_member_social).
 * Images must be uploaded through /rest/images — URL/article fallback does not show the photo.
 */
export class LinkedInPublisher implements PlatformPublisher {
  readonly code = SocialPlatformCode.LINKEDIN;

  private version() {
    return process.env.LINKEDIN_API_VERSION || "202610";
  }

  private headers(accessToken: string, json = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": this.version(),
      "X-Restli-Protocol-Version": "2.0.0",
    };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

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

      if (payload.media?.kind === "IMAGE" && payload.media.storageKey) {
        const uploaded = await this.uploadImage(authorUrn, payload.accessToken, payload.media);
        if (!uploaded.ok) {
          return {
            ok: false,
            status: uploaded.status,
            retryable: uploaded.retryable,
            error: uploaded.error,
          };
        }
        body.content = {
          media: {
            id: uploaded.imageUrn,
            altText: (payload.title || text).slice(0, 120),
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
        headers: this.headers(payload.accessToken, true),
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

  private async uploadImage(
    ownerUrn: string,
    accessToken: string,
    media: NonNullable<PublishPayload["media"]>,
  ): Promise<
    | { ok: true; imageUrn: string }
    | {
        ok: false;
        status: "FAILED" | "REQUIRES_REAUTH" | "RETRY_PENDING" | "ASSISTED_REQUIRED";
        error: string;
        retryable: boolean;
      }
  > {
    const abs = join(MEDIA_ROOT, media.storageKey);
    if (!existsSync(abs)) {
      return {
        ok: false,
        status: "FAILED",
        retryable: false,
        error: "Image file missing on server. Re-upload the image, then Publish again.",
      };
    }
    const bytes = readFileSync(abs);

    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: this.headers(accessToken, true),
      body: JSON.stringify({
        initializeUploadRequest: { owner: ownerUrn },
      }),
    });
    const initText = await initRes.text();
    let initJson: {
      value?: { uploadUrl?: string; image?: string };
      message?: string;
    } = {};
    try {
      initJson = JSON.parse(initText) as typeof initJson;
    } catch {
      /* empty */
    }
    if (!initRes.ok || !initJson.value?.uploadUrl || !initJson.value?.image) {
      const msg =
        initJson.message ||
        initText.slice(0, 180) ||
        `LinkedIn image init failed (HTTP ${initRes.status})`;
      const mapped = this.mapError(msg);
      if (mapped.ok) {
        return {
          ok: false,
          status: "FAILED",
          retryable: false,
          error: msg,
        };
      }
      return {
        ok: false,
        status: mapped.status,
        retryable: Boolean(mapped.retryable),
        error: mapped.error,
      };
    }

    const putRes = await fetch(initJson.value.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": media.mimeType || "application/octet-stream",
      },
      body: bytes,
    });
    if (!putRes.ok) {
      const putBody = await putRes.text().catch(() => "");
      return {
        ok: false,
        status: putRes.status === 401 || putRes.status === 403 ? "REQUIRES_REAUTH" : "FAILED",
        retryable: putRes.status >= 500,
        error:
          putBody.slice(0, 180) ||
          `LinkedIn image upload failed (HTTP ${putRes.status}). Reconnect LinkedIn and try again.`,
      };
    }

    return { ok: true, imageUrn: initJson.value.image };
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
