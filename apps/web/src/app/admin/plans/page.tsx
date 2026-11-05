"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
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

type TrialSettings = {
  trialDays: number;
  trialClientQuota: number;
  trialAccountQuota: number;
};

const emptyDraft = (): Omit<Plan, "id"> => ({
  code: "",
  name: "",
  monthlyPriceInr: 999,
  yearlyPriceInr: 9990,
  clientQuota: 5,
  aiQuota: 100,
  storageMb: 2048,
  accountQuota: 10,
  teamQuota: 5,
  isActive: true,
  isCustom: false,
});

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trial, setTrial] = useState<TrialSettings>({
    trialDays: 7,
    trialClientQuota: 1,
    trialAccountQuota: 2,
  });
  const [draft, setDraft] = useState<Omit<Plan, "id"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [planList, settings] = await Promise.all([
      apiFetch<Plan[]>("/admin/plans"),
      apiFetch<TrialSettings & Record<string, unknown>>("/admin/settings"),
    ]);
    setPlans(planList);
    setTrial({
      trialDays: Number(settings.trialDays ?? 7),
      trialClientQuota: Number(settings.trialClientQuota ?? 1),
      trialAccountQuota: Number(settings.trialAccountQuota ?? 2),
    });
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
    setBusy(true);
    try {
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
      toast.success("Plan saved", plan.code);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      toast.error("Save failed", message);
    } finally {
      setBusy(false);
    }
  }

  async function createPlan() {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      const code = draft.code.trim().toUpperCase().replace(/\s+/g, "_");
      await apiFetch<Plan>("/admin/plans", {
        method: "POST",
        body: JSON.stringify({
          code,
          name: draft.name.trim(),
          monthlyPriceInr: Number(draft.monthlyPriceInr),
          yearlyPriceInr:
            draft.yearlyPriceInr == null ? undefined : Number(draft.yearlyPriceInr),
          clientQuota: Number(draft.clientQuota),
          aiQuota: Number(draft.aiQuota),
          storageMb: Number(draft.storageMb),
          accountQuota: Number(draft.accountQuota),
          teamQuota: Number(draft.teamQuota),
          isActive: draft.isActive,
          isCustom: draft.isCustom,
        }),
      });
      setDraft(null);
      await load();
      setSaved(code);
      toast.success("Plan created", code);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Create failed";
      setError(message);
      toast.error("Create failed", message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTrial() {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          trialDays: Number(trial.trialDays),
          trialClientQuota: Number(trial.trialClientQuota),
          trialAccountQuota: Number(trial.trialAccountQuota),
        }),
      });
      await load();
      setSaved("FREE_TRIAL");
      toast.success("Free trial updated", `${trial.trialDays} days`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Trial save failed";
      setError(message);
      toast.error("Trial save failed", message);
    } finally {
      setBusy(false);
    }
  }

  function patch(id: string, next: Partial<Plan>) {
    setPlans((all) => all.map((p) => (p.id === id ? { ...p, ...next } : p)));
  }

  function planFields(
    values: {
      name: string;
      monthlyPriceInr: number;
      yearlyPriceInr: number | null;
      clientQuota: number;
      aiQuota: number;
      storageMb: number;
      accountQuota: number;
      teamQuota: number;
    },
    onChange: (patch: Record<string, string | number | null>) => void,
    extra?: ReactNode,
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {extra}
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
          <label key={key} className="block text-xs text-content-muted">
            {label}
            <input
              className="field"
              type={type}
              value={String(values[key] ?? "")}
              onChange={(e) =>
                onChange({
                  [key]:
                    key === "name"
                      ? e.target.value
                      : e.target.value === ""
                        ? null
                        : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <AppShell title="Subscription plans" subtitle="Admin-only pricing & quotas" nav={adminNav()}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-content-muted">
          Agencies see their assigned plan on Billing but cannot change pricing or quotas. Assign
          plans from Companies. Edit free trial limits here — new registrations use these values.
        </p>
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={busy || !!draft}
          onClick={() => setDraft(emptyDraft())}
        >
          + Add plan
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {saved ? <p className="mb-4 text-sm text-brand-secondary">Saved {saved}.</p> : null}

      <section className="panel mb-4 space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-content-muted">FREE TRIAL</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Registration trial</h2>
            <p className="mt-1 text-xs text-content-muted">
              Applies to every new Individual / Company signup until they convert to a paid plan.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-content-muted">
            Trial days
            <input
              className="field"
              type="number"
              min={1}
              value={trial.trialDays}
              onChange={(e) => setTrial((t) => ({ ...t, trialDays: Number(e.target.value) || 1 }))}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Trial client profiles
            <input
              className="field"
              type="number"
              min={1}
              value={trial.trialClientQuota}
              onChange={(e) =>
                setTrial((t) => ({ ...t, trialClientQuota: Number(e.target.value) || 1 }))
              }
            />
          </label>
          <label className="block text-xs text-content-muted">
            Trial social accounts
            <input
              className="field"
              type="number"
              min={1}
              value={trial.trialAccountQuota}
              onChange={(e) =>
                setTrial((t) => ({ ...t, trialAccountQuota: Number(e.target.value) || 1 }))
              }
            />
          </label>
        </div>
        <button className="btn-primary" type="button" disabled={busy} onClick={saveTrial}>
          Save free trial
        </button>
      </section>

      {draft ? (
        <section className="panel mb-4 space-y-4 border border-brand-primary/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-brand-primary">NEW PLAN</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Create subscription plan</h2>
            </div>
            <div className="flex flex-col items-end gap-2 text-xs text-content-muted">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isCustom}
                  onChange={(e) => setDraft({ ...draft, isCustom: e.target.checked })}
                />
                Custom / negotiate
              </label>
            </div>
          </div>
          {planFields(draft, (next) => setDraft({ ...draft, ...next }), (
            <label className="block text-xs text-content-muted sm:col-span-2">
              Plan code (UPPER_SNAKE)
              <input
                className="field font-mono uppercase"
                value={draft.code}
                placeholder="GROWTH"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
                  })
                }
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" type="button" disabled={busy} onClick={createPlan}>
              Create plan
            </button>
            <button
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold"
              type="button"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="panel space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-content-muted">{plan.code}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{plan.name}</h2>
                {plan.isCustom ? (
                  <p className="mt-1 text-xs text-brand-primary">
                    Custom negotiation · admin assigns quota
                  </p>
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

            {planFields(plan, (next) => patch(plan.id, next as Partial<Plan>))}

            <button className="btn-primary" type="button" disabled={busy} onClick={() => save(plan)}>
              Save {plan.code}
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
