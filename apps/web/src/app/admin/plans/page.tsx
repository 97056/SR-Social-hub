"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Plan = {
  id: string;
  code: string;
  name: string;
  monthlyPriceInr: number;
  yearlyPriceInr: number | null;
  clientQuota: number;
  aiQuota: number;
  storageMb: number;
  accountQuota: number;
  teamQuota: number;
  isActive: boolean;
};

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setPlans(await apiFetch<Plan[]>("/admin/plans"));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [router]);

  async function save(plan: Plan) {
    await apiFetch(`/admin/plans/${plan.code}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: plan.name,
        monthlyPriceInr: Number(plan.monthlyPriceInr),
        yearlyPriceInr: plan.yearlyPriceInr == null ? undefined : Number(plan.yearlyPriceInr),
        clientQuota: Number(plan.clientQuota),
        aiQuota: Number(plan.aiQuota),
        storageMb: Number(plan.storageMb),
        accountQuota: Number(plan.accountQuota),
        teamQuota: Number(plan.teamQuota),
        isActive: plan.isActive,
      }),
    });
    await load();
  }

  return (
    <AppShell title="Subscription plans" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="panel space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{plan.code}</h2>
              <label className="flex items-center gap-2 text-xs text-content-muted">
                <input
                  type="checkbox"
                  checked={plan.isActive}
                  onChange={(e) =>
                    setPlans((all) =>
                      all.map((p) => (p.id === plan.id ? { ...p, isActive: e.target.checked } : p)),
                    )
                  }
                />
                Active
              </label>
            </div>
            {(
              [
                ["name", "Name"],
                ["monthlyPriceInr", "Monthly ₹"],
                ["yearlyPriceInr", "Yearly ₹"],
                ["clientQuota", "Clients"],
                ["aiQuota", "AI quota"],
                ["storageMb", "Storage MB"],
                ["accountQuota", "Accounts"],
                ["teamQuota", "Team"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs text-content-muted">
                {label}
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={String(plan[key] ?? "")}
                  onChange={(e) =>
                    setPlans((all) =>
                      all.map((p) =>
                        p.id === plan.id
                          ? {
                              ...p,
                              [key]:
                                key === "name"
                                  ? e.target.value
                                  : e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                            }
                          : p,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <button
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => save(plan)}
            >
              Save {plan.code}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
