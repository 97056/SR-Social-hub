"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type PaymentSettings = {
  provider: string;
  mode: "test" | "live";
  selfServeEnabled: boolean;
  testKeyId: string;
  liveKeyId: string;
  testKeySecret: string | null;
  liveKeySecret: string | null;
  hasTestSecret: boolean;
  hasLiveSecret: boolean;
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [form, setForm] = useState<PaymentSettings | null>(null);
  const [testSecret, setTestSecret] = useState("");
  const [liveSecret, setLiveSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<PaymentSettings>("/admin/payments")
      .then(setForm)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setMessage(null);
    try {
      const saved = await apiFetch<PaymentSettings>("/admin/payments", {
        method: "PATCH",
        body: JSON.stringify({
          mode: form.mode,
          selfServeEnabled: form.selfServeEnabled,
          testKeyId: form.testKeyId,
          liveKeyId: form.liveKeyId,
          ...(testSecret ? { testKeySecret: testSecret } : {}),
          ...(liveSecret ? { liveKeySecret: liveSecret } : {}),
        }),
      });
      setForm(saved);
      setTestSecret("");
      setLiveSecret("");
      setMessage("Payment settings saved. Companies can upgrade when self-serve is on.");
      toast.success("Payments saved", `Mode: ${saved.mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="Payments (Razorpay)" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}

      <p className="mb-6 max-w-2xl text-sm text-content-muted">
        Manage Razorpay test and live keys here. Switch mode when you are ready for production.
        Secrets are encrypted at rest and never shown again after save.
      </p>

      {form ? (
        <form onSubmit={onSubmit} className="panel max-w-2xl space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.selfServeEnabled}
              onChange={(e) => setForm({ ...form, selfServeEnabled: e.target.checked })}
            />
            Enable self-serve upgrades on company Billing pages
          </label>

          <label className="block text-xs text-content-muted">
            Active mode
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value === "live" ? "live" : "test" })
              }
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-content-muted">
              Test key ID
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form.testKeyId}
                onChange={(e) => setForm({ ...form, testKeyId: e.target.value })}
                placeholder="rzp_test_…"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Test key secret {form.hasTestSecret ? "(saved)" : ""}
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={testSecret}
                onChange={(e) => setTestSecret(e.target.value)}
                placeholder={form.hasTestSecret ? "••••••••" : "Enter test secret"}
                autoComplete="new-password"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Live key ID
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form.liveKeyId}
                onChange={(e) => setForm({ ...form, liveKeyId: e.target.value })}
                placeholder="rzp_live_…"
              />
            </label>
            <label className="block text-xs text-content-muted">
              Live key secret {form.hasLiveSecret ? "(saved)" : ""}
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={liveSecret}
                onChange={(e) => setLiveSecret(e.target.value)}
                placeholder={form.hasLiveSecret ? "••••••••" : "Enter live secret"}
                autoComplete="new-password"
              />
            </label>
          </div>

          <button className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-ink-bg">
            Save payment settings
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
