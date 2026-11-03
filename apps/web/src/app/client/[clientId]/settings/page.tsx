"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type Workspace = {
  client: {
    name: string;
    industry: string | null;
    brandVoice: string | null;
    timezone: string;
    approvalWorkflow: string;
    companyId: string;
  };
};

const WORKFLOWS = [
  "CLIENT_THEN_PUBLISH",
  "COMPANY_THEN_PUBLISH",
  "CLIENT_THEN_COMPANY",
  "CLIENT_THEN_AUTO_SCHEDULE",
] as const;

export default function ClientSettingsPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const [form, setForm] = useState({
    name: "",
    industry: "",
    brandVoice: "",
    timezone: "UTC",
    approvalWorkflow: "CLIENT_THEN_PUBLISH",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/clients/${clientId}/workspace`)
      .then((w) =>
        setForm({
          name: w.client.name,
          industry: w.client.industry ?? "",
          brandVoice: w.client.brandVoice ?? "",
          timezone: w.client.timezone,
          approvalWorkflow: w.client.approvalWorkflow,
        }),
      )
      .catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await apiFetch(`/clients/${clientId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Client settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="Profile and settings" subtitle="Client workspace" nav={clientNav(clientId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}
      <form onSubmit={onSubmit} className="panel max-w-xl space-y-3 p-5">
        <label className="block text-xs text-content-muted">
          Name
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block text-xs text-content-muted">
          Industry
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />
        </label>
        <label className="block text-xs text-content-muted">
          Brand voice
          <textarea
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            rows={3}
            value={form.brandVoice}
            onChange={(e) => setForm({ ...form, brandVoice: e.target.value })}
          />
        </label>
        <label className="block text-xs text-content-muted">
          Timezone
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </label>
        <label className="block text-xs text-content-muted">
          Approval workflow
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
            value={form.approvalWorkflow}
            onChange={(e) => setForm({ ...form, approvalWorkflow: e.target.value })}
          >
            {WORKFLOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white">
          Save settings
        </button>
      </form>
    </AppShell>
  );
}
