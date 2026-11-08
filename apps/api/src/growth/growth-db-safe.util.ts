/**
 * Embedded Postgres on Windows often initialises with WIN1252 server encoding.
 * Prisma sends UTF-8; unsupported Unicode (e.g. ₹ from scraped pages) causes 22P05.
 * Strip / replace to Latin-1-safe text before writes.
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u20B9/g, "INR "], // ₹
  [/\u00A3/g, "GBP "],
  [/\u00A5/g, "JPY "],
  [/\u20AC/g, "EUR "],
  [/\u2265/g, ">="], // ≥
  [/\u2264/g, "<="], // ≤
  [/\u2013|\u2014|\u2212/g, "-"], // en/em/minus
  [/\u2018|\u2019|\u2032/g, "'"],
  [/\u201C|\u201D|\u2033/g, '"'],
  [/\u2026/g, "..."],
  [/\u00A0|\u202F/g, " "],
  [/\u2022|\u00B7/g, "-"],
];

export function toDbSafeText(input: string): string {
  let out = input;
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  // Keep tab/LF/CR + printable ASCII + Latin-1 supplement (WIN1252-compatible subset).
  return out.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

export function toDbSafeJson<T>(value: T): T {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return toDbSafeText(value) as T;
  if (Array.isArray(value)) return value.map((v) => toDbSafeJson(v)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toDbSafeJson(v);
    }
    return out as T;
  }
  return value;
}
