import { randomBytes } from "crypto";

/** Password format: SR + 8 chars including letter, digit, and special. */
export function generateTempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%&*";
  const pool = letters + digits + specials;
  const pick = (set: string) => set[randomBytes(1)[0]! % set.length]!;
  const chars = [pick(letters), pick(digits), pick(specials)];
  while (chars.length < 8) chars.push(pick(pool));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return `SR${chars.join("")}`;
}
