"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Integration = {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  config: {
    oauthClientId: string | null;
    clientSecretMasked: string | null;
    hasClientSecret: boolean;
    redirectUri: string | null;
    scopes: string[];
    apiVersion: string | null;
  } | null;
};

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Integration[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { oauthClientId: string; clientSecret: string; redirectUri: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function load() {
    const list = await apiFetch<Integration[]>("/admin/integrations");
    setItems(list);
    const next: typeof drafts = {};
    for (const item of list) {
      next[item.code] = {
        oauthClientId: item.config?.oauthClientId ?? "",
        clientSecret: "",
        redirectUri:
          item.config?.redirectUri ??
          `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.srsocialhub.in"}/api/v1/oauth/callback`,
      };
    }
    setDrafts(next);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [router]);

  async function toggle(code: string, enabled: boolean) {
    await apiFetch(`/admin/integrations/${code}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    await load();
  }

  async function save(code: string) {
    setSaved(null);
    const draft = drafts[code];
    await apiFetch(`/admin/integrations/${code}`, {
      method: "PATCH",
      body: JSON.stringify({
        oauthClientId: draft.oauthClientId || undefined,
        clientSecret: draft.clientSecret || undefined,
        redirectUri: draft.redirectUri || undefined,
      }),
    });
    setSaved(code);
    await load();
  }

  return (
    <AppShell title="Social integrations" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <p className="mb-4 text-sm text-content-muted">
        Secrets are encrypted at rest and masked after save. Enable a network for mock or live OAuth; live
        auto-publish remains Facebook-first until each provider is certified.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="panel space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">{item.name}</h2>
                <p className="text-xs text-content-muted">{item.code}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => toggle(item.code, e.target.checked)}
                />
                Enabled
              </label>
            </div>
            <input
              className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
              placeholder="OAuth client ID"
              value={drafts[item.code]?.oauthClientId ?? ""}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [item.code]: { ...d[item.code], oauthClientId: e.target.value },
                }))
              }
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
              placeholder={
                item.config?.hasClientSecret
                  ? `Secret saved (${item.config.clientSecretMasked}) — enter to replace`
                  : "Client secret"
              }
              type="password"
              value={drafts[item.code]?.clientSecret ?? ""}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [item.code]: { ...d[item.code], clientSecret: e.target.value },
                }))
              }
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
              placeholder="Redirect URI"
              value={drafts[item.code]?.redirectUri ?? ""}
              onChange={(e) =>
                setDrafts((d) => ({
                  ...d,
                  [item.code]: { ...d[item.code], redirectUri: e.target.value },
                }))
              }
            />
            <button
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={() => save(item.code)}
            >
              Save config
            </button>
            {saved === item.code ? (
              <p className="text-xs text-brand-success">Saved — secret masked.</p>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
