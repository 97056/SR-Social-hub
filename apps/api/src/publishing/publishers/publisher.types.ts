import { SocialPlatformCode } from "@prisma/client";

export type PublishPayload = {
  platformCode: SocialPlatformCode;
  accessToken: string;
  externalAccountId: string;
  connectionMode: string;
  caption: string;
  title?: string | null;
  description?: string | null;
  hashtags?: string | null;
  linkUrl?: string | null;
  media?: {
    mimeType: string;
    storageKey: string;
    kind: string;
    /** Needed for Instagram signed public image_url */
    assetId?: string;
  } | null;
};

export type PublishResult =
  | {
      ok: true;
      externalPostId: string;
      mode: "live" | "mock" | "assisted";
      raw?: Record<string, unknown>;
    }
  | {
      ok: false;
      status:
        | "FAILED"
        | "REQUIRES_REAUTH"
        | "ASSISTED_REQUIRED"
        | "RETRY_PENDING";
      error: string;
      retryable?: boolean;
    };

export interface PlatformPublisher {
  readonly code: SocialPlatformCode;
  publish(payload: PublishPayload): Promise<PublishResult>;
}
