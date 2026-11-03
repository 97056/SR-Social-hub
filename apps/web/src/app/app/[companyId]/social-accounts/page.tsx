"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Payload = {
  clients: Array<{ id: string; name: string }>;
  platforms: Array<{
    code: string;
    name: string;
    enabled: boolean;
    connectable: boolean;
  }>;
  accounts: Array<{
    id: string;
    clientId: string;
    clientName: string;
    platformCode: string;
    accountName: string | null;
    username: string | null;
    status: string;
    connectionMode: string;
    tokenExpiresAt: string | null;
  }>;
};

export default function CompanySocialAccountsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Payload | null>(null);
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("FACEBOOK");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const payload = await apiFetch<Payload>(`/companies/${companyId}/social-accounts`);
    setData(payload);
    if (!clientId && payload.clients[0]) setClientId(payload.clients[0].id);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  async function connect() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ authorizeUrl: string }>(
        `/companies/${companyId}/clients/${clientId}/social-accounts/${platform}/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            redirectTo: `${window.location.origin}/client/${clientId}/social-accounts`,
          }),
        },
      );
      window.location.href = res.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setBusy(false);
    }
  }

  async function disconnect(accountId: string) {
    await apiFetch(`/social-accounts/${accountId}/disconnect`, { method: "POST" });
    await load();
  }

  return (
    <AppShell title="Social accounts" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Connected" value={data?.accounts.length ?? 0} />
        <StatCard
          label="Enabled platforms"
          value={data?.platforms.filter((p) => p.enabled).length ?? 0}
        />
        <StatCard label="Clients" value={data?.clients.length ?? 0} />
      </div>

      <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-4">
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {(data?.clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {(data?.platforms ?? []).map((p) => (
            <option key={p.code} value={p.code} disabled={!p.connectable}>
              {p.name}
              {!p.enabled ? " (disabled)" : !p.connectable ? " (soon)" : ""}
            </option>
          ))}
        </select>
        <button
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2"
          disabled={busy || !clientId}
          onClick={connect}
        >
          {busy ? "Redirecting…" : "Connect account"}
        </button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.accounts ?? []).map((a) => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="px-4 py-3">{a.clientName}</td>
                <td className="px-4 py-3">{a.platformCode}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{a.accountName ?? "—"}</p>
                  <p className="text-xs text-content-muted">@{a.username ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-xs">{a.connectionMode}</td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    className="text-xs text-brand-secondary"
                    onClick={() => router.push(`/client/${a.clientId}/social-accounts`)}
                  >
                    Manage
                  </button>
                  <button
                    className="text-xs text-brand-error"
                    onClick={() => disconnect(a.id)}
                  >
                    Disconnect
                  </button>
                </td>
              </tr>
            ))}
            {!data?.accounts?.length ? (
              <tr>
                <td className="px-4 py-6 text-content-muted" colSpan={5}>
                  No connected accounts yet. Enable Facebook in admin, then connect for a client.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
