"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Overview = {
  metrics: {
    registeredCompanies: number;
    activeCompanies: number;
    trialAccounts: number;
    activeClientWorkspaces: number;
    enabledIntegrations: number;
    monthlyRecurringRevenue: number;
    totalPostsCreated: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { email: string; fullName: string } | null;
  }>;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<Overview>("/admin/overview")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [router]);

  return (
    <AppShell title="Platform overview" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Companies" value={data?.metrics.registeredCompanies ?? "—"} />
        <StatCard label="Active" value={data?.metrics.activeCompanies ?? "—"} />
        <StatCard label="Trials" value={data?.metrics.trialAccounts ?? "—"} />
        <StatCard label="Client workspaces" value={data?.metrics.activeClientWorkspaces ?? "—"} />
        <StatCard label="MRR (₹)" value={data?.metrics.monthlyRecurringRevenue ?? "—"} />
        <StatCard label="Integrations on" value={data?.metrics.enabledIntegrations ?? "—"} />
        <StatCard label="Posts created" value={data?.metrics.totalPostsCreated ?? 0} hint="From live data only" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {(data?.recentActivity ?? []).slice(0, 10).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.action}</p>
                  <p className="text-content-muted">{item.actor?.fullName ?? "System"}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-content-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {!data?.recentActivity?.length ? (
              <li className="text-sm text-content-muted">No audit events yet.</li>
            ) : null}
          </ul>
        </div>
        <EmptyState
          title="Phase 2–3 controls online"
          body="Manage companies, plans, encrypted social configs, branding, and system flags from the admin sidebar. Publishing and OAuth adapters remain later phases."
        />
      </div>
    </AppShell>
  );
}
