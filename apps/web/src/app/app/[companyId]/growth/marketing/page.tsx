"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, GrowthCard, GrowthResultView } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

export default function MarketingExpertPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [resultKind, setResultKind] = useState("WEBSITE");
  const [campaign, setCampaign] = useState({
    name: "",
    objective: "Leads",
    targetAudience: "",
    productService: "",
    durationDays: 30,
    budgetRange: "",
    location: "",
    offer: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: Array<{ id: string; name: string; website?: string | null }> }>(
      `/companies/${companyId}/social-accounts`,
    ).then((p) => {
      setClients(p.clients ?? []);
      const first = p.clients?.[0];
      setClientId(first?.id ?? "");
      if (first?.website) setWebsiteUrl(first.website);
    });
  }, [companyId, router]);

  useEffect(() => {
    if (!clientId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    apiFetch<Array<{ id: string; kind: string; result: unknown; title: string }>>(
      `/companies/${companyId}/growth/runs?clientId=${encodeURIComponent(clientId)}`,
    )
      .then((runs) => {
        if (cancelled) return;
        const marketing = (runs ?? []).find((r) =>
          ["WEBSITE", "SOCIAL", "SEO", "CAMPAIGN"].includes(r.kind),
        );
        if (!marketing) {
          setResult(null);
          return;
        }
        setResult(marketing);
        setResultKind(marketing.kind);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, clientId]);

  async function run(path: string, body?: object) {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/companies/${companyId}/growth/${path}`, {
        method: "POST",
        body: JSON.stringify({ clientId, websiteUrl, ...body }),
      });
      setResult(res);
      setResultKind(
        path.includes("website")
          ? "WEBSITE"
          : path.includes("social")
            ? "SOCIAL"
            : path.includes("seo")
              ? "SEO"
              : "CAMPAIGN",
      );
      toast.success("Ready", path.replace(/-/g, " "));
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onCampaign(e: FormEvent) {
    e.preventDefault();
    await run("campaigns", campaign);
  }

  return (
    <AppShell title="Marketing Expert" subtitle="AI Growth Center" nav={companyNav(companyId)}>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        <label className="block text-xs text-content-muted">
          Website URL
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => run("website-audit")} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
          Website audit
        </button>
        <button disabled={busy} onClick={() => run("social-audit")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
          Social audit
        </button>
        <button disabled={busy} onClick={() => run("seo-analysis")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
          SEO & visibility
        </button>
      </div>

      <form onSubmit={onCampaign} className="panel mt-6 grid gap-3 p-5 md:grid-cols-2">
        <h2 className="font-display text-base font-semibold md:col-span-2">Campaign planner</h2>
        {(
          [
            ["name", "Campaign name"],
            ["objective", "Objective"],
            ["targetAudience", "Target audience"],
            ["productService", "Product / service"],
            ["budgetRange", "Budget range"],
            ["location", "Location"],
            ["offer", "Offer / promotion"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-xs text-content-muted">
            {label}
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={String(campaign[key] ?? "")}
              onChange={(e) => setCampaign({ ...campaign, [key]: e.target.value })}
              required={key === "name"}
            />
          </label>
        ))}
        <label className="block text-xs text-content-muted">
          Duration (days)
          <input
            type="number"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={campaign.durationDays}
            onChange={(e) => setCampaign({ ...campaign, durationDays: Number(e.target.value) })}
          />
        </label>
        <div className="md:col-span-2">
          <button disabled={busy} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
            Generate campaign strategy
          </button>
        </div>
      </form>

      <div className="mt-6">
        <GrowthCard title="Latest marketing output">
          {result ? (
            <GrowthResultView kind={resultKind} data={result} />
          ) : (
            <p className="text-sm text-content-muted">
              Run an audit or campaign plan to see a clear report. Metrics are never fabricated.
            </p>
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
