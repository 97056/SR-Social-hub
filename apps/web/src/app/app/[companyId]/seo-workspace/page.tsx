"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type ClientSite = {
  id: string;
  name: string;
  website: string | null;
  industry?: string | null;
  eligible: boolean;
};

type AnalysisPayload = {
  client: { id: string; name: string; website: string };
  website: string;
  analysis: {
    title: string | null;
    metaDescription: string | null;
    hasViewport: boolean;
    canonical: string | null;
    robotsMeta: string | null;
    h1s: string[];
    headings: string[];
    openGraphTags: number;
    twitterTags: number;
    jsonLdBlocks: number;
    internalLinks: number;
    externalLinks: number;
    imageCount: number;
    imagesMissingAlt: number;
    https: boolean;
    status: number;
    issues: Array<{ priority: string; issue: string; fix: string }>;
  };
};

type SitemapPayload = {
  client: { id: string; name: string };
  baseUrl: string;
  xml: string;
  urls: Array<{ url: string; status: number | null; title: string | null; source: string }>;
  complete: boolean;
  stoppedReason: string | null;
  stats: { fromSitemap: number; fromCrawl: number; fetched: number; failed: number; durationMs: number };
  limitations: string[];
  honesty: { unlimitedClaim: boolean; maxUrls: number; explanation: string };
};

type RobotsPayload = {
  client: { id: string; name: string };
  origin: string;
  robotsTxt: string;
  sitemapHint: string;
  note: string;
};

