"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import {
  BusinessAnalysisView,
  ClientSelect,
  CompetitorAnalysisView,
  GrowthCard,
} from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

const FIELDS = [
  ["businessName", "Business name"],
  ["websiteUrl", "Website URL"],
  ["industry", "Industry"],
  ["category", "Category"],
  ["description", "Business description"],
  ["productsServices", "Products & services"],
  ["targetAudience", "Target audience"],
  ["location", "Location"],
  ["serviceAreas", "Service areas"],
  ["goals", "Current goals"],
  ["competitors", "Competitors (names or URLs)"],
  ["uniqueSellingPoints", "Unique selling points"],
  ["challenges", "Current challenges"],
  ["monthlyBudgetRange", "Monthly marketing budget range"],
] as const;

export default function BusinessConsultantPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [competitors, setCompetitors] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: Array<{ id: string; name: string }> }>(`/companies/${companyId}/social-accounts`)
      .then((p) => {
        setClients(p.clients ?? []);
        setClientId(p.clients?.[0]?.id ?? "");
      })
      .catch(() => undefined);
  }, [companyId, router]);

  useEffect(() => {
    if (!clientId) return;
    apiFetch<{ profile: Record<string, string | null> }>(`/companies/${companyId}/growth/profile/${clientId}`)
      .then((p) => {
        const next: Record<string, string> = {};
        for (const [key] of FIELDS) next[key] = String(p.profile?.[key] ?? "");
        setForm(next);
      })
      .catch(() => undefined);
    apiFetch<Array<{ kind: string; result: unknown }>>(`/companies/${companyId}/growth/runs?clientId=${clientId}`)
      .then((runs) => {
        const biz = runs.find((r) => r.kind === "BUSINESS");
        const comp = runs.find((r) => r.kind === "COMPETITOR");
        if (biz) setAnalysis(biz);
        if (comp) setCompetitors(comp);
      })
      .catch(() => undefined);
  }, [companyId, clientId]);

  async function saveProfile(e: FormEvent, confirm = false) {
    e.preventDefault();
    if (!clientId) return;
    setBusy(true);
    try {
      await apiFetch(`/companies/${companyId}/growth/profile/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, confirm }),
      });
      toast.success("Profile saved", confirm ? "Marked as confirmed." : "Business profile updated.");
    } catch (err) {
      toast.error("Save failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function run(kind: "business" | "competitors") {
    if (!clientId) return;
    setBusy(true);
    try {
      const path = kind === "business" ? "business-analysis" : "competitor-analysis";
      const res = await apiFetch(`/companies/${companyId}/growth/${path}`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
      if (kind === "business") setAnalysis(res);
      else setCompetitors(res);
      toast.success("Analysis ready");
    } catch (err) {
      toast.error("Analysis failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Business Consultant" subtitle="AI Growth Center" nav={companyNav(companyId)}>
      <div className="mb-4 w-72">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
      </div>
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={(e) => saveProfile(e, false)}>
        {FIELDS.map(([key, label]) => (
          <label
            key={key}
            className={`block text-xs text-content-muted ${
              key === "description" ||
              key === "productsServices" ||
              key === "competitors" ||
              key === "challenges"
                ? "lg:col-span-2"
                : ""
            }`}
          >
            {label}
            {key === "description" ||
            key === "productsServices" ||
            key === "competitors" ||
            key === "challenges" ||
            key === "goals" ||
            key === "uniqueSellingPoints" ||
            key === "targetAudience" ||
            key === "serviceAreas" ? (
              <textarea
                className="mt-1 min-h-[88px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ) : (
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            )}
          </label>
        ))}
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <button disabled={busy} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
            Save profile
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => saveProfile(e, true)}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm"
          >
            Save & confirm
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("business")}
            className="rounded-xl border border-brand-primary/40 px-4 py-2.5 text-sm"
          >
            Run business analysis
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("competitors")}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm"
          >
            Run competitor analysis
          </button>
        </div>
      </form>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <GrowthCard title="Business analysis">
          {analysis ? (
            <BusinessAnalysisView data={analysis} />
          ) : (
            <p className="text-sm text-content-muted">
              Fill the business profile, save it, then run business analysis to see a clear SWOT and next steps.
            </p>
          )}
        </GrowthCard>
        <GrowthCard title="Competitor analysis">
          {competitors ? (
            <CompetitorAnalysisView data={competitors} />
          ) : (
            <p className="text-sm text-content-muted">
              Competitors come from profile names/URLs only — never invented brands.
            </p>
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
