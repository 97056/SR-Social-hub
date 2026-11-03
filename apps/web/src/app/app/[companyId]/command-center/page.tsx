"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type CommandCenter = {
  attention: Array<{ type: string; title: string; detail: string }>;
  today: { campaigns: number; approvals: number; publishingJobs: number; scheduled: number };
  clientsNeedingAttention: Array<{ id: string; name: string; reason: string }>;
  pendingInvites: Array<{ id: string; email: string; expiresAt: string }>;
  team: Array<{ role: string; email: string; fullName: string }>;
  aiCreditsRemaining: number;
};

export default function CommandCenterPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<CommandCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<CommandCenter>(`/companies/${companyId}/command-center`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  return (
    <AppShell title="SR Command Center" subtitle="Daily operations" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns today" value={data?.today.campaigns ?? 0} />
        <StatCard label="Approvals" value={data?.today.approvals ?? 0} />
        <StatCard label="Publishing jobs" value={data?.today.publishingJobs ?? 0} />
        <StatCard label="AI credits" value={data?.aiCreditsRemaining ?? 0} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-5 lg:col-span-1">
          <h2 className="font-display text-lg font-semibold">Needs attention</h2>
          <ul className="mt-4 space-y-3">
            {(data?.attention ?? []).map((item, idx) => (
              <li key={idx} className="rounded-xl border border-white/10 bg-ink-elevated p-3 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-content-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white"
              onClick={() => router.push(`/app/${companyId}/clients`)}
            >
              Create content / client
            </button>
            <button
              className="rounded-xl border border-white/10 px-3 py-2 text-xs"
              onClick={() => router.push(`/app/${companyId}/team`)}
            >
              Invite teammate
            </button>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Clients</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(data?.clientsNeedingAttention ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-content-muted">{c.reason}</p>
                </div>
                <button
                  className="text-xs text-brand-secondary"
                  onClick={() => router.push(`/client/${c.id}/dashboard`)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Pending invites</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(data?.pendingInvites ?? []).map((i) => (
              <li key={i.id}>
                <p className="font-medium">{i.email}</p>
                <p className="text-content-muted">
                  Expires {new Date(i.expiresAt).toLocaleString()}
                </p>
              </li>
            ))}
            {!data?.pendingInvites?.length ? (
              <li className="text-content-muted">No open invitations.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
