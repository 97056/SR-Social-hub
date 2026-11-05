import { createHmac, timingSafeEqual } from "crypto";

function signingSecret() {
  return (
    process.env.MEDIA_SIGNING_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    "sr-media-dev-secret"
  );
}

export function buildSignedMediaUrl(assetId: string, ttlSeconds = 3600): string {
  const base = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", signingSecret())
    .update(`${assetId}.${exp}`)
    .digest("hex");
  return `${base}/api/v1/public/media/${assetId}?exp=${exp}&sig=${sig}`;
}

export function verifySignedMediaUrl(assetId: string, exp: string, sig: string): boolean {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  const expected = createHmac("sha256", signingSecret())
    .update(`${assetId}.${exp}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
