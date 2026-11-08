"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, EmptyState, GrowthCard, StatusPill } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Opp = {
  id: string;
  title: string;
  description: string;
  whyItMatters?: string | null;
  recommendedAction?: string | null;
  priority: string;
  confidence: string;
  status: string;
  expectedOutcome?: string | null;
  successMetric?: string | null;
};

const STATUSES = ["NEW", "UNDER_REVIEW", "APPROVED", "REJECTED", "CONVERTED_TO_TASK", "IN_PROGRESS", "COMPLETED"];

export default function OpportunitiesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Opp[]>([]);

  async function load(cid = clientId, st = status) {
    const q = new URLSearchParams();
    if (cid) q.set("clientId", cid);
    if (st) q.set("status", st);
    const rows = await apiFetch<Opp[]>(`/companies/${companyId}/growth/opportunities?${q}`);
    setItems(rows);
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
  }, [companyId, clientId, status]);

  async function setOppStatus(id: string, next: string) {
    try {
      await apiFetch(`/companies/${companyId}/growth/opportunities/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success("Updated", next.replace(/_/g, " "));
      await load();
    } catch (err) {
      toast.error("Update failed", err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell title="Opportunity Inbox" subtitle="AI Growth Center" nav={companyNav(companyId)}>
      <div className="mb-4 grid gap-4 md:grid-cols-2 max-w-3xl">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        <label className="block text-xs text-content-muted">
          Status filter
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((o) => (
            <GrowthCard
              key={o.id}
              title={o.title}
              action={
                <div className="flex items-center gap-2">
                  <StatusPill value={o.priority} />
                  <StatusPill value={o.status} />
                </div>
              }
            >
              <p className="text-sm text-content-muted">{o.description}</p>
              {o.whyItMatters ? <p className="mt-2 text-sm"><span className="text-content-muted">Why: </span>{o.whyItMatters}</p> : null}
              {o.recommendedAction ? <p className="mt-1 text-sm"><span className="text-content-muted">Action: </span>{o.recommendedAction}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setOppStatus(o.id, s)}
                    className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-wide text-content-muted hover:text-white"
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </GrowthCard>
          ))
        ) : (
          <EmptyState text="No opportunities yet. Run Growth Partner → Discover opportunities." />
        )}
      </div>
    </AppShell>
  );
}
