"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type ClientOption = { id: string; name: string; website?: string | null; industry?: string | null };

type AnalysisResult = {
  generatedAt: string;
  clientName: string | null;
  summary: string;
  brandSignals: {
    industry: string;
    audience: string;
    positioning: string;
    primaryChannels: string[];
    keywords: string[];
  };
  websiteSnapshot: {
    url: string;
    title: string | null;
    description: string | null;
    headings: string[];
    note: string | null;
  } | null;
  competitors: Array<{
    name: string;
    why: string;
    likelyChannels: string[];
    contentAngle: string;
    strength: string;
  }>;
  channelGaps: Array<{ channel: string; opportunity: string }>;
  nextActions: string[];
  disclaimer: string;
};

export default function CompetitorAnalysisPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: ClientOption[] }>(`/companies/${companyId}/social-accounts`)
      .then((payload) => {
        setClients(payload.clients ?? []);
        setClientId(payload.clients?.[0]?.id ?? "");
      })
      .catch(() => setClients([]));
  }, [companyId, router]);

  useEffect(() => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    if (c.website) setWebsiteUrl(c.website);
    if (c.industry) setIndustry(c.industry);
  }, [clientId, clients]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<AnalysisResult>(`/companies/${companyId}/analysis/competitors`, {
        method: "POST",
        body: JSON.stringify({
          clientId: clientId || undefined,
          websiteUrl: websiteUrl || undefined,
          industry: industry || undefined,
          businessDescription,
        }),
      });
      setResult(res);
      toast.success("Analysis ready", "Competitor landscape generated from your description.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      toast.error("Analysis failed", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Competitor Analysis"
      subtitle="Business description → social landscape"
      nav={companyNav(companyId)}
      tone="#FF6B6B"
    >
      <p className="mb-5 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Yes — this is possible. Paste the client business description (and website if you have it).
        We map category signals, likely competitor types, channel gaps, and next publishing actions.
        This is a planning aid, not live scraped follower counts.
      </p>

      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <form noValidate onSubmit={onSubmit} className="panel mb-8 grid gap-4 p-5 md:grid-cols-2">
        <label className="block text-xs text-[var(--muted)]">
          Client (optional)
          <select
            className="field"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            title="Client for analysis"
          >
            <option value="">No client selected</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--muted)]">
          Industry
          <input
            className="field"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Fashion boutique, SaaS, real estate"
            title="Industry"
          />
        </label>
        <label className="block text-xs text-[var(--muted)] md:col-span-2">
          Website URL
          <input
            className="field"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            title="Website URL"
          />
        </label>
        <label className="block text-xs text-[var(--muted)] md:col-span-2">
          Business description
          <textarea
            className="field min-h-[140px]"
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            placeholder="Who they serve, what they sell, cities, price positioning, what makes them different…"
            title="Business description"
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-ink-bg disabled:opacity-60 md:col-span-2"
        >
          {busy ? "Analyzing…" : "Run competitor analysis"}
        </button>
      </form>

      {result ? (
        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="font-display text-xl font-semibold">Summary</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{result.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-[var(--border)] px-2 py-1">
                {result.brandSignals.industry}
              </span>
              <span className="rounded-lg border border-[var(--border)] px-2 py-1">
                {result.brandSignals.audience}
              </span>
              <span className="rounded-lg border border-[var(--border)] px-2 py-1">
                {result.brandSignals.positioning}
              </span>
            </div>
          </section>

          {result.websiteSnapshot ? (
            <section className="panel p-5">
              <h2 className="font-display text-lg font-semibold">Website signals</h2>
              <p className="mt-2 text-sm text-brand-primary">{result.websiteSnapshot.url}</p>
              {result.websiteSnapshot.title ? (
                <p className="mt-2 text-sm font-medium">{result.websiteSnapshot.title}</p>
              ) : null}
              {result.websiteSnapshot.description ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{result.websiteSnapshot.description}</p>
              ) : null}
              {result.websiteSnapshot.note ? (
                <p className="mt-2 text-xs text-[var(--muted)]">{result.websiteSnapshot.note}</p>
              ) : null}
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 font-display text-xl font-semibold">Competitor landscape</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {result.competitors.map((c) => (
                <article key={c.name} className="panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {c.strength}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{c.why}</p>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Channels: {c.likelyChannels.join(" · ")}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text)]">{c.contentAngle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold">Channel gaps</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {result.channelGaps.map((g) => (
                <li key={g.channel}>
                  <p className="font-medium">{g.channel}</p>
                  <p className="text-[var(--muted)]">{g.opportunity}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-lg font-semibold">Next actions</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
              {result.nextActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{result.disclaimer}</p>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
