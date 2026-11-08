"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, MetricGrid, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

export default function ClientResultsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [data, setData] = useState<{
    snapshots: Array<{ id: string; label: string; metrics: Record<string, unknown>; capturedAt: string }>;
    completedActivities: {
      tasks: Record<string, number>;
      opportunities: Record<string, number>;
      campaigns: number;
      connectedSocialAccounts: number;
    };
    disclaimer: string;
  } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{
      snapshots: Array<{ id: string; label: string; metrics: Record<string, unknown>; capturedAt: string }>;
      completedActivities: {
        tasks: Record<string, number>;
        opportunities: Record<string, number>;
        campaigns: number;
        connectedSocialAccounts: number;
      };
      disclaimer: string;
    }>(`/clients/${clientId}/growth/results`)
      .then(setData)
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [clientId, router]);

  return (
    <AppShell title="Results" subtitle="Growth progress" nav={clientNav(clientId)}>
      <GrowthCard title="Tracker">
        {data ? (
          <div className="space-y-4">
            <MetricGrid
              items={[
                { label: "Tasks done", value: data.completedActivities.tasks.DONE ?? 0 },
                { label: "Open opportunities", value: data.completedActivities.opportunities.NEW ?? 0 },
                { label: "Campaigns", value: data.completedActivities.campaigns },
                { label: "Connected socials", value: data.completedActivities.connectedSocialAccounts },
              ]}
            />
            {data.snapshots.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{s.label}</span>
                  <StatusPill value={new Date(s.capturedAt).toLocaleDateString()} />
                </div>
              </div>
            ))}
            <p className="text-xs text-content-muted">{data.disclaimer}</p>
          </div>
        ) : (
          <EmptyState text="Loading…" />
        )}
      </GrowthCard>
    </AppShell>
  );
}
