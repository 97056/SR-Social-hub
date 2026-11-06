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

const ASSET_HINTS = [
  { path: "/brand/logo.png", label: "Primary logo (neon) — landing hero & nav" },
  { path: "/brand/logo-mark.png", label: "Profile / square mark — recommended 512×512 PNG" },
  { path: "/brand/favicon.png", label: "Favicon — browser tab icon" },
];

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
    setError(null);
    try {
      const saved = await apiFetch<Branding>("/admin/branding", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm(saved);
      setMessage("Branding saved. Landing page + public /api/v1/branding now use these values.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="CMS and branding" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-brand-success">{message}</p> : null}

      <div className="mb-6 panel p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
          Bundled brand assets
        </p>
        <p className="mt-2 text-sm text-content-muted">
          Replace files under <code className="text-brand-primary">apps/web/public/brand/</code> or
          point Logo URL / Favicon URL to any public path or CDN. Landing, favicon, and legal shells
          read these fields from branding.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-content-muted">
          {ASSET_HINTS.map((a) => (
            <li key={a.path}>
              <button
                type="button"
                className="text-left text-brand-primary hover:underline"
                onClick={() =>
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          ...(a.path.includes("favicon")
                            ? { faviconUrl: a.path }
                            : { logoUrl: a.path }),
                        }
                      : prev,
                  )
                }
              >
                {a.path}
              </button>
              <span className="ml-2">— {a.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {form ? (
        <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="panel grid gap-3 p-5 md:grid-cols-2">
            {(
              [
                ["platformName", "Platform name"],
                ["primaryColor", "Primary color"],
                ["secondaryColor", "Secondary color"],
                ["logoUrl", "Logo URL"],
                ["faviconUrl", "Favicon URL"],
                ["supportEmail", "Support email"],
                ["loginHeadline", "Login / landing headline"],
                ["loginSubcopy", "Login / landing subcopy"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`block text-xs text-content-muted ${
                  key.includes("login") || key.includes("Sub") ? "md:col-span-2" : ""
                }`}
              >
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
            <button className="rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-ink-bg md:col-span-2">
              Save branding
            </button>
          </div>

          <aside className="panel space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
              Live preview
            </p>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-ink-bg p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl || "/brand/logo.png"}
                alt="Logo preview"
                className="h-28 w-28 rounded-full object-cover"
              />
              <p className="text-center text-sm font-semibold text-white">{form.platformName}</p>
              <p className="text-center text-xs text-content-muted">{form.loginHeadline}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink-bg px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.faviconUrl || "/brand/favicon.png"}
                alt="Favicon preview"
                className="h-8 w-8 rounded object-cover"
              />
              <div>
                <p className="text-xs text-content-muted">Favicon</p>
                <p className="truncate text-xs text-white">{form.faviconUrl || "/brand/favicon.png"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span
                className="h-8 flex-1 rounded-lg"
                style={{ background: form.primaryColor }}
                title="Primary"
              />
              <span
                className="h-8 flex-1 rounded-lg"
                style={{ background: form.secondaryColor }}
                title="Secondary"
              />
            </div>
          </aside>
        </form>
      ) : null}
    </AppShell>
  );
}
