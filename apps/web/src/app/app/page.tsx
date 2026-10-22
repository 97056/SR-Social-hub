"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api, type Me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Billing = {
  subscription: { status: string; planCode: string } | null;
  usage: { clientProfiles: number; connectedAccounts: number; teamMembers: number; postTargets: number };
  limits: { clientProfiles: number; connectedAccounts: number; postTargetsPerMonth: number; teamMembers: number } | null;
  taxNote: string;
};

type Integration = { provider: string; displayName: string; state: string };
type Status = { publishingMode: string; publishingNote: string };

export default function WorkspaceHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => setError("Sign in to open the workspace."));
    api<Integration[]>("/api/integrations").then(setIntegrations).catch(() => undefined);
    api<Status>("/api/system/status").then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (me?.workspaceId) {
      api<Billing>("/api/billing").then(setBilling).catch(() => setBilling(null));
    }
  }, [me]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), workspaceType: form.get("workspaceType"), timezone: form.get("timezone") }),
      });
      const next = await api<Me>("/api/auth/me");
      setMe(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the workspace.");
    }
  }

  if (error && !me) return <p className="mx-auto max-w-3xl px-4 py-12">{error} <Link className="underline" href="/login">Sign in</Link></p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {status?.publishingMode === "sandbox" && <p className="mb-4 rounded-brand bg-accent px-4 py-3 text-sm text-accent-foreground">{status.publishingNote}</p>}
      <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
      <p className="mt-2 text-sm">Signed in as {me?.name}. Role: {me?.role ?? "none yet"}.</p>
      {!me?.workspaceId && (
        <form onSubmit={createWorkspace} className="mt-6 max-w-lg space-y-4 rounded-brand bg-surface p-5">
          <h2 className="text-xl font-semibold">Create a workspace</h2>
          <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
          <div>
            <Label htmlFor="workspaceType">Type</Label>
            <select id="workspaceType" name="workspaceType" className="w-full rounded-brand border border-black/10 bg-surface px-3 py-2">
              <option value="business">Business</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <div><Label htmlFor="timezone">Timezone</Label><Input id="timezone" name="timezone" defaultValue="Asia/Kolkata" required /></div>
          {error && <p role="alert" className="text-sm text-accent">{error}</p>}
          <Button type="submit">Create workspace</Button>
        </form>
      )}
      {billing && (
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Meter label="Clients" used={billing.usage.clientProfiles} max={billing.limits?.clientProfiles} />
          <Meter label="Accounts" used={billing.usage.connectedAccounts} max={billing.limits?.connectedAccounts} />
          <Meter label="Post targets" used={billing.usage.postTargets} max={billing.limits?.postTargetsPerMonth} />
          <Meter label="Members" used={billing.usage.teamMembers} max={billing.limits?.teamMembers} />
        </section>
      )}
      {me?.workspaceId && !billing && <p className="mt-6 text-sm">Choose a plan before creating clients. Checkout stays closed until Razorpay is configured and a signed webhook test passes.</p>}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Connectors</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {integrations.map((item) => (
            <li key={item.provider} className="rounded-brand border border-black/10 bg-surface p-4">
              <p className="font-semibold">{item.displayName}</p>
              <p className="text-sm capitalize">{item.state.replaceAll("_", " ")}</p>
            </li>
          ))}
        </ul>
      </section>
      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/app/clients">Clients</Link>
        <Link className="underline" href="/app/billing">Billing</Link>
      </nav>
    </div>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max?: number | null }) {
  return (
    <article className="rounded-brand bg-surface p-4">
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-semibold">{used}{max == null ? "" : ` / ${max}`}</p>
    </article>
  );
}
