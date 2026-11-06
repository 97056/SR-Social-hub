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
  accountQuota?: number;
  isCustom: boolean;
};

type PublicPricing = {
  trial: { days: number; clientQuota: number; accountQuota: number; priceInr: number };
  plans: Plan[];
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
  const [trial, setTrial] = useState<PublicPricing["trial"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      apiFetch<BillingPayload>(`/companies/${companyId}/billing`),
      apiFetch<PublicPricing>("/public/pricing"),
    ])
      .then(([b, pricing]) => {
        setBilling(b);
        setPlans(pricing.plans ?? []);
        setTrial(pricing.trial ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const e = billing?.entitlements;

  return (
    <AppShell title="Billing" subtitle="Plan & usage (admin-managed)" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="panel mb-6 border-brand-primary/20 bg-brand-primary/5 p-4 text-sm leading-6 text-content-muted sm:p-5">
        Plan prices, client quotas, and custom negotiations are managed by{" "}
        <span className="text-content">SR Social Hub admin</span> only. Contact your administrator to
        upgrade, downgrade, or negotiate a custom client quota.
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Your plan" value={e?.planName ?? "—"} />
        <StatCard
          label="Status"
          value={e?.subscriptionStatus ?? (e?.publishingAllowed ? "OK" : "Restricted")}
        />
        <StatCard
          label="Client profiles"
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
        <h2 className="mb-3 font-display text-xl font-semibold">Catalog (live from admin)</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trial ? (
            <div className="panel p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">FREE TRIAL</p>
              <h3 className="mt-2 font-display text-lg font-semibold">Free trial</h3>
              <p className="mt-3 font-display text-2xl font-semibold">₹0</p>
              <p className="mt-2 text-sm text-content-muted">
                {trial.days} days · {trial.clientQuota} client
                {trial.clientQuota === 1 ? "" : "s"} · {trial.accountQuota} social
                {trial.accountQuota === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
          {plans.map((plan) => {
            const current = e?.planCode === plan.code;
            return (
              <div
                key={plan.code}
                className={`panel p-5 ${current ? "ring-1 ring-brand-primary/50" : ""}`}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">{plan.code}</p>
                <h3 className="mt-2 font-display text-lg font-semibold">{plan.name}</h3>
                {plan.isCustom ? (
                  <p className="mt-3 text-sm text-brand-primary">Quota negotiated with admin</p>
                ) : (
                  <p className="mt-3 font-display text-2xl font-semibold">
                    ₹{plan.monthlyPriceInr}
                    <span className="text-sm font-sans font-normal text-content-muted">/mo</span>
                  </p>
                )}
                <p className="mt-2 text-sm text-content-muted">
                  {plan.isCustom
                    ? "Custom client seats"
                    : `${plan.clientQuota} client profiles · ${plan.accountQuota ?? "—"} socials`}
                </p>
                {current ? (
                  <p className="mt-4 text-xs font-semibold text-brand-secondary">Current plan</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Invoices</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {(billing?.invoices ?? []).map((inv) => (
                <tr key={inv.id} className="border-t border-white/10">
                  <td className="px-4 py-3">{inv.number}</td>
                  <td className="px-4 py-3">{inv.status}</td>
                  <td className="px-4 py-3">₹{inv.totalInr}</td>
                  <td className="px-4 py-3">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!billing?.invoices?.length ? (
            <p className="px-4 py-4 text-sm text-content-muted">No invoices yet.</p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Payment history</h2>
        <ul className="panel divide-y divide-white/10 text-sm">
          {(billing?.payments ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
              <span>
                ₹{p.amountInr} · {p.status}
                {p.providerPaymentId ? ` · ${p.providerPaymentId}` : ""}
              </span>
              <span className="text-content-muted">{new Date(p.createdAt).toLocaleString()}</span>
            </li>
          ))}
          {!billing?.payments?.length ? (
            <li className="px-4 py-4 text-content-muted">No payments yet.</li>
          ) : null}
        </ul>
      </section>
    </AppShell>
  );
}
