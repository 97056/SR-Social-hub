import {
  assertPublicHttpUrl,
  normalizeWebsiteUrl,
  parseWebsiteHtml,
  type WebsiteSnapshot,
} from "../growth/growth-website.util";

const UA =
  "Mozilla/5.0 (compatible; SRSocialHub-SeoBot/1.0; +https://srsocialhub.in) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Practical hard ceiling — unlimited crawl of arbitrary sites is unsafe/impossible. */
export const SEO_CRAWL_MAX_URLS = 5_000;
export const SEO_CRAWL_MAX_MS = 90_000;

export type CrawledPage = {
  url: string;
  status: number | null;
  title: string | null;
  canonical: string | null;
  source: "seed" | "sitemap" | "crawl";
};

export type SitemapBuildResult = {
  baseUrl: string;
  host: string;
  urls: CrawledPage[];
  xml: string;
  complete: boolean;
  stoppedReason: string | null;
  stats: {
    fromSitemap: number;
    fromCrawl: number;
    fetched: number;
    failed: number;
    durationMs: number;
  };
  limitations: string[];
};

export async function fetchText(url: string, timeoutMs = 15_000): Promise<{ status: number; finalUrl: string; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const text = await res.text();
    return { status: res.status, finalUrl: res.url || url, text };
  } finally {
    clearTimeout(timer);
  }
}

export function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

export function normalizeCrawlUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    // Drop common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((k) =>
      u.searchParams.delete(k),
    );
    // Skip binary / non-page assets
    if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|ico|css|js|map|woff2?|ttf|zip|mp4|mp3|xml)$/i.test(u.pathname)) {
      return null;
    }
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

export function extractLinks(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = normalizeCrawlUrl(m[1], pageUrl);
    if (n) out.push(n);
  }
  return out;
}

export function extractCanonical(html: string, pageUrl: string): string | null {
  const m =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (!m?.[1]) return null;
  return normalizeCrawlUrl(m[1], pageUrl);
}

export function parseSitemapXml(xml: string, base: string): { locs: string[]; nestedSitemaps: string[] } {
  const locs: string[] = [];
  const nestedSitemaps: string[] = [];
  const locRe = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  while ((m = locRe.exec(xml))) {
    const raw = m[1].trim();
    const n = normalizeCrawlUrl(raw, base);
    if (!n) continue;
    if (isIndex || /sitemap.*\.xml($|\?)/i.test(n)) nestedSitemaps.push(n);
    else locs.push(n);
  }
  // Non-index sitemaps may still list only page URLs
  if (!isIndex) {
    return { locs, nestedSitemaps: nestedSitemaps.filter((u) => /sitemap/i.test(u)) };
  }
  return { locs: [], nestedSitemaps };
}

