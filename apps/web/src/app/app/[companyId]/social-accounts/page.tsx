"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { SocialPlatformIcon, PLATFORM_BRAND_COLOR } from "@/components/social-platform-icon";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type PlatformInfo = {
  code: string;
  name: string;
  enabled: boolean;
  mode: string;
  hasCredentials: boolean;
  connectable: boolean;
  setupHint?: string;
  capabilities: {
    publishText?: boolean;
    publishImage?: boolean;
    publishVideo?: boolean;
    assistedOnly?: boolean;
    notes?: string;
  };
};

type AccountRow = {
  id: string;
  clientId: string;
  clientName: string;
  platformCode: string;
  accountName: string | null;
  username: string | null;
  externalAccountId?: string | null;
  status: string;
  connectionMode: string;
  tokenExpiresAt: string | null;
  needsReconnect?: boolean;
};

type Payload = {
  oauthMode: string;
  plan: {
    code: string | null;
    name: string | null;
    maxSocialNetworks: number;
    networksUsed: number;
    accountQuota: { used: number; limit: number; remaining: number };
  };
  clients: Array<{ id: string; name: string }>;
  platforms: PlatformInfo[];
  accounts: AccountRow[];
};

export default function CompanySocialAccountsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Payload | null>(null);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const payload = await apiFetch<Payload>(`/companies/${companyId}/social-accounts`);
    setData(payload);
    setClientId((prev) => prev || payload.clients[0]?.id || "");
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const clientAccounts = useMemo(
    () => (data?.accounts ?? []).filter((a) => a.clientId === clientId),
    [data?.accounts, clientId],
  );

  const selectedClientName = data?.clients.find((c) => c.id === clientId)?.name ?? "Client";
  const quotaLeft = data?.plan.accountQuota.remaining ?? 0;
  const networksLeft = Math.max(
    (data?.plan.maxSocialNetworks ?? 0) - (data?.plan.networksUsed ?? 0),
    0,
  );

  async function connect(platformCode: string) {
    if (!clientId) {
      toast.error("Select a client", "Choose which client this social account belongs to.");
      return;
    }
    setBusy(platformCode);
    setError(null);
    try {
      const res = await apiFetch<{ authorizeUrl: string; mode: string; note?: string }>(
        `/companies/${companyId}/clients/${clientId}/social-accounts/${platformCode}/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            redirectTo: `${window.location.origin}/app/${companyId}/social-accounts`,
          }),
        },
      );
      if (res.mode === "mock") {
        toast.warning("Mock connect", res.note || "SOCIAL_OAUTH_MODE is mock — demo account only.");
      } else {
        toast.info("Opening provider login", "Complete authorization in the popup window.");
      }
      window.location.href = res.authorizeUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connect failed";
      setError(msg);
      toast.error("Connect failed", msg);
      setBusy(null);
    }
  }

  async function disconnect(accountId: string) {
    setBusy(accountId);
    try {
      await apiFetch(`/social-accounts/${accountId}/disconnect`, { method: "POST" });
      toast.success("Disconnected", "Social account removed from this workspace.");
      await load();
    } catch (err) {
      toast.error("Disconnect failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Social accounts" subtitle="Company workspace" nav={companyNav(companyId)} tone="#3DDC97">
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Connected accounts"
          value={data?.plan.accountQuota.used ?? 0}
          hint={`of ${data?.plan.accountQuota.limit ?? "—"} on plan`}
          accent="#3DDC97"
        />
        <StatCard
          label="Networks used"
          value={`${data?.plan.networksUsed ?? 0}/${data?.plan.maxSocialNetworks ?? "—"}`}
          hint={data?.plan.name ?? "Plan"}
          accent="#00D2FF"
        />
        <StatCard label="Quota left" value={quotaLeft} hint="New connections available" accent="#F0C14A" />
        <StatCard
          label="OAuth mode"
          value={(data?.oauthMode ?? "—").toUpperCase()}
          hint={data?.oauthMode === "live" ? "Real provider login" : "Demo / architecture mode"}
          accent="#7B5CFF"
        />
      </div>

      <div className="panel mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-[220px] flex-1">
          <span className="field-label">Client</span>
          <select
            className="field"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {!data?.clients.length ? <option value="">No clients yet</option> : null}
            {(data?.clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-[var(--muted)] sm:max-w-md sm:text-right">
          Showing all networks for <span className="font-semibold text-[var(--text)]">{selectedClientName}</span>.
          Your plan allows <strong className="text-[var(--text)]">{data?.plan.maxSocialNetworks ?? "—"}</strong>{" "}
          networks ({networksLeft} slots left).
        </p>
      </div>

      {data?.oauthMode === "live" && data.platforms.some((p) => !p.hasCredentials) ? (
        <p className="mb-4 rounded-xl border border-[#F0C14A]/35 bg-[#F0C14A]/10 px-4 py-3 text-sm text-[var(--text)]">
          Live OAuth is on. Add each network&apos;s Client ID + Secret in{" "}
          <button
            type="button"
            className="font-semibold text-brand-primary underline"
            onClick={() => router.push("/admin/integrations")}
          >
            Admin → Integrations
          </button>{" "}
          to unlock real connects (no more Demo accounts).
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.platforms ?? []).map((platform) => {
          const accounts = clientAccounts.filter((a) => a.platformCode === platform.code);
          const connected = accounts.length > 0;
          const color = PLATFORM_BRAND_COLOR[platform.code] ?? "#7B5CFF";
          const canConnect = platform.connectable && !!clientId;

          return (
            <article
              key={platform.code}
              className="panel flex flex-col p-5"
              style={{
                background: `linear-gradient(165deg, ${color}18, var(--card) 42%)`,
                borderColor: connected ? color : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/20"
                    style={{ boxShadow: `0 0 0 1px ${color}33` }}
                  >
                    <SocialPlatformIcon code={platform.code} className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[var(--text)]">{platform.name}</h2>
                    <p className="text-xs text-[var(--muted)]">
                      {!platform.enabled
                        ? "Disabled by admin"
                        : platform.mode === "live"
                          ? "Live OAuth"
                          : platform.mode === "mock"
                            ? "Mock / demo"
                            : "Needs OAuth setup"}
                    </p>
                  </div>
                </div>
                <span
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    background: connected ? `${color}22` : "var(--elevated)",
                    color: connected ? color : "var(--muted)",
                  }}
                >
                  {connected ? "Connected" : "Not linked"}
                </span>
              </div>

              <p className="mt-3 text-sm text-[var(--muted)]">
                {platform.capabilities?.notes ||
                  platform.setupHint ||
                  (platform.capabilities?.assistedOnly
                    ? "Assisted publishing when permissions allow"
                    : "Publish text, image, and video when permissions allow")}
              </p>

              <div className="mt-4 space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-3 text-sm"
                  >
                    <p className="font-medium text-[var(--text)]">
                      {account.accountName ?? platform.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand-primary">
                      {(() => {
                        const u =
                          account.username && !/_live_[a-f0-9]+$/i.test(account.username)
                            ? account.username
                            : null;
                        if (!u) return "unknown — reconnect";
                        if (u.includes("@") && u.includes(".")) return u;
                        return u.startsWith("@") ? u : `@${u}`;
                      })()}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Account ID:{" "}
                      <span className="font-mono text-[var(--text)]">
                        {account.externalAccountId &&
                        !/_live_[a-f0-9]+$/i.test(account.externalAccountId)
                          ? account.externalAccountId
                          : "invalid — reconnect required"}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                      {account.connectionMode === "live" ? "Real account" : "Demo account"} ·{" "}
                      {account.status}
                    </p>
                    {account.needsReconnect ? (
                      <p className="mt-2 text-xs text-brand-error">
                        Profile details incomplete. Disconnect, then Connect again so we store the
                        real @{platform.name} username.
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)]"
                        disabled={!!busy || !canConnect}
                        onClick={() => connect(platform.code)}
                      >
                        Reconnect
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-brand-error/30 px-2 py-1 text-xs font-semibold text-brand-error"
                        disabled={!!busy}
                        onClick={() => disconnect(account.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
                {!accounts.length ? (
                  <p className="text-xs text-[var(--muted)]">No {platform.name} account for this client yet.</p>
                ) : null}
              </div>

              <button
                type="button"
                className="btn-primary mt-4 w-full disabled:opacity-50"
                style={{ background: canConnect ? color : undefined }}
                disabled={!!busy || !canConnect}
                onClick={() => connect(platform.code)}
                title={
                  !platform.enabled
                    ? "Enable in Admin → Integrations"
                    : !platform.connectable
                      ? platform.setupHint
                      : undefined
                }
              >
                {busy === platform.code
                  ? "Opening…"
                  : connected
                    ? `Connect another ${platform.name}`
                    : `Connect ${platform.name}`}
              </button>
            </article>
          );
        })}
      </div>

      {!data?.clients.length ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Add a client first, then return here to connect their social networks.
        </p>
      ) : null}
    </AppShell>
  );
}
