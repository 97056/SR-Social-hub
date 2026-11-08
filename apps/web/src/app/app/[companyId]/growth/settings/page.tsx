"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { EmptyState, GrowthCard, MetricGrid } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Usage = {
  settings?: { provider?: string; monthlyLimit?: number; enabled?: boolean };
  month?: { units?: number };
  entitlements?: { remaining?: number | null; used?: number; limit?: number | null };
};

export default function GrowthSettingsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [jobs, setJobs] = useState<Array<{ id: string; kind: string; status: string }>>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      apiFetch<Usage>(`/companies/${companyId}/growth/usage`),
      apiFetch<Array<{ id: string; kind: string; status: string }>>(`/companies/${companyId}/growth/jobs`),
    ])
      .then(([u, j]) => {
        setUsage(u);
        setJobs(j || []);
      })
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [companyId, router]);

  return (
    <AppShell title="AI Settings & Usage" subtitle="Company workspace quotas" nav={companyNav(companyId)}>
      <p className="mb-4 text-sm text-content-muted">
        Provider keys and hard spending limits are managed in Super Admin → AI Growth Center. This page shows your
        workspace usage against plan AI quota and Growth Center monthly caps.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthCard title="Usage & entitlements">
          {usage ? (
            <MetricGrid
              items={[
                { label: "Provider", value: usage.settings?.provider || "—" },
                { label: "Growth enabled", value: usage.settings?.enabled ? "Yes" : "No" },
                { label: "Units this month", value: usage.month?.units ?? 0 },
                { label: "Monthly Growth cap", value: usage.settings?.monthlyLimit ?? "—" },
                { label: "Plan AI used", value: usage.entitlements?.used ?? 0 },
                { label: "Plan AI remaining", value: usage.entitlements?.remaining ?? "—" },
              ]}
            />
          ) : (
            <EmptyState text="Loading usage…" />
          )}
        </GrowthCard>
        <GrowthCard title="Background jobs">
          {jobs.length ? (
            <ul className="space-y-2 text-sm">
              {jobs.slice(0, 12).map((j) => (
                <li key={j.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                  <span>{j.kind}</span>
                  <span className="text-content-muted">{j.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="No background jobs yet." />
          )}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
