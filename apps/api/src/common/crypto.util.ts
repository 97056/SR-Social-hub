import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyBytes() {
  const raw = process.env.ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  return "••••••••";
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
