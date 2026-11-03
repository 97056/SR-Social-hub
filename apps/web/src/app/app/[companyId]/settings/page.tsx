"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Workspace = {
  company: {
    name: string;
    status: string;
    timezone: string;
    trialEndsAt: string | null;
    plan: { name: string; clientQuota: number; monthlyPriceInr: number } | null;
  };
};

export default function CompanySettingsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Workspace | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/companies/${companyId}/workspace`).then(setData);
  }, [companyId, router]);

  return (
    <AppShell title="Settings" subtitle="Company workspace" nav={companyNav(companyId)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Status" value={data?.company.status ?? "—"} />
        <StatCard label="Timezone" value={data?.company.timezone ?? "—"} />
        <StatCard label="Plan" value={data?.company.plan?.name ?? "—"} />
      </div>
      <div className="mt-4">
        <EmptyState
          title="Subscription and billing"
          body="Plan upgrades, invoices, and payment webhooks ship in Phase 10. Current plan quotas are already enforced when creating clients."
        />
      </div>
    </AppShell>
  );
}
