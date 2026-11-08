"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, EmptyState, GrowthCard, MetricGrid, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Results = {
  snapshots: Array<{ id: string; label: string; metrics: Record<string, unknown>; note?: string | null; capturedAt: string }>;
  completedActivities: {
    tasks: Record<string, number>;
    opportunities: Record<string, number>;
    campaigns: number;
    connectedSocialAccounts: number;
  };
  disclaimer: string;
};

export default function ResultsTrackerPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [data, setData] = useState<Results | null>(null);
  const [label, setLabel] = useState("Weekly snapshot");
  const [metricsJson, setMetricsJson] = useState('{"postsPublished":3,"whatsappEnquiries":12,"repeatBuyers":4}');

  async function load(cid = clientId) {
    if (!cid) return;
    setData(await apiFetch<Results>(`/companies/${companyId}/growth/results/${cid}`));
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
    if (!clientId) return;
    load().catch((e: Error) => toast.error("Load failed", e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, clientId]);

  async function onSnapshot(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    try {
      const metrics = JSON.parse(metricsJson) as Record<string, unknown>;
      await apiFetch(`/companies/${companyId}/growth/results/${clientId}/snapshots`, {
        method: "POST",
        body: JSON.stringify({ label, metrics }),
      });
      toast.success("Snapshot saved");
      await load();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Invalid JSON or request error");
    }
  }

  const tasksDone = data?.completedActivities.tasks.DONE ?? 0;
  const tasksTodo = data?.completedActivities.tasks.TODO ?? 0;
  const oppsNew = data?.completedActivities.opportunities.NEW ?? 0;

  return (
    <AppShell title="Results Tracker" subtitle="Evidence-based progress only" nav={companyNav(companyId)}>
      <div className="mb-4 max-w-sm">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
      </div>
      {data ? (
        <div className="mb-6">
          <MetricGrid
            items={[
              { label: "Tasks done", value: tasksDone },
              { label: "Tasks to do", value: tasksTodo },
              { label: "New opportunities", value: oppsNew },
              { label: "Campaign drafts", value: data.completedActivities.campaigns },
              { label: "Connected socials", value: data.completedActivities.connectedSocialAccounts },
              { label: "Snapshots", value: data.snapshots.length },
            ]}
          />
          <p className="mt-3 text-xs text-content-muted">{data.disclaimer}</p>
        </div>
      ) : null}
      <form onSubmit={onSnapshot} className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
        <label className="block text-xs text-content-muted">
          Snapshot label
          <input className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block text-xs text-content-muted md:col-span-2">
          Metrics JSON
          <textarea className="mt-1 min-h-[90px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 font-mono text-xs text-white" value={metricsJson} onChange={(e) => setMetricsJson(e.target.value)} />
        </label>
        <button className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">Save snapshot</button>
      </form>
      <GrowthCard title="Saved snapshots">
        {data?.snapshots?.length ? (
          <div className="space-y-3">
            {data.snapshots.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{s.label}</p>
                  <StatusPill value={new Date(s.capturedAt).toLocaleDateString()} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-content-muted">
                  {Object.entries(s.metrics || {}).map(([k, v]) => (
                    <span key={k} className="rounded-lg border border-white/10 px-2 py-1">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
                {s.note ? <p className="mt-2 text-xs text-content-muted">{s.note}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No snapshots yet. Save a measured baseline or progress snapshot here." />
        )}
      </GrowthCard>
    </AppShell>
  );
}