function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SeoWorkspacePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<ClientSite[]>([]);
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState<"analyze" | "sitemap" | "robots" | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [sitemap, setSitemap] = useState<SitemapPayload | null>(null);
  const [robots, setRobots] = useState<RobotsPayload | null>(null);

  const selected = useMemo(() => clients.find((c) => c.id === clientId) || null, [clients, clientId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: ClientSite[] }>(`/companies/${companyId}/seo-workspace/clients`)
      .then((p) => {
        setClients(p.clients ?? []);
        setClientId(p.clients?.[0]?.id ?? "");
      })
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [companyId, router]);

  async function runAnalyze() {
    if (!clientId) return;
    setBusy("analyze");
    try {
      const res = await apiFetch<AnalysisPayload>(`/companies/${companyId}/seo-workspace/analyze`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
      setAnalysis(res);
      toast.success("Deep SEO analysis ready");
    } catch (err) {
      toast.error("Analysis failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function runSitemap() {
    if (!clientId) return;
    setBusy("sitemap");
    try {
      const res = await apiFetch<SitemapPayload>(`/companies/${companyId}/seo-workspace/sitemap`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
      setSitemap(res);
      toast.success("Sitemap generated", `${res.urls.length} URL(s) discovered`);
    } catch (err) {
      toast.error("Sitemap failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function runRobots() {
    if (!clientId) return;
    setBusy("robots");
    try {
      const res = await apiFetch<RobotsPayload>(`/companies/${companyId}/seo-workspace/robots`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
      setRobots(res);
      toast.success("robots.txt generated");
    } catch (err) {
      toast.error("robots.txt failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="SEO Workspace"
      subtitle="Deep analysis · sitemap · robots.txt for client websites only"
      nav={companyNav(companyId)}
    >
      <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
        <p className="font-medium">Honest coverage note</p>
        <p className="mt-1 text-amber-100/90">
          No tool can promise a literally unlimited sitemap of every possible URL (JavaScript-only routes, login walls,
          infinite filters). This workspace imports existing sitemaps and crawls discoverable same-host pages up to a
          safety ceiling — the correct production approach. Analysis uses live HTML from the client website URL only.
        </p>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="block text-xs text-content-muted">
          Client website
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2.5 text-sm text-white"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAnalysis(null);
              setSitemap(null);
              setRobots(null);
            }}
          >
            <option value="">Select client with website</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.website}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!clientId || Boolean(busy)}
            onClick={runAnalyze}
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "analyze" ? "Analyzing…" : "Deep analysis"}
          </button>
          <button
            disabled={!clientId || Boolean(busy)}
            onClick={runSitemap}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {busy === "sitemap" ? "Crawling…" : "Generate sitemap"}
          </button>
          <button
            disabled={!clientId || Boolean(busy)}
            onClick={runRobots}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {busy === "robots" ? "Generating…" : "Generate robots.txt"}
          </button>
        </div>
      </div>

      {!clients.length ? (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-content-muted">
          No eligible clients yet. Add a website URL on the Clients page, then return here.
        </p>
      ) : null}

      {selected ? (
        <p className="mb-4 text-sm text-content-muted">
          Selected: <span className="text-white">{selected.name}</span> ·{" "}
          <a className="text-brand-primary hover:underline" href={selected.website || "#"} target="_blank" rel="noreferrer">
            {selected.website}
          </a>
        </p>
      ) : null}

      {analysis ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <GrowthCard title="On-page SEO">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-content-muted">HTTP: </span>
                {analysis.analysis.status} · {analysis.analysis.https ? "HTTPS" : "Not HTTPS"}
              </p>
              <p>
                <span className="text-content-muted">Title: </span>
                {analysis.analysis.title || "Missing"}
              </p>
              <p>
                <span className="text-content-muted">Meta description: </span>
                {analysis.analysis.metaDescription || "Missing"}
              </p>
              <p>
                <span className="text-content-muted">Viewport: </span>
                {analysis.analysis.hasViewport ? "Detected" : "Missing"}
              </p>
              <p>
                <span className="text-content-muted">Canonical: </span>
                {analysis.analysis.canonical || "Missing"}
              </p>
              <p>
                <span className="text-content-muted">H1: </span>
                {analysis.analysis.h1s?.join(" · ") || "None"}
              </p>
              <p>
                <span className="text-content-muted">OG / Twitter / JSON-LD: </span>
                {analysis.analysis.openGraphTags} / {analysis.analysis.twitterTags} / {analysis.analysis.jsonLdBlocks}
              </p>
              <p>
                <span className="text-content-muted">Links in/out: </span>
                {analysis.analysis.internalLinks} / {analysis.analysis.externalLinks}
              </p>
              <p>
                <span className="text-content-muted">Images missing alt: </span>
                {analysis.analysis.imagesMissingAlt}/{analysis.analysis.imageCount}
              </p>
            </div>
          </GrowthCard>
          <GrowthCard title="Issues & fixes">
            <div className="space-y-3">
              {(analysis.analysis.issues || []).length ? (
                analysis.analysis.issues.map((issue, idx) => (
                  <div key={idx} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <StatusPill value={issue.priority} />
                      <span className="font-medium text-white">{issue.issue}</span>
                    </div>
                    <p className="text-content-muted">{issue.fix}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-content-muted">No critical on-page issues detected in the HTML sample.</p>
              )}
            </div>
          </GrowthCard>
        </div>
      ) : null}

      {sitemap ? (
        <GrowthCard
          title={`Sitemap (${sitemap.urls.length} URLs)`}
          action={
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs"
              onClick={() => downloadText("sitemap.xml", sitemap.xml, "application/xml")}
            >
              Download sitemap.xml
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-content-muted">
            <StatusPill value={sitemap.complete ? "COMPLETE" : "PARTIAL"} />
            <span>From existing sitemaps: {sitemap.stats.fromSitemap}</span>
            <span>From crawl: {sitemap.stats.fromCrawl}</span>
            <span>Fetched: {sitemap.stats.fetched}</span>
            <span>Failed: {sitemap.stats.failed}</span>
            <span>{Math.round(sitemap.stats.durationMs / 1000)}s</span>
          </div>
          {sitemap.stoppedReason ? (
            <p className="mb-2 text-sm text-amber-100">{sitemap.stoppedReason}</p>
          ) : (
            <p className="mb-2 text-sm text-content-muted">Crawl finished after exhausting discoverable links.</p>
          )}
          <p className="mb-3 text-xs text-content-muted">{sitemap.honesty.explanation}</p>
          <pre className="mb-3 max-h-48 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-content-muted">
            {sitemap.xml.slice(0, 4000)}
            {sitemap.xml.length > 4000 ? "\n<!-- truncated preview — use Download for full file -->" : ""}
          </pre>
          <div className="max-h-64 overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ink-elevated text-content-muted">
                <tr>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {sitemap.urls.slice(0, 300).map((u) => (
                  <tr key={u.url} className="border-t border-white/5">
                    <td className="px-3 py-1.5 text-white/90">{u.url}</td>
                    <td className="px-3 py-1.5">{u.status ?? "—"}</td>
                    <td className="px-3 py-1.5">{u.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sitemap.urls.length > 300 ? (
              <p className="border-t border-white/10 px-3 py-2 text-[11px] text-content-muted">
                Showing first 300 rows — full list is inside the downloaded XML ({sitemap.urls.length} URLs).
              </p>
            ) : null}
          </div>
        </GrowthCard>
      ) : null}

      {robots ? (
        <div className="mt-6">
          <GrowthCard
            title="robots.txt"
            action={
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs"
                onClick={() => downloadText("robots.txt", robots.robotsTxt)}
              >
                Download robots.txt
              </button>
            }
          >
            <p className="mb-2 text-sm text-content-muted">{robots.note}</p>
            <p className="mb-3 text-xs text-content-muted">Suggested sitemap line: {robots.sitemapHint}</p>
            <pre className="overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-content-muted">
              {robots.robotsTxt}
            </pre>
          </GrowthCard>
        </div>
      ) : null}
    </AppShell>
  );
}
