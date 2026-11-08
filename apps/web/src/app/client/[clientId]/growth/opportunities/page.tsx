"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Opp = { id: string; title: string; description: string; status: string; priority: string; recommendedAction?: string | null };

export default function ClientOpportunitiesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Opp[]>([]);

  async function load() {
    setItems(await apiFetch<Opp[]>(`/clients/${clientId}/growth/opportunities`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => toast.error("Load failed", e.message));
  }, [clientId, router]);

  async function decide(id: string, status: string) {
    await apiFetch(`/clients/${clientId}/growth/opportunities/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    toast.success("Updated");
    await load();
  }

  return (
    <AppShell title="Opportunities" subtitle="Review and approve recommendations" nav={clientNav(clientId)}>
      <div className="space-y-3">
        {items.length ? items.map((o) => (
          <GrowthCard key={o.id} title={o.title} action={<><StatusPill value={o.priority} /><StatusPill value={o.status} /></>}>
            <p className="text-sm text-content-muted">{o.description}</p>
            {o.recommendedAction ? <p className="mt-2 text-sm">{o.recommendedAction}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {["UNDER_REVIEW", "APPROVED", "REJECTED", "COMPLETED"].map((s) => (
                <button key={s} onClick={() => decide(o.id, s)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-content-muted">
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </GrowthCard>
        )) : <EmptyState text="No opportunities yet." />}
      </div>
    </AppShell>
  );
}
