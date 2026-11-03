"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Plan = {
  code: string;
  name: string;
  monthlyPriceInr: number;
  yearlyPriceInr: number | null;
  clientQuota: number;
  isCustom: boolean;
};

type BillingPayload = {
  note: string;
  billingMode: string;
  entitlements: {
    planCode: string | null;
    planName: string | null;
    subscriptionStatus: string | null;
    interval: string | null;
    trialEndsAt: string | null;
    periodEndsAt: string | null;
    publishingAllowed: boolean;
    publishingBlockReason: string | null;
    quotas: {
      clients: { used: number; limit: number; remaining: number };
      accounts: { used: number; limit: number; remaining: number };
      storageMb: { used: number; limit: number; remaining: number };
      ai: { used: number; limit: number; remaining: number };
    };
    addonClientSeats: number;
  };
  subscription: {
    id: string;
    status: string;
    interval: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
    addons: Array<{ code: string; quantity: number }>;
  } | null;
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    totalInr: number;
    paidAt: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    amountInr: number;
    status: string;
    providerPaymentId: string | null;
    createdAt: string;
  }>;
};

export default function CompanyBillingPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [b, p] = await Promise.all([
      apiFetch<BillingPayload>(`/companies/${companyId}/billing`),
      apiFetch<Plan[]>("/billing/plans"),
    ]);
    setBilling(b);
    setPlans(p);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  async function checkout(planCode: string, interval: "MONTHLY" | "YEARLY") {
    setBusy(`${planCode}-${interval}`);
    setError(null);
    try {
      setBilling(
        await apiFetch<BillingPayload>(`/companies/${companyId}/billing/checkout`, {
          method: "POST",
          body: JSON.stringify({ planCode, interval }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function buyAddon() {
    setBusy("addon");
    setError(null);
    try {
      setBilling(
        await apiFetch<BillingPayload>(`/companies/${companyId}/billing/addons`, {
          method: "POST",
          body: JSON.stringify({ code: "EXTRA_CLIENT", quantity: 1 }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add-on failed");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(immediate: boolean) {
    setBusy(immediate ? "cancel-now" : "cancel-end");
    setError(null);
    try {
      setBilling(
        await apiFetch<BillingPayload>(`/companies/${companyId}/billing/cancel`, {
          method: "POST",
          body: JSON.stringify({ immediate }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  }

  const e = billing?.entitlements;

  return (
    <AppShell title="Billing" subtitle="Plans, invoices, and quotas" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {billing?.note ? <p className="mb-4 text-sm text-content-muted">{billing.note}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plan" value={e?.planName ?? "—"} />
        <StatCard
          label="Status"
          value={e?.subscriptionStatus ?? (e?.publishingAllowed ? "OK" : "Restricted")}
        />
        <StatCard
          label="Clients"
          value={`${e?.quotas.clients.used ?? 0}/${e?.quotas.clients.limit ?? 0}`}
        />
        <StatCard
          label="Storage (MB)"
          value={`${e?.quotas.storageMb.used ?? 0}/${e?.quotas.storageMb.limit ?? 0}`}
        />
      </div>

      {e && !e.publishingAllowed ? (
        <p className="mb-6 rounded-xl border border-brand-error/40 bg-brand-error/10 px-4 py-3 text-sm">
          {e.publishingBlockReason}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Plans</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {plans
            .filter((p) => !p.isCustom)
            .map((plan) => (
              <div key={plan.code} className="panel space-y-3 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-content-muted">
                    ₹{plan.monthlyPriceInr}/mo
                    {plan.yearlyPriceInr ? ` · ₹${plan.yearlyPriceInr}/yr` : null}
                  </p>
                </div>
                <p className="text-sm text-content-muted">{plan.clientQuota} clients included</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => checkout(plan.code, "MONTHLY")}
                  >
                    {busy === `${plan.code}-MONTHLY` ? "Processing…" : "Subscribe monthly"}
                  </button>
                  <button
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    disabled={busy !== null || !plan.yearlyPriceInr}
                    onClick={() => checkout(plan.code, "YEARLY")}
                  >
                    {busy === `${plan.code}-YEARLY` ? "Processing…" : "Subscribe yearly"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Subscription actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => buyAddon()}
          >
            {busy === "addon" ? "Adding…" : "Add client seat (+₹299)"}
          </button>
          <button
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={busy !== null || !billing?.subscription}
            onClick={() => cancel(false)}
          >
            Cancel at period end
          </button>
          <button
            className="rounded-xl border border-brand-error/40 px-4 py-2 text-sm font-semibold text-brand-error disabled:opacity-50"
            disabled={busy !== null || !billing?.subscription}
            onClick={() => cancel(true)}
          >
            Cancel immediately
          </button>
        </div>
        {billing?.subscription?.cancelAtPeriodEnd ? (
          <p className="text-sm text-content-muted">
            Cancellation scheduled for {new Date(billing.subscription.currentPeriodEnd).toLocaleString()}.
          </p>
        ) : null}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-content-muted">
              <tr>
                <th className="pb-2 font-medium">Number</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {(billing?.invoices ?? []).map((inv) => (
                <tr key={inv.id} className="border-t border-white/10">
                  <td className="py-2">{inv.number}</td>
                  <td className="py-2">{inv.status}</td>
                  <td className="py-2">₹{inv.totalInr}</td>
                  <td className="py-2">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!billing?.invoices?.length ? (
            <p className="text-sm text-content-muted">No invoices yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Payment history</h2>
        <ul className="space-y-2 text-sm">
          {(billing?.payments ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-white/10 py-2">
              <span>
                ₹{p.amountInr} · {p.status}
                {p.providerPaymentId ? ` · ${p.providerPaymentId}` : ""}
              </span>
              <span className="text-content-muted">{new Date(p.createdAt).toLocaleString()}</span>
            </li>
          ))}
          {!billing?.payments?.length ? (
            <li className="text-content-muted">No payments yet.</li>
          ) : null}
        </ul>
      </section>
    </AppShell>
  );
}
