"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { BulletList, ClientSelect, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

const KINDS = [
  "BUSINESS_ANALYSIS",
  "WEBSITE_AUDIT",
  "SOCIAL_AUDIT",
  "COMPETITOR_ANALYSIS",
  "SEO",
  "MARKETING_STRATEGY",
  "GROWTH_PLAN",
  "MONTHLY_GROWTH",
];

type Report = {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  content: {
    keyFindings?: Array<{ kind?: string; title?: string | null; at?: string }>;
    recommendations?: Array<{ title?: string; priority?: string; action?: string | null; status?: string }>;
    nextActions?: Array<string | null>;
    limitations?: string;
    analysisPeriod?: string;
  };
  limitations?: string | null;
};

export default function GrowthReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState(KINDS[0]!);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);

  async function load(cid = clientId) {
    const q = cid ? `?clientId=${cid}` : "";
    setReports(await apiFetch<Report[]>(`/companies/${companyId}/growth/reports${q}`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ clients: Array<{ id: string; name: string }> }>(`/companies/${companyId}/social-accounts`).then(
      (p) => {
        setClients(p.clients ?? []);
        setClientId(p.clients?.[0]?.id ?? "");
      },
    );
  }, [companyId, router]);

  useEffect(() => {
    if (!getToken()) return;
    load().catch((e: Error) => toast.error("Load failed", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, clientId]);

  async function create() {
    if (!clientId) return;
    try {
      const report = await apiFetch<Report>(`/companies/${companyId}/growth/reports`, {
        method: "POST",
        body: JSON.stringify({ clientId, kind }),
      });
      toast.success("Report generated");
      setSelected(report);
      await load();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Error");
    }
  }

  function exportPdf() {
    window.print();
  }

  return (
    <AppShell title="Growth Reports" subtitle="History + printable summaries" nav={companyNav(companyId)}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-72">
          <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        </div>
        <label className="block text-xs text-content-muted">
          Report kind
          <select className="mt-1 rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <button onClick={create} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">Generate</button>
        <button onClick={exportPdf} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Print / PDF</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthCard title="Report history">
          {reports.length ? (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r)} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-left text-sm hover:border-brand-primary/40">
                    <span>{r.title}</span>
                    <StatusPill value={r.kind} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No reports yet." />
          )}
        </GrowthCard>
        <GrowthCard title="Selected report">
          {selected ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={selected.kind} />
                <span className="text-content-muted">{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-content-muted">Period: {selected.content?.analysisPeriod || "—"}</p>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-content-muted">Key findings</p>
                <BulletList
                  items={(selected.content?.keyFindings || []).map(
                    (f) => `${f.kind || "Run"}: ${f.title || "Untitled"}`,
                  )}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-content-muted">Recommendations</p>
                <BulletList
                  items={(selected.content?.recommendations || []).map(
                    (r) => `${r.priority || "MED"} · ${r.title || ""}${r.action ? ` — ${r.action}` : ""}`,
                  )}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-content-muted">Next actions</p>
                <BulletList items={selected.content?.nextActions || []} />
              </div>
              <p className="text-xs text-content-muted">{selected.limitations || selected.content?.limitations}</p>
            </div>
          ) : (
            <EmptyState text="Select or generate a report." />
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
