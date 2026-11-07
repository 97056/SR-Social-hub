"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { toast } from "@/components/toast";
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
  selfServeEnabled?: boolean;
  razorpayKeyId?: string | null;
  entitlements: {
    planCode: string | null;
    planName: string | null;
    isTrialing?: boolean;
    catalogPlanCode?: string | null;
    catalogPlanName?: string | null;
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

type RazorpayCheckout = {
  mode: "razorpay";
  invoiceId: string;
  planCode: string;
  interval: string;
  amountInr: number;
  razorpay: {
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill?: { name?: string };
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay script failed"));
    document.body.appendChild(script);
  });
}

export default function CompanyBillingPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [billing, setBilling] = useState<BillingPayload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trial, setTrial] = useState<PublicPricing["trial"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  async function reload() {
    const [b, pricing] = await Promise.all([
      apiFetch<BillingPayload>(`/companies/${companyId}/billing`),
      apiFetch<PublicPricing>("/public/pricing"),
    ]);
    setBilling(b);
    setPlans(pricing.plans ?? []);
    setTrial(pricing.trial ?? null);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    reload().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const e = billing?.entitlements;
  const isTrialing = Boolean(e?.isTrialing || e?.subscriptionStatus === "TRIALING" || e?.planCode === "TRIAL");
  const selfServe = Boolean(billing?.selfServeEnabled);

  async function upgrade(plan: Plan) {
    if (plan.isCustom || plan.monthlyPriceInr <= 0) {
      toast.error("Enterprise plan", "Contact admin to negotiate a custom quota.");
      return;
    }
    setBusyPlan(plan.code);
    setError(null);
    try {
      const res = await apiFetch<RazorpayCheckout | BillingPayload>(
        `/companies/${companyId}/billing/checkout`,
        {
          method: "POST",
          body: JSON.stringify({ planCode: plan.code, interval: "MONTHLY" }),
        },
      );

      if ("mode" in res && res.mode === "razorpay") {
        await loadRazorpayScript();
        if (!window.Razorpay) throw new Error("Razorpay checkout unavailable");
        const rz = res.razorpay;
        await new Promise<void>((resolve, reject) => {
          const checkout = new window.Razorpay!({
            key: rz.keyId,
            amount: rz.amount,
            currency: rz.currency,
            name: rz.name,
            description: rz.description,
            order_id: rz.orderId,
            prefill: rz.prefill ?? {},
            theme: { color: "#00D2FF" },
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              try {
                await apiFetch(`/companies/${companyId}/billing/confirm-razorpay`, {
                  method: "POST",
                  body: JSON.stringify({
                    planCode: res.planCode,
                    interval: res.interval,
                    invoiceId: res.invoiceId,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                toast.success("Upgraded", `${plan.name} is now active.`);
                await reload();
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled")),
            },
          });
          checkout.open();
        });
      } else {
        setBilling(res as BillingPayload);
        toast.success("Upgraded", `${plan.name} is now active.`);
        await reload();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upgrade failed";
      if (msg !== "Payment cancelled") {
        setError(msg);
        toast.error("Upgrade failed", msg);
      }
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <AppShell title="Billing" subtitle="Plan & usage" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="panel mb-6 border-brand-primary/20 bg-brand-primary/5 p-4 text-sm leading-6 text-content-muted sm:p-5">
        {selfServe
          ? "Upgrade anytime from this page. Payments are processed securely via Razorpay. Admin can switch test/live keys."
          : billing?.note ??
            "Self-serve checkout is off. Ask SR Social Hub admin to enable Payments and assign keys."}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Your plan" value={e?.planName ?? "—"} />
        <StatCard
          label="Status"
          value={
            isTrialing
              ? "TRIALING"
              : (e?.subscriptionStatus ?? (e?.publishingAllowed ? "OK" : "Restricted"))
          }
        />
        <StatCard
          label="Client profiles"
          value={`${e?.quotas.clients.used ?? 0}/${e?.quotas.clients.limit ?? 0}`}
        />
        <StatCard
          label="Social accounts"
          value={`${e?.quotas.accounts.used ?? 0}/${e?.quotas.accounts.limit ?? 0}`}
        />
      </div>

      {isTrialing && e?.trialEndsAt ? (
        <p className="mb-6 rounded-xl border border-brand-secondary/40 bg-brand-secondary/10 px-4 py-3 text-sm">
          Free trial active
          {e.catalogPlanName ? ` (catalog baseline: ${e.catalogPlanName})` : ""}. Ends{" "}
          {new Date(e.trialEndsAt).toLocaleString()}. Upgrade below to unlock higher client limits
          (3 / 6 / 9+).
        </p>
      ) : null}

      {e && !e.publishingAllowed ? (
        <p className="mb-6 rounded-xl border border-brand-error/40 bg-brand-error/10 px-4 py-3 text-sm">
          {e.publishingBlockReason}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold">Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {trial ? (
            <div
              className={`panel p-5 ${isTrialing ? "ring-1 ring-brand-primary/50" : ""}`}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-content-muted">FREE TRIAL</p>
              <h3 className="mt-2 font-display text-lg font-semibold">Free trial</h3>
              <p className="mt-3 font-display text-2xl font-semibold">₹0</p>
              <p className="mt-2 text-sm text-content-muted">
                {trial.days} days · {trial.clientQuota} client
                {trial.clientQuota === 1 ? "" : "s"} · {trial.accountQuota} social
                {trial.accountQuota === 1 ? "" : "s"}
              </p>
              {isTrialing ? (
                <p className="mt-4 text-xs font-semibold text-brand-secondary">Current plan</p>
              ) : null}
            </div>
          ) : null}
          {plans.map((plan) => {
            const currentPaid = !isTrialing && e?.planCode === plan.code;
            return (
              <div
                key={plan.code}
                className={`panel flex flex-col p-5 ${currentPaid ? "ring-1 ring-brand-primary/50" : ""}`}
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
                <div className="mt-auto pt-4">
                  {currentPaid ? (
                    <p className="text-xs font-semibold text-brand-secondary">Current plan</p>
                  ) : selfServe && !plan.isCustom && plan.monthlyPriceInr > 0 ? (
                    <button
                      type="button"
                      disabled={busyPlan === plan.code}
                      onClick={() => upgrade(plan)}
                      className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-ink-bg disabled:opacity-60"
                    >
                      {busyPlan === plan.code
                        ? "Opening…"
                        : isTrialing
                          ? "Upgrade & pay"
                          : "Switch plan"}
                    </button>
                  ) : plan.isCustom ? (
                    <p className="text-xs text-content-muted">Contact admin</p>
                  ) : null}
                </div>
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
