"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Workspace = {
  clients: Array<{
    id: string;
    name: string;
    industry: string | null;
    approvalWorkflow: string;
    contactEmail: string | null;
  }>;
};

export default function CompanyClientsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    externalCode: "",
    industry: "",
    contactEmail: "",
    brandVoice: "",
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteClientId, setInviteClientId] = useState("");

  async function load() {
    setData(await apiFetch<Workspace>(`/companies/${companyId}/workspace`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/companies/${companyId}/clients`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", externalCode: "", industry: "", contactEmail: "", brandVoice: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setInviteToken(null);
    try {
      const res = await apiFetch<{ acceptToken: string; acceptPath: string }>(
        `/companies/${companyId}/clients/${inviteClientId}/invitations`,
        {
          method: "POST",
          body: JSON.stringify({ email: inviteEmail, role: "APPROVER" }),
        },
      );
      setInviteToken(`${window.location.origin}${res.acceptPath}`);
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  return (
    <AppShell title="Clients" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {inviteToken ? (
        <p className="mb-4 rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 p-3 text-sm">
          Invite link (dev): {inviteToken}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
        <h2 className="font-display text-lg font-semibold md:col-span-2">Create client workspace</h2>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Client name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="External code"
          value={form.externalCode}
          onChange={(e) => setForm({ ...form, externalCode: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Industry"
          value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Contact email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm md:col-span-2"
          placeholder="Brand voice"
          value={form.brandVoice}
          onChange={(e) => setForm({ ...form, brandVoice: e.target.value })}
        />
        <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white md:col-span-2">
          Create client
        </button>
      </form>

      <form onSubmit={onInvite} className="panel mb-6 grid gap-3 p-5 md:grid-cols-3">
        <h2 className="font-display text-lg font-semibold md:col-span-3">Invite client user</h2>
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={inviteClientId}
          onChange={(e) => setInviteClientId(e.target.value)}
          required
        >
          <option value="">Select client</option>
          {(data?.clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          required
        />
        <button className="rounded-xl border border-white/15 bg-ink-elevated px-4 py-2 text-sm font-semibold">
          Send invite
        </button>
      </form>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.clients ?? []).map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.industry ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{c.approvalWorkflow}</td>
                <td className="px-4 py-3">
                  <button
                    className="text-xs text-brand-secondary"
                    onClick={() => router.push(`/client/${c.id}/dashboard`)}
                  >
                    Open workspace
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
