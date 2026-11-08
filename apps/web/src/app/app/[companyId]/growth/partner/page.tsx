"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ClientSelect, GrowthCard, GrowthResultView } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

export default function GrowthPartnerPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [resultKind, setResultKind] = useState("OPPORTUNITY");
  const [busy, setBusy] = useState(false);

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

  async function discover() {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/companies/${companyId}/growth/opportunities/discover`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
      setResult(res);
      setResultKind("OPPORTUNITY");
      toast.success("Discovery complete");
    } catch (err) {
      toast.error("Discovery failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function makePlan(days: 30 | 60 | 90) {
    if (!clientId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/companies/${companyId}/growth/plans`, {
        method: "POST",
        body: JSON.stringify({ clientId, horizonDays: days }),
      });
      setResult(res);
      setResultKind("PLAN");
      toast.success(`${days}-day plan created`);
    } catch (err) {
      toast.error("Plan failed", err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const base = `/app/${companyId}/growth`;

  return (
    <AppShell title="Growth Partner" subtitle="Turn insight into measurable action" nav={companyNav(companyId)}>
      <div className="mb-4 w-72">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
      </div>
      <GrowthCard title="Opportunity discovery engine">
        <p className="text-sm text-content-muted">
          Reviews the business profile, recent audits, rejected ideas, and performance gaps — then proposes
          prioritised opportunities without inventing metrics.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy} onClick={discover} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">
            Discover opportunities
          </button>
          <button disabled={busy} onClick={() => makePlan(30)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            Create 30-day plan
          </button>
          <button disabled={busy} onClick={() => makePlan(60)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            Create 60-day plan
          </button>
          <button disabled={busy} onClick={() => makePlan(90)} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">
            Create 90-day plan
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href={`${base}/opportunities`} className="text-brand-primary hover:underline">
            Opportunity Inbox →
          </Link>
          <Link href={`${base}/plans`} className="text-brand-primary hover:underline">
            Growth Plans →
          </Link>
          <Link href={`${base}/tasks`} className="text-brand-primary hover:underline">
            Tasks & Execution →
          </Link>
          <Link href={`${base}/results`} className="text-brand-primary hover:underline">
            Results Tracker →
          </Link>
        </div>
      </GrowthCard>
      <div className="mt-6">
        <GrowthCard title="Latest partner output">
          {result ? <GrowthResultView kind={resultKind} data={result} /> : (
            <p className="text-sm text-content-muted">Discover opportunities or create a plan to see a clear action list.</p>
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
