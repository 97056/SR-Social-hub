import { join } from "path";

export const MEDIA_ROOT = process.env.MEDIA_ROOT || join(process.cwd(), ".data", "media");

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const MAX_UPLOAD_BYTES = Number(process.env.MEDIA_MAX_BYTES ?? 50 * 1024 * 1024);
