"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type AdminBilling = {
  mrrInr: number;
  activeSubscriptions: number;
  trialing: number;
  pastDue: number;
  subscriptions: Array<{
    id: string;
    status: string;
    interval: string;
    currentPeriodEnd: string;
    company: { id: string; name: string; slug: string; status: string };
    plan: { code: string; name: string; monthlyPriceInr: number };
  }>;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    totalInr: number;
    createdAt: string;
    company: { id: string; name: string };
  }>;
};

export default function AdminBillingPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminBilling | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<AdminBilling>("/admin/billing")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  return (
    <AppShell title="Billing overview" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR (INR)" value={`₹${data?.mrrInr ?? 0}`} />
        <StatCard label="Active" value={data?.activeSubscriptions ?? 0} />
        <StatCard label="Trialing" value={data?.trialing ?? 0} />
        <StatCard label="Past due / grace" value={data?.pastDue ?? 0} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Subscriptions</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-content-muted">
              <tr>
                <th className="pb-2 font-medium">Company</th>
                <th className="pb-2 font-medium">Plan</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Interval</th>
                <th className="pb-2 font-medium">Period end</th>
              </tr>
            </thead>
            <tbody>
              {(data?.subscriptions ?? []).map((s) => (
                <tr key={s.id} className="border-t border-white/10">
                  <td className="py-2">{s.company.name}</td>
                  <td className="py-2">{s.plan.name}</td>
                  <td className="py-2">{s.status}</td>
                  <td className="py-2">{s.interval}</td>
                  <td className="py-2">{new Date(s.currentPeriodEnd).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Recent invoices</h2>
        <ul className="space-y-2 text-sm">
          {(data?.invoices ?? []).map((inv) => (
            <li key={inv.id} className="flex flex-wrap justify-between gap-2 border-t border-white/10 py-2">
              <span>
                {inv.company.name} · {inv.number} · {inv.status} · ₹{inv.totalInr}
              </span>
              <span className="text-content-muted">{new Date(inv.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
