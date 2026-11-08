/** Safe public-website fetch helpers for Growth Center (SSRF-hardened). */

import { toDbSafeText } from "./growth-db-safe.util";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

const BROWSER_UA =
  "Mozilla/5.0 (compatible; SRSocialHub-GrowthBot/1.1; +https://srsocialhub.in) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Accepts full URLs or bare domains like path2career.in (https assumed). */
export function normalizeWebsiteUrl(raw: string): string {
  let value = raw.trim();
  if (!value) throw new Error("Invalid website URL");
  // Users often paste domains without a scheme.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }
  return value;
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(normalizeWebsiteUrl(raw));
  } catch {
    throw new Error("Invalid website URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are allowed");
  }
  const host = url.hostname.toLowerCase();
  if (!host || !host.includes(".")) {
    throw new Error("Invalid website URL");
  }
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host is not allowed for website analysis");
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.)/.test(host)) {
    throw new Error("Private network addresses are blocked");
  }
  return url;
}

export type WebsiteSnapshot = {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  description: string | null;
  headings: string[];
  hasViewport: boolean;
  ctaHints: string[];
  contactHints: string[];
  brokenNote: string | null;
  rawExcerpt: string;
  /** Lowercased HTML sample for competitor brand matching (not persisted). */
  htmlLower?: string;
  fetchedAt: string;
};

export async function fetchPublicWebsite(rawUrl: string): Promise<WebsiteSnapshot> {
  const url = assertPublicHttpUrl(rawUrl);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18_000);
    try {
      const res = await fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });
      const html = (await res.text()).slice(0, 220_000);
      return parseWebsiteHtml(url.toString(), res.url || url.toString(), res.status, html);
    } catch (e) {
      const cause =
        e instanceof Error && "cause" in e && e.cause instanceof Error
          ? e.cause.message
          : e instanceof Error
            ? e.message
            : "Website fetch failed";
      lastError = new Error(
        cause.includes("ENOTFOUND") || cause.includes("getaddrinfo")
          ? `Could not resolve host for ${url.hostname}. Check the spelling (e.g. path2career.in).`
          : cause.includes("abort") || cause.includes("AbortError")
            ? `Timed out fetching ${url.hostname}. Try again in a moment.`
            : `Could not reach ${url.hostname}: ${cause}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Website fetch failed");
}

export function parseWebsiteHtml(
  requestUrl: string,
  finalUrl: string,
  status: number,
  html: string,
): WebsiteSnapshot {
  const title =
    match1(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title");

  const description =
    metaContent(html, "description") ||
    metaContent(html, "og:description") ||
    metaContent(html, "twitter:description");

  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => stripTags(m[1] || "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const lower = html.toLowerCase();
  const hasViewport =
    /name\s*=\s*["']viewport["']/i.test(html) || /name\s*=\s*viewport\b/i.test(html);

  const ctaHints = ["book", "buy", "contact", "get started", "sign up", "demo", "whatsapp", "register", "enroll"]
    .filter((k) => lower.includes(k))
    .slice(0, 6);
  const contactHints = ["mailto:", "tel:", "contact", "address"]
    .filter((k) => lower.includes(k))
    .slice(0, 4);

  return {
    url: requestUrl,
    finalUrl,
    status,
    title: title ? toDbSafeText(stripTags(title).trim()) : null,
    description: description ? toDbSafeText(stripTags(description).trim()) : null,
    headings: headings.map((h) => toDbSafeText(h)),
    hasViewport,
    ctaHints,
    contactHints,
    brokenNote: status >= 200 && status < 400 ? null : `HTTP ${status} while fetching the site`,
    rawExcerpt: toDbSafeText(stripTags(html).replace(/\s+/g, " ").trim().slice(0, 1200)),
    htmlLower: lower.slice(0, 80_000),
    fetchedAt: new Date().toISOString(),
  };
}

function metaContent(html: string, nameOrProperty: string): string | null {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`,
      "i",
    ),
    // unquoted content fallback
    new RegExp(
      `<meta[^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*([^\\s>]+)`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const hit = match1(html, re);
    if (hit) return hit;
  }
  return null;
}

function match1(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1]?.trim() ? m[1] : null;
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
