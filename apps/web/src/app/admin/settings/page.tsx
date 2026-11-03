"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Settings = {
  defaultTimezone: string;
  maintenanceMode: boolean;
  trialDays: number;
  inviteExpiryHours: number;
  featureFlags: Record<string, boolean>;
};

export default function AdminSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<Settings>("/admin/settings")
      .then(setForm)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const saved = await apiFetch<Settings>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm(saved);
      setMessage("System settings updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="System settings" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}
      {form ? (
        <form onSubmit={onSubmit} className="panel max-w-xl space-y-4 p-5">
          <label className="block text-xs text-content-muted">
            Default timezone
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.defaultTimezone}
              onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Trial days
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.trialDays}
              onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })}
            />
          </label>
          <label className="block text-xs text-content-muted">
            Invite expiry (hours)
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.inviteExpiryHours}
              onChange={(e) => setForm({ ...form, inviteExpiryHours: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })}
            />
            Maintenance mode
          </label>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-content-muted">Feature flags</p>
            {Object.entries(form.featureFlags).map(([key, enabled]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      featureFlags: { ...form.featureFlags, [key]: e.target.checked },
                    })
                  }
                />
                {key}
              </label>
            ))}
          </div>
          <button className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white">
            Save settings
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