async function collectFromExistingSitemaps(start: URL, maxUrls: number): Promise<string[]> {
  const seeds = [
    new URL("/sitemap.xml", start.origin).toString(),
    new URL("/sitemap_index.xml", start.origin).toString(),
    new URL("/sitemap-index.xml", start.origin).toString(),
  ];
  const queue = [...seeds];
  const seenSitemaps = new Set<string>();
  const urls: string[] = [];

  while (queue.length && urls.length < maxUrls) {
    const sm = queue.shift()!;
    if (seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    try {
      const { status, text } = await fetchText(sm, 12_000);
      if (status >= 400 || !/<urlset|<sitemapindex/i.test(text)) continue;
      const parsed = parseSitemapXml(text, start.origin);
      for (const n of parsed.nestedSitemaps) {
        if (sameHost(n, start.origin) && !seenSitemaps.has(n)) queue.push(n);
      }
      for (const loc of parsed.locs) {
        if (!sameHost(loc, start.origin)) continue;
        if (!urls.includes(loc)) urls.push(loc);
        if (urls.length >= maxUrls) break;
      }
    } catch {
      /* ignore missing sitemaps */
    }
  }
  return urls;
}

export async function buildFullSitemap(rawWebsiteUrl: string): Promise<SitemapBuildResult> {
  const started = Date.now();
  const start = assertPublicHttpUrl(rawWebsiteUrl);
  const limitations = [
    "No crawler can guarantee every possible URL forever: JavaScript-only routes, login walls, infinite filters/calendars, and blocked bots are not fully discoverable.",
    `This run imports existing sitemaps (if any) and crawls same-host links up to ${SEO_CRAWL_MAX_URLS} URLs or ${SEO_CRAWL_MAX_MS / 1000}s.`,
    "Query-parameter explosion and non-HTML assets are filtered for a usable sitemap.",
  ];

  const discovered = new Map<string, CrawledPage>();
  const add = (url: string, source: CrawledPage["source"], partial?: Partial<CrawledPage>) => {
    if (discovered.size >= SEO_CRAWL_MAX_URLS && !discovered.has(url)) return false;
    const prev = discovered.get(url);
    discovered.set(url, {
      url,
      status: partial?.status ?? prev?.status ?? null,
      title: partial?.title ?? prev?.title ?? null,
      canonical: partial?.canonical ?? prev?.canonical ?? null,
      source: prev?.source === "sitemap" ? "sitemap" : source,
    });
    return true;
  };

  const home = normalizeCrawlUrl(start.toString(), start.origin) || start.toString();
  add(home, "seed");

  const fromSitemap = await collectFromExistingSitemaps(start, SEO_CRAWL_MAX_URLS);
  for (const u of fromSitemap) add(u, "sitemap");

  const queue: string[] = [home, ...fromSitemap.filter((u) => u !== home)];
  const fetched = new Set<string>();
  let failed = 0;
  let stoppedReason: string | null = null;

  while (queue.length) {
    if (Date.now() - started > SEO_CRAWL_MAX_MS) {
      stoppedReason = `Stopped after time budget (${SEO_CRAWL_MAX_MS / 1000}s)`;
      break;
    }
    if (discovered.size >= SEO_CRAWL_MAX_URLS && queue.every((u) => fetched.has(u))) {
      stoppedReason = `Reached URL ceiling (${SEO_CRAWL_MAX_URLS})`;
      break;
    }

    const batch = queue.splice(0, 5).filter((u) => !fetched.has(u));
    if (!batch.length) continue;

    await Promise.all(
      batch.map(async (pageUrl) => {
        if (fetched.has(pageUrl)) return;
        fetched.add(pageUrl);
        try {
          const { status, finalUrl, text } = await fetchText(pageUrl, 12_000);
          const normalizedFinal = normalizeCrawlUrl(finalUrl, start.origin) || pageUrl;
          if (!sameHost(normalizedFinal, start.origin)) return;
          const title = (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ").trim() || null;
          const canonical = extractCanonical(text, normalizedFinal);
          add(pageUrl, discovered.get(pageUrl)?.source || "crawl", { status, title, canonical });
          if (normalizedFinal !== pageUrl) add(normalizedFinal, "crawl", { status, title, canonical });

          if (status >= 200 && status < 400 && /<html[\s>]|<body[\s>]|<a\s/i.test(text)) {
            for (const link of extractLinks(text, normalizedFinal)) {
              if (!sameHost(link, start.origin)) continue;
              if (!discovered.has(link)) {
                if (!add(link, "crawl")) continue;
                queue.push(link);
              } else if (!fetched.has(link) && !queue.includes(link)) {
                queue.push(link);
              }
            }
          }
        } catch {
          failed += 1;
          add(pageUrl, discovered.get(pageUrl)?.source || "crawl", { status: null });
        }
      }),
    );
  }

  if (!stoppedReason && queue.length === 0) {
    stoppedReason = null; // exhausted naturally
  } else if (!stoppedReason && discovered.size >= SEO_CRAWL_MAX_URLS) {
    stoppedReason = `Reached URL ceiling (${SEO_CRAWL_MAX_URLS})`;
  }

  const urls = [...discovered.values()].sort((a, b) => a.url.localeCompare(b.url));
  const xml = buildSitemapXml(urls.map((u) => u.canonical || u.url));
  const complete = !stoppedReason && failed === 0;

  return {
    baseUrl: start.origin,
    host: start.hostname,
    urls,
    xml,
    complete,
    stoppedReason,
    stats: {
      fromSitemap: urls.filter((u) => u.source === "sitemap").length,
      fromCrawl: urls.filter((u) => u.source === "crawl" || u.source === "seed").length,
      fetched: fetched.size,
      failed,
      durationMs: Date.now() - started,
    },
    limitations,
  };
}

export function buildSitemapXml(urls: string[]): string {
  const unique = [...new Set(urls)];
  const body = unique
    .map((u) => {
      const safe = u.replace(/&/g, "&amp;");
      return `  <url>\n    <loc>${safe}</loc>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRobotsTxt(origin: string, opts?: { extraDisallows?: string[]; sitemapUrl?: string }): string {
  const sitemap = opts?.sitemapUrl || new URL("/sitemap.xml", origin).toString();
  const disallows = opts?.extraDisallows?.length
    ? opts.extraDisallows
    : ["/admin", "/api", "/login", "/cart", "/checkout", "/account", "/wp-admin", "/cgi-bin"];
  const lines = [
    "# Generated by SR Social Hub SEO Workspace",
    "# Review before uploading to your website root.",
    "User-agent: *",
    "Allow: /",
    ...disallows.map((d) => `Disallow: ${d}`),
    "",
    `Sitemap: ${sitemap}`,
    "",
  ];
  return lines.join("\n");
}

export async function deepAnalyzeWebsite(rawWebsiteUrl: string): Promise<{
  snapshot: WebsiteSnapshot;
  seo: Record<string, unknown>;
}> {
  const start = assertPublicHttpUrl(rawWebsiteUrl);
  const { status, finalUrl, text } = await fetchText(start.toString(), 18_000);
  const snapshot = parseWebsiteHtml(start.toString(), finalUrl, status, text);
  const canonical = extractCanonical(text, finalUrl);
  const robotsMeta = text.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i)?.[1] || null;
  const jsonLd = [...text.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].length;
  const ogTags = [...text.matchAll(/property=["']og:[^"']+["']/gi)].length;
  const twitterTags = [...text.matchAll(/name=["']twitter:[^"']+["']/gi)].length;
  const h1s = [...text.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  ).filter(Boolean);
  const images = [...text.matchAll(/<img\b[^>]*>/gi)];
  const imagesMissingAlt = images.filter((m) => !/\balt\s*=\s*["'][^"']+["']/i.test(m[0])).length;
  const links = extractLinks(text, finalUrl);
  const internal = links.filter((l) => sameHost(l, finalUrl));
  const external = links.filter((l) => !sameHost(l, finalUrl));
  const wordCount = snapshot.rawExcerpt.split(/\s+/).filter(Boolean).length;

  const issues: Array<{ priority: string; issue: string; fix: string }> = [];
  if (!snapshot.title) issues.push({ priority: "High", issue: "Missing title tag", fix: "Add a unique <title> with brand + primary offer." });
  if (snapshot.title && snapshot.title.length < 15) issues.push({ priority: "Medium", issue: "Title too short", fix: "Aim for ~30–60 characters." });
  if (snapshot.title && snapshot.title.length > 65) issues.push({ priority: "Low", issue: "Title may truncate in SERPs", fix: "Keep title under ~60 characters." });
  if (!snapshot.description) issues.push({ priority: "High", issue: "Missing meta description", fix: "Add a 140–160 character benefit-led description." });
  if (!snapshot.hasViewport) issues.push({ priority: "High", issue: "No viewport meta", fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">." });
  if (!h1s.length) issues.push({ priority: "Medium", issue: "No H1 found in HTML", fix: "Ensure one clear H1 for the primary topic." });
  if (h1s.length > 1) issues.push({ priority: "Low", issue: "Multiple H1 tags", fix: "Prefer a single primary H1." });
  if (!canonical) issues.push({ priority: "Medium", issue: "No canonical link", fix: "Add <link rel=\"canonical\" href=\"...\">." });
  if (imagesMissingAlt > 0) issues.push({ priority: "Medium", issue: `${imagesMissingAlt} image(s) missing alt`, fix: "Add descriptive alt text for images." });
  if (!jsonLd) issues.push({ priority: "Low", issue: "No JSON-LD structured data detected", fix: "Add Organization/WebSite/FAQ schema where relevant." });
  if (status >= 400) issues.push({ priority: "Critical", issue: `HTTP ${status}`, fix: "Fix hosting/DNS so the homepage returns 200." });

  return {
    snapshot,
    seo: {
      finalUrl,
      status,
      title: snapshot.title,
      metaDescription: snapshot.description,
      hasViewport: snapshot.hasViewport,
      canonical,
      robotsMeta,
      h1s,
      headingCount: snapshot.headings.length,
      headings: snapshot.headings,
      openGraphTags: ogTags,
      twitterTags,
      jsonLdBlocks: jsonLd,
      internalLinks: internal.length,
      externalLinks: external.length,
      imageCount: images.length,
      imagesMissingAlt,
      wordCountSample: wordCount,
      https: finalUrl.startsWith("https"),
      issues,
      measuredAt: new Date().toISOString(),
    },
  };
}

export { normalizeWebsiteUrl, assertPublicHttpUrl };
