import { encryptSecret, decryptSecret, maskSecret, hashToken } from "./crypto.util";

describe("crypto.util", () => {
  it("encrypts and decrypts secrets", () => {
    const plain = "super-secret-value";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("masks secrets", () => {
    expect(maskSecret("abc")).toBe("••••••••");
    expect(maskSecret(null)).toBeNull();
  });

  it("hashes tokens stably", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abcd"));
  });
});
