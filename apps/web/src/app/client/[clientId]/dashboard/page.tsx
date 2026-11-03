"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Workspace = {
  client: {
    id: string;
    name: string;
    companyName: string;
    approvalWorkflow: string;
    industry: string | null;
    members: Array<{ role: string; email: string; fullName: string }>;
  };
  dashboard: {
    awaitingApproval: number;
    scheduledPosts: number;
    publishedPosts: number;
    connectedAccounts: number;
  };
};

export default function ClientDashboardPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/clients/${clientId}/workspace`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [clientId, router]);

  return (
    <AppShell
      title={data?.client.name ?? "Client workspace"}
      subtitle={data ? `Managed by ${data.client.companyName}` : "Client"}
      nav={clientNav(clientId)}
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting approval" value={data?.dashboard.awaitingApproval ?? 0} />
        <StatCard label="Scheduled" value={data?.dashboard.scheduledPosts ?? 0} />
        <StatCard label="Published" value={data?.dashboard.publishedPosts ?? 0} />
        <StatCard label="Connected accounts" value={data?.dashboard.connectedAccounts ?? 0} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="Approval inbox"
          body={`Workflow: ${data?.client.approvalWorkflow ?? "—"}. Full approve/reject/request-changes lands in Phase 7.`}
        />
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Members</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(data?.client.members ?? []).map((m) => (
              <li key={m.email} className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{m.fullName}</p>
                  <p className="text-content-muted">{m.email}</p>
                </div>
                <span className="text-xs text-content-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
