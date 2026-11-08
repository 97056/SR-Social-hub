"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Plan = {
  id: string;
  title: string;
  horizonDays: number;
  status: string;
  summary?: string | null;
  milestones?: Array<{ id: string; title: string; dueDate?: string | null }>;
};

export default function GrowthPlansPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);

  async function load(cid = clientId) {
    const q = cid ? `?clientId=${cid}` : "";
    setPlans(await apiFetch<Plan[]>(`/companies/${companyId}/growth/plans${q}`));
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

  async function create(days: 30 | 60 | 90) {
    if (!clientId) return;
    try {
      await apiFetch(`/companies/${companyId}/growth/plans`, {
        method: "POST",
        body: JSON.stringify({ clientId, horizonDays: days }),
      });
      toast.success("Plan created");
      await load();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Error");
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await apiFetch(`/companies/${companyId}/growth/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success("Plan updated");
      await load();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell title="Growth Plans" subtitle="30 / 60 / 90 day plans" nav={companyNav(companyId)}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-72">
          <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        </div>
        {[30, 60, 90].map((d) => (
          <button key={d} onClick={() => create(d as 30 | 60 | 90)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            New {d}-day plan
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {plans.length ? (
          plans.map((p) => (
            <GrowthCard key={p.id} title={p.title} action={<StatusPill value={p.status} />}>
              <p className="text-sm text-content-muted">{p.summary}</p>
              <p className="mt-2 text-xs text-content-muted">Horizon: {p.horizonDays} days</p>
              {p.milestones?.length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {p.milestones.map((m) => (
                    <li key={m.id}>• {m.title}{m.dueDate ? ` — ${new Date(m.dueDate).toLocaleDateString()}` : ""}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "COMPLETED", "ARCHIVED"].map((s) => (
                  <button key={s} onClick={() => setStatus(p.id, s)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-content-muted">
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </GrowthCard>
          ))
        ) : (
          <EmptyState text="No growth plans yet." />
        )}
      </div>
    </AppShell>
  );
}
