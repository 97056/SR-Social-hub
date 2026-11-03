"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Analytics = {
  rangeDays: number;
  note: string;
  posts: { total: number; published: number; failed: number };
  publishing: {
    totalJobs: number;
    published: number;
    failed: number;
    successRate: number | null;
    byPlatform: Array<{
      platformCode: string;
      published: number;
      failed: number;
      total: number;
      successRate: number | null;
    }>;
  };
  campaigns: Array<{ id: string; name: string; posts: number }>;
  externalMetrics: Record<string, { available: boolean; note?: string }>;
};

export default function CompanyAnalyticsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Analytics>(`/companies/${companyId}/analytics?days=30`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  return (
    <AppShell title="Analytics" subtitle="Internal publishing metrics" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {data?.note ? <p className="mb-4 text-sm text-content-muted">{data.note}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Posts (30d)" value={data?.posts.total ?? 0} />
        <StatCard label="Published posts" value={data?.posts.published ?? 0} />
        <StatCard label="Publish jobs OK" value={data?.publishing.published ?? 0} />
        <StatCard
          label="Success rate"
          value={
            data?.publishing.successRate == null
              ? "—"
              : `${Math.round(data.publishing.successRate * 100)}%`
          }
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Platforms</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-content-muted">
              <tr>
                <th className="pb-2 font-medium">Platform</th>
                <th className="pb-2 font-medium">Jobs</th>
                <th className="pb-2 font-medium">Published</th>
                <th className="pb-2 font-medium">Failed</th>
                <th className="pb-2 font-medium">Success</th>
              </tr>
            </thead>
            <tbody>
              {(data?.publishing.byPlatform ?? []).map((row) => (
                <tr key={row.platformCode} className="border-t border-white/10">
                  <td className="py-2">{row.platformCode}</td>
                  <td className="py-2">{row.total}</td>
                  <td className="py-2">{row.published}</td>
                  <td className="py-2">{row.failed}</td>
                  <td className="py-2">
                    {row.successRate == null ? "—" : `${Math.round(row.successRate * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Campaigns</h2>
        <ul className="space-y-2 text-sm">
          {(data?.campaigns ?? []).map((c) => (
            <li key={c.id} className="border-t border-white/10 py-2">
              {c.name} · {c.posts} posts
            </li>
          ))}
          {!data?.campaigns?.length ? (
            <li className="text-content-muted">No campaigns yet.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Provider insights</h2>
        <ul className="space-y-2 text-sm text-content-muted">
          {Object.entries(data?.externalMetrics ?? {}).map(([key, meta]) => (
            <li key={key}>
              {key}: {meta.available ? "available" : "unavailable"}
              {meta.note ? ` — ${meta.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
