"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Overview = {
  profiles: number;
  opportunities: Record<string, number>;
  plans: number;
  tasks: Record<string, number>;
  reports: number;
  recentRuns: Array<{ id: string; kind: string; title: string | null; status: string; createdAt: string }>;
  usage: { units: number };
  modules: Record<string, string>;
};

export default function GrowthOverviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(cid = clientId) {
    const q = cid ? `?clientId=${cid}` : "";
    setData(await apiFetch<Overview>(`/companies/${companyId}/growth/overview${q}`));
  }

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
      .catch(() => setClients([]));
  }, [companyId, router]);

  useEffect(() => {
    if (!getToken()) return;
    refresh().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, clientId]);

  const base = `/app/${companyId}/growth`;

  return (
    <AppShell title="AI Growth Center" subtitle="Business · Marketing · Growth Partner" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 w-72">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Profiles", data?.profiles ?? "—"],
          ["Open opportunities", data ? Object.values(data.opportunities).reduce((a, b) => a + b, 0) : "—"],
          ["Plans", data?.plans ?? "—"],
          ["AI units (month)", data?.usage.units ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-content-muted">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {data
          ? Object.entries(data.modules).map(([key, desc]) => (
              <GrowthCard key={key} title={key.replace(/([A-Z])/g, " $1")}>
                <p className="text-sm text-content-muted">{desc}</p>
              </GrowthCard>
            ))
          : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GrowthCard title="Quick links">
          <div className="flex flex-wrap gap-2">
            {[
              ["Business Consultant", `${base}/business`],
              ["Marketing Expert", `${base}/marketing`],
              ["Growth Partner", `${base}/partner`],
              ["Opportunity Inbox", `${base}/opportunities`],
              ["Plans", `${base}/plans`],
              ["Tasks", `${base}/tasks`],
              ["Results", `${base}/results`],
              ["Reports", `${base}/reports`],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[var(--text)] hover:border-brand-primary/40"
              >
                {label}
              </Link>
            ))}
          </div>
        </GrowthCard>
        <GrowthCard title="Recent analysis runs">
          {data?.recentRuns?.length ? (
            <ul className="space-y-2">
              {data.recentRuns.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {r.title || r.kind}
                    <span className="ml-2 text-xs text-content-muted">{new Date(r.createdAt).toLocaleString()}</span>
                  </span>
                  <StatusPill value={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No runs yet. Start with Business Consultant." />
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
