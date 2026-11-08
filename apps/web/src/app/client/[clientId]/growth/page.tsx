"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, MetricGrid } from "@/components/growth/growth-ui";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

export default function ClientGrowthOverviewPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [data, setData] = useState<{
    profiles: number;
    opportunities: Record<string, number>;
    plans: number;
    tasks: Record<string, number>;
    reports: number;
    usage: { units: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{
      profiles: number;
      opportunities: Record<string, number>;
      plans: number;
      tasks: Record<string, number>;
      reports: number;
      usage: { units: number };
    }>(`/clients/${clientId}/growth/overview`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  const base = `/client/${clientId}/growth`;

  return (
    <AppShell title="AI Growth Center" subtitle="Your business growth workspace" nav={clientNav(clientId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["Business profile", `${base}/profile`],
          ["Opportunities", `${base}/opportunities`],
          ["Plans", `${base}/plans`],
          ["Tasks", `${base}/tasks`],
          ["Results", `${base}/results`],
          ["Reports", `${base}/reports`],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-brand-primary/40">
            {label}
          </Link>
        ))}
      </div>
      <GrowthCard title="Overview">
        {data ? (
          <MetricGrid
            items={[
              { label: "Profile ready", value: data.profiles ? "Yes" : "No" },
              {
                label: "Opportunities",
                value: Object.values(data.opportunities || {}).reduce((a, b) => a + b, 0),
              },
              { label: "Plans", value: data.plans },
              { label: "Open tasks", value: data.tasks?.TODO ?? 0 },
              { label: "Reports", value: data.reports },
              { label: "AI units used", value: data.usage?.units ?? 0 },
            ]}
          />
        ) : (
          <EmptyState text="Loading growth overview…" />
        )}
      </GrowthCard>
    </AppShell>
  );
}
