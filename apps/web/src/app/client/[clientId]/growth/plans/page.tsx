"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Plan = { id: string; title: string; status: string; summary?: string | null; horizonDays: number };

export default function ClientPlansPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Plan[]>(`/clients/${clientId}/growth/plans`)
      .then(setPlans)
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [clientId, router]);

  async function approve(id: string) {
    await apiFetch(`/clients/${clientId}/growth/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    toast.success("Plan approved");
    setPlans(await apiFetch<Plan[]>(`/clients/${clientId}/growth/plans`));
  }

  return (
    <AppShell title="Growth Plans" subtitle="Review and approve" nav={clientNav(clientId)}>
      <div className="space-y-3">
        {plans.length ? plans.map((p) => (
          <GrowthCard key={p.id} title={p.title} action={<StatusPill value={p.status} />}>
            <p className="text-sm text-content-muted">{p.summary}</p>
            <p className="mt-2 text-xs text-content-muted">{p.horizonDays}-day horizon</p>
            <button onClick={() => approve(p.id)} className="mt-3 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white">
              Approve plan
            </button>
          </GrowthCard>
        )) : <EmptyState text="No plans shared yet." />}
      </div>
    </AppShell>
  );
}
