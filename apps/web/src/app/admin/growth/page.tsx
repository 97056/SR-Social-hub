"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { GrowthCard, MetricGrid } from "@/components/growth/growth-ui";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Settings = {
  enabled: boolean;
  provider: string;
  model: string;
  dailyLimit: number;
  monthlyLimit: number;
  maxTokens: number;
  alertEmail: string;
};

export default function AdminGrowthPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<{
    growthUnitsLast30d?: number;
    jobs?: Record<string, number>;
    settings?: Settings;
  } | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    Promise.all([
      apiFetch<{
        growthUnitsLast30d?: number;
        jobs?: Record<string, number>;
        settings?: Settings;
      }>("/admin/growth/overview"),
      apiFetch<Settings>("/admin/growth/settings"),
    ])
      .then(([o, s]) => {
        setOverview(o);
        setForm(s);
      })
      .catch((e: Error) => toast.error("Load failed", e.message));
  }, [router]);

  async function setEnabled(enabled: boolean) {
    if (!form) return;
    setSavingToggle(true);
    try {
      const saved = await apiFetch<Settings>("/admin/growth/settings", {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setForm(saved);
      toast.success(enabled ? "AI Growth Center is ON" : "AI Growth Center is OFF", enabled
        ? "Visible for companies and clients."
        : "Hidden from company and client sidebars.");
    } catch (err) {
      toast.error("Toggle failed", err instanceof Error ? err.message : "Error");
    } finally {
      setSavingToggle(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    try {
      const saved = await apiFetch<Settings>("/admin/growth/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm(saved);
      toast.success("Growth AI settings saved");
    } catch (err) {
      toast.error("Save failed", err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell title="AI Growth Center" subtitle="Super Admin · visibility, providers, budgets" nav={adminNav()}>
      <div className="mb-4 panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold">AI Growth Center visibility</h2>
            <p className="mt-1 text-sm text-content-muted">
              Turn this off to hide Growth menus for companies and clients. This admin page stays available so you can turn it back on.
              You can also use System Settings → feature flag <code className="text-white/80">aiGrowthCenter</code>.
            </p>
          </div>
          <button
            type="button"
            disabled={!form || savingToggle}
            onClick={() => setEnabled(!(form?.enabled ?? false))}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
              form?.enabled
                ? "bg-brand-primary text-white"
                : "border border-white/20 bg-ink-elevated text-white"
            }`}
          >
            {form?.enabled ? "ON — click to turn OFF" : "OFF — click to turn ON"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthCard title="System overview">
          {overview ? (
            <div className="space-y-4">
              <MetricGrid
                items={[
                  { label: "Growth units (30d)", value: overview.growthUnitsLast30d ?? 0 },
                  { label: "Jobs pending", value: overview.jobs?.PENDING ?? 0 },
                  { label: "Jobs completed", value: overview.jobs?.COMPLETED ?? 0 },
                  { label: "Jobs failed", value: overview.jobs?.FAILED ?? 0 },
                  { label: "Provider", value: overview.settings?.provider || form?.provider || "—" },
                  { label: "Monthly limit", value: overview.settings?.monthlyLimit || form?.monthlyLimit || "—" },
                ]}
              />
            </div>
          ) : null}
        </GrowthCard>
        <GrowthCard title="Provider & limits">
          {form ? (
            <form onSubmit={onSave} className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                Show AI Growth Center to companies & clients
              </label>
              {(
                [
                  ["provider", "Provider"],
                  ["model", "Model"],
                  ["alertEmail", "Alert email"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-content-muted">
                  {label}
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                    value={String(form[key])}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              {(
                [
                  ["dailyLimit", "Daily analysis limit"],
                  ["monthlyLimit", "Monthly usage limit"],
                  ["maxTokens", "Max tokens"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-content-muted">
                  {label}
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                    value={Number(form[key])}
                    onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <p className="text-xs text-content-muted">
                Store real provider API keys in server env / encrypted settings — never in the browser.
              </p>
              <button className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white">Save settings</button>
            </form>
          ) : null}
        </GrowthCard>
      </div>
    </AppShell>
  );
}
