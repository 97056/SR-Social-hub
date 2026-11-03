"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Workspace = {
  company: {
    id: string;
    name: string;
    status: string;
    plan: { name: string; clientQuota: number } | null;
    counts: { clients: number; members: number };
  };
  clients: Array<{ id: string; name: string; industry: string | null }>;
  dashboard: {
    totalClients: number;
    teamMembers: number;
    awaitingApproval: number;
    remainingClientQuota: number | null;
  };
};

export default function CompanyDashboardPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/companies/${companyId}/workspace`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [companyId, router]);

  return (
    <AppShell
      title={data ? `Welcome, ${data.company.name}` : "Company dashboard"}
      subtitle={data?.company.plan?.name ?? "Company workspace"}
      nav={companyNav(companyId)}
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Create Post", "Multi-platform content studio", `/app/${companyId}/create`],
          ["Media Library", "Upload images and video", `/app/${companyId}/media`],
          ["Command Center", "Daily operating screen", `/app/${companyId}/command-center`],
          ["Social Accounts", "Connect networks", `/app/${companyId}/social-accounts`],
        ].map(([title, body, href]) => (
          <button
            key={title}
            className="panel p-4 text-left transition hover:border-brand-primary/40"
            onClick={() => router.push(href)}
          >
            <p className="font-display font-semibold">{title}</p>
            <p className="mt-2 text-sm text-content-muted">{body}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={data?.dashboard.totalClients ?? "—"} />
        <StatCard label="Team" value={data?.dashboard.teamMembers ?? "—"} />
        <StatCard label="Awaiting approval" value={data?.dashboard.awaitingApproval ?? 0} />
        <StatCard
          label="Client quota left"
          value={data?.dashboard.remainingClientQuota ?? "—"}
          hint={data?.company.status}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Clients</h2>
          <ul className="mt-4 divide-y divide-white/10">
            {(data?.clients ?? []).map((client) => (
              <li key={client.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-content-muted">{client.industry ?? "No industry"}</p>
                </div>
                <button
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs"
                  onClick={() => router.push(`/client/${client.id}/dashboard`)}
                >
                  Open
                </button>
              </li>
            ))}
            {!data?.clients?.length ? (
              <li className="py-3 text-sm text-content-muted">No clients yet.</li>
            ) : null}
          </ul>
        </div>
        <EmptyState
          title="Today at a glance"
          body="Open Command Center for invites, trial warnings, and attention items as publishing comes online."
        />
      </div>
    </AppShell>
  );
}
