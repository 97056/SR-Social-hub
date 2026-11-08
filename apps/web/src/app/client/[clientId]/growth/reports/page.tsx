"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { BulletList, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Report = {
  id: string;
  title: string;
  kind: string;
  content: {
    recommendations?: Array<{ title?: string; action?: string | null }>;
    nextActions?: Array<string | null>;
  };
  createdAt: string;
};

export default function ClientReportsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Report[]>(`/clients/${clientId}/growth/reports`)
      .then(setReports)
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [clientId, router]);

  return (
    <AppShell title="Reports" subtitle="Your growth reports" nav={clientNav(clientId)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthCard title="History">
          {reports.length ? (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r)} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-left text-sm">
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
        <GrowthCard title="Selected">
          {selected ? (
            <div className="space-y-3 text-sm">
              <StatusPill value={selected.kind} />
              <BulletList
                items={(selected.content?.recommendations || []).map(
                  (r) => `${r.title || "Recommendation"}${r.action ? ` — ${r.action}` : ""}`,
                )}
              />
              <BulletList items={selected.content?.nextActions || []} empty="No next actions listed" />
            </div>
          ) : (
            <EmptyState text="Select a report." />
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
