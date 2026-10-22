"use client";

import { useEffect, useState } from "react";
import { ApiError, api, type Plan } from "@/lib/api";
import { formatInr } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Plan[]>("/api/plans").then(setPlans).catch(() => setMessage("Plans could not be loaded."));
  }, []);

  async function checkout(code: string) {
    try {
      await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planCode: code }) });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Checkout did not start.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-2 text-sm">No subscription is activated from the browser. A signed Razorpay webhook is the only way a payment changes the workspace.</p>
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      <ul className="mt-6 space-y-3">
        {plans.map((plan) => (
          <li key={plan.code} className="flex items-center justify-between gap-4 rounded-brand bg-surface p-4">
            <div>
              <p className="font-semibold">{plan.name}</p>
              <p className="text-sm">{plan.pricePaise == null ? "Request a quote" : `${formatInr(plan.pricePaise)} / month, ${plan.pricesIncludeTax ? "taxes included" : "taxes extra"}`}</p>
            </div>
            {plan.limits.negotiated ? <a className="underline" href="/quote">Request a quote</a> : <Button type="button" onClick={() => checkout(plan.code)}>Checkout</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
