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

/** Accepts full URLs or bare domains like path2carrer.in (https assumed). */
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "SRSocialHub-GrowthBot/1.0 (+https://srsocialhub.in)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = (await res.text()).slice(0, 180_000);
    const title = match1(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description =
      match1(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      match1(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const headings = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gis)]
      .map((m) => stripTags(m[1] || "").trim())
      .filter(Boolean)
      .slice(0, 12);
    const lower = html.toLowerCase();
    const ctaHints = ["book", "buy", "contact", "get started", "sign up", "demo", "whatsapp"]
      .filter((k) => lower.includes(k))
      .slice(0, 6);
    const contactHints = ["mailto:", "tel:", "contact", "address"]
      .filter((k) => lower.includes(k))
      .slice(0, 4);
    return {
      url: url.toString(),
      finalUrl: res.url || url.toString(),
      status: res.status,
      title: title ? toDbSafeText(stripTags(title).trim()) : null,
      description: description ? toDbSafeText(stripTags(description).trim()) : null,
      headings: headings.map((h) => toDbSafeText(h)),
      hasViewport: /name=["']viewport["']/i.test(html),
      ctaHints,
      contactHints,
      brokenNote: res.ok ? null : `HTTP ${res.status} while fetching the site`,
      rawExcerpt: toDbSafeText(stripTags(html).replace(/\s+/g, " ").trim().slice(0, 1200)),
      htmlLower: lower.slice(0, 80_000),
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function match1(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
