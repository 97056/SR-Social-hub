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
  isCustom: boolean;
};

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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
    setError(null);
    setSaved(null);
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
        isCustom: plan.isCustom,
      }),
    });
    await load();
    setSaved(plan.code);
  }

  function patch(id: string, patch: Partial<Plan>) {
    setPlans((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <AppShell title="Subscription plans" subtitle="Admin-only pricing & quotas" nav={adminNav()}>
      <p className="mb-5 max-w-3xl text-sm leading-6 text-content-muted">
        Agencies see their assigned plan on Billing but cannot change pricing or quotas. Assign plans
        from Companies. Use <span className="text-brand-primary">Custom</span> for negotiated client
        seats and pricing.
      </p>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {saved ? (
        <p className="mb-4 text-sm text-brand-secondary">Saved {saved}.</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="panel space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-content-muted">{plan.code}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{plan.name}</h2>
                {plan.isCustom ? (
                  <p className="mt-1 text-xs text-brand-primary">Custom negotiation · admin assigns quota</p>
                ) : (
                  <p className="mt-1 text-xs text-content-muted">
                    ₹{plan.monthlyPriceInr}/mo · {plan.clientQuota} client profiles
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 text-xs text-content-muted">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={plan.isActive}
                    onChange={(e) => patch(plan.id, { isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={plan.isCustom}
                    onChange={(e) => patch(plan.id, { isCustom: e.target.checked })}
                  />
                  Custom / negotiate
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Display name", "text"],
                  ["monthlyPriceInr", "Monthly ₹", "number"],
                  ["yearlyPriceInr", "Yearly ₹", "number"],
                  ["clientQuota", "Client profiles", "number"],
                  ["aiQuota", "AI quota", "number"],
                  ["storageMb", "Storage MB", "number"],
                  ["accountQuota", "Social accounts", "number"],
                  ["teamQuota", "Team seats", "number"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="block text-xs text-content-muted sm:col-span-1">
                  {label}
                  <input
                    className="field"
                    type={type}
                    value={String(plan[key] ?? "")}
                    onChange={(e) =>
                      patch(plan.id, {
                        [key]:
                          key === "name"
                            ? e.target.value
                            : e.target.value === ""
                              ? null
                              : Number(e.target.value),
                      } as Partial<Plan>)
                    }
                  />
                </label>
              ))}
            </div>

            <button className="btn-primary" type="button" onClick={() => save(plan)}>
              Save {plan.code}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
