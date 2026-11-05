"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type MailSettings = {
  provider: "smtp" | "sendgrid" | "none";
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  sendgridApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
};

export default function AdminMailPage() {
  const router = useRouter();
  const [form, setForm] = useState<MailSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<MailSettings>("/admin/mail-settings")
      .then(setForm)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Partial<MailSettings> = { ...form };
      if (payload.smtpPass === "••••••••") delete payload.smtpPass;
      if (payload.sendgridApiKey === "••••••••") delete payload.sendgridApiKey;
      if (payload.twilioAuthToken === "••••••••") delete payload.twilioAuthToken;

      const saved = await apiFetch<MailSettings>("/admin/mail-settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setForm(saved);
      toast.success(
        "Mail settings saved",
        "SMTP is used for activation and forgot-password emails. SendGrid / Twilio stay ready for later.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Mail & SMS" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <p className="mb-6 max-w-2xl text-sm text-content-muted">
        Activation and password-reset emails go through SMTP today. Add SendGrid and Twilio keys when
        you are ready — they are stored here but not used until those providers are wired.
      </p>

      {form ? (
        <form onSubmit={onSubmit} className="space-y-6">
          <section className="panel max-w-2xl space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
              Provider
            </p>
            <label className="block text-xs text-content-muted">
              Active mail provider
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form.provider}
                onChange={(e) =>
                  setForm({ ...form, provider: e.target.value as MailSettings["provider"] })
                }
              >
                <option value="smtp">SMTP (active)</option>
                <option value="sendgrid">SendGrid (placeholder)</option>
                <option value="none">Disabled</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-content-muted">
                From name
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.fromName}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted">
                From email
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="panel max-w-2xl space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              SMTP (verification mail)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-content-muted sm:col-span-2">
                Host
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted">
                Port
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-content-muted">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                />
                Secure (TLS / 465)
              </label>
              <label className="block text-xs text-content-muted">
                Username
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs text-content-muted">
                App password
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  placeholder="Leave masked to keep current"
                  autoComplete="new-password"
                />
              </label>
            </div>
          </section>

          <section className="panel max-w-2xl space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
              SendGrid (later)
            </p>
            <label className="block text-xs text-content-muted">
              API key
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form.sendgridApiKey}
                onChange={(e) => setForm({ ...form, sendgridApiKey: e.target.value })}
                placeholder="SG.…"
                autoComplete="off"
              />
            </label>
          </section>

          <section className="panel max-w-2xl space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
              Twilio SMS (later)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-content-muted sm:col-span-2">
                Account SID
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.twilioAccountSid}
                  onChange={(e) => setForm({ ...form, twilioAccountSid: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs text-content-muted">
                Auth token
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.twilioAuthToken}
                  onChange={(e) => setForm({ ...form, twilioAuthToken: e.target.value })}
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs text-content-muted">
                From number
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.twilioFromNumber}
                  onChange={(e) => setForm({ ...form, twilioFromNumber: e.target.value })}
                  placeholder="+1…"
                />
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-ink-base disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save mail settings"}
          </button>
        </form>
      ) : !error ? (
        <p className="text-sm text-content-muted">Loading…</p>
      ) : null}
    </AppShell>
  );
}
