"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Plan } from "@/lib/api";
import { formatInr } from "@/lib/utils";

function limitLine(value: number | null, label: string, exact: boolean) {
  if (value == null) return `Negotiated ${label}`;
  return exact ? `${value} ${label} included` : `${value} ${label}`;
}

export function Pricing() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Plan[]>("/api/plans").then(setPlans).catch(() => setError("Pricing is unavailable until the API is running."));
  }, []);

  if (error) return <p className="text-sm">{error}</p>;
  if (!plans) return <p className="text-sm">Loading plans…</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const custom = plan.limits.negotiated || plan.pricePaise == null;
        return (
          <article key={plan.code} className="flex flex-col rounded-brand border border-black/10 bg-surface p-5 shadow-sm">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm opacity-80">{plan.description}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{custom ? "Quote" : formatInr(plan.pricePaise)}</p>
            <p className="text-sm opacity-70">{custom ? "Negotiated monthly" : plan.pricesIncludeTax ? "per month, taxes included" : "per month, taxes extra"}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              <li>{limitLine(plan.limits.clientProfiles, "client profiles", plan.limits.exactClientCap)}</li>
              <li>{limitLine(plan.limits.connectedAccounts, "connected accounts", false)}</li>
              <li>{limitLine(plan.limits.postTargetsPerMonth, "post targets / month", false)}</li>
              <li>{limitLine(plan.limits.teamMembers, "team members", false)}</li>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Link href={custom ? "/quote" : "/register"} className="mt-5 rounded-brand bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
              {custom ? "Request a quote" : "Choose plan"}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
