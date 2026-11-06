"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SocialPlatformIcon, PLATFORM_BRAND_COLOR } from "@/components/social-platform-icon";
import { useClientBrand } from "@/hooks/use-client-brand";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type PlatformCard = {
  platform: {
    code: string;
    name: string;
    enabled: boolean;
    mode: string;
    connectable: boolean;
    capabilities: {
      publishText: boolean;
      publishImage: boolean;
      publishVideo: boolean;
      assistedOnly: boolean;
      notes?: string;
    };
  };
  accounts: Array<{
    id: string;
    accountName: string | null;
    username: string | null;
    status: string;
    connectionMode: string;
    tokenExpiresAt: string | null;
    lastSyncedAt: string | null;
  }>;
};

function SocialAccountsInner() {
  const params = useParams<{ clientId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const clientId = params.clientId;
  const brand = useClientBrand(clientId);
  const [items, setItems] = useState<PlatformCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const list = await apiFetch<PlatformCard[]>(`/clients/${clientId}/social-accounts`);
    setItems(list);
  }

  async function connect(platform: string) {
    setBusy(platform);
    setError(null);
    try {
      const res = await apiFetch<{ authorizeUrl: string; note: string }>(
        `/clients/${clientId}/social-accounts/${platform}/connect`,
        {
          method: "POST",
          body: JSON.stringify({
            redirectTo: `${window.location.origin}/client/${clientId}/social-accounts`,
          }),
        },
      );
      setNotice(res.note);
      window.location.href = res.authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const connected = search.get("connected");
    const mode = search.get("mode");
    const oauthError = search.get("oauth_error");
    if (oauthError) {
      setError(oauthError);
    } else if (connected) {
      setNotice(
        mode === "mock"
          ? `${connected} connected (test connection).`
          : `${connected} connected via OAuth.`,
      );
    }
    (async () => {
      try {
        const list = await apiFetch<PlatformCard[]>(`/clients/${clientId}/social-accounts`);
        setItems(list);
        const auto = search.get("connect")?.toUpperCase();
        if (auto && !search.get("connected") && !oauthError) {
          await connect(auto);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [clientId, router, search]);

  async function disconnect(accountId: string) {
    setBusy(accountId);
    try {
      await apiFetch(`/social-accounts/${accountId}/disconnect`, { method: "POST" });
      await load();
      setNotice("Account disconnected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="Social accounts"
      subtitle={brand ? `Managed by ${brand.companyName}` : "Client workspace"}
      nav={clientNav(clientId)}
      brandLogoUrl={brand?.logoUrl}
      brandName={brand?.name}
      tone="#3DDC97"
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {notice ? (
        <p className="mb-4 rounded-xl border border-brand-secondary/30 bg-brand-secondary/10 p-3 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ platform, accounts }) => {
          const color = PLATFORM_BRAND_COLOR[platform.code] ?? "#7B5CFF";
          return (
            <div
              key={platform.code}
              className="panel flex flex-col p-5"
              style={{
                background: `linear-gradient(165deg, ${color}18, var(--card) 42%)`,
                borderColor: accounts.length ? color : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/20"
                    style={{ boxShadow: `0 0 0 1px ${color}33` }}
                  >
                    <SocialPlatformIcon code={platform.code} className="h-7 w-7" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{platform.name}</h2>
                    <p className="mt-1 text-xs text-content-muted">
                      {platform.enabled ? `Mode: ${platform.mode}` : "Disabled by admin"}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-lg px-2 py-1 text-[11px] ${
                    accounts.length
                      ? "bg-brand-success/15 text-brand-success"
                      : "bg-white/5 text-content-muted"
                  }`}
                >
                  {accounts.length ? "Connected" : "Disconnected"}
                </span>
              </div>

              <p className="mt-3 text-sm text-content-muted">
                {platform.capabilities.notes ??
                  (platform.capabilities.assistedOnly
                    ? "Assisted publishing only"
                    : "Automatic publishing supported when permissions allow")}
              </p>

              <div className="mt-4 flex-1 space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-xl border border-white/10 bg-ink-elevated p-3 text-sm"
                  >
                    <p className="font-medium">{account.accountName ?? platform.name}</p>
                    <p className="text-content-muted">@{account.username ?? "—"}</p>
                    <p className="mt-1 text-xs text-content-muted">
                      {account.connectionMode} · expires{" "}
                      {account.tokenExpiresAt
                        ? new Date(account.tokenExpiresAt).toLocaleDateString()
                        : "n/a"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs"
                        disabled={!!busy}
                        onClick={() => connect(platform.code)}
                      >
                        Reauthorize
                      </button>
                      <button
                        className="rounded-lg border border-brand-error/40 px-2 py-1 text-xs text-brand-error"
                        disabled={busy === account.id}
                        onClick={() => disconnect(account.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="mt-4 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!platform.connectable || !!busy}
                onClick={() => connect(platform.code)}
              >
                {busy === platform.code ? "Connecting…" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

export default function ClientSocialAccountsPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading…</main>}>
      <SocialAccountsInner />
    </Suspense>
  );
}
