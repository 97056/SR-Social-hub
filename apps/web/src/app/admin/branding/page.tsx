"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Branding = {
  platformName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  loginHeadline: string;
  loginSubcopy: string;
  supportEmail: string;
  themeDefault: string;
};

export default function AdminBrandingPage() {
  const router = useRouter();
  const [form, setForm] = useState<Branding | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<Branding>("/admin/branding")
      .then(setForm)
      .catch((e: Error) => setError(e.message));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);
    try {
      const saved = await apiFetch<Branding>("/admin/branding", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm(saved);
      setMessage("Branding saved. Public /api/v1/branding now serves these values.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="CMS and branding" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}
      {form ? (
        <form onSubmit={onSubmit} className="panel grid max-w-3xl gap-3 p-5 md:grid-cols-2">
          {(
            [
              ["platformName", "Platform name"],
              ["primaryColor", "Primary color"],
              ["secondaryColor", "Secondary color"],
              ["logoUrl", "Logo URL"],
              ["faviconUrl", "Favicon URL"],
              ["supportEmail", "Support email"],
              ["loginHeadline", "Login headline"],
              ["loginSubcopy", "Login subcopy"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={`block text-xs text-content-muted ${key.includes("login") || key.includes("Sub") ? "md:col-span-2" : ""}`}>
              {label}
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="block text-xs text-content-muted">
            Default theme
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
              value={form.themeDefault}
              onChange={(e) => setForm({ ...form, themeDefault: e.target.value })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <button className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white md:col-span-2">
            Save branding
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
