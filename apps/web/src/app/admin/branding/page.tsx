"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";
import { DEFAULT_KEYWORD_POOL } from "@/lib/seo";

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
  seoTitle: string;
  seoDescription: string;
  seoAuthor: string;
  seoPublisher: string;
  seoKeywordPool: string;
};

const ASSET_HINTS = [
  { path: "/brand/logo.png", label: "Primary logo (neon) — landing hero & nav" },
  { path: "/brand/logo-mark.png", label: "Profile / square mark — recommended 512×512 PNG" },
  { path: "/brand/favicon.png", label: "Favicon — browser tab icon" },
];

function applyThemeNow(theme: "dark" | "light") {
  // CMS default becomes the project default; clear personal override so it applies everywhere.
  localStorage.removeItem("sr_theme_user");
  localStorage.setItem("sr_theme", theme);
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

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
    apiFetch<Partial<Branding>>("/admin/branding")
      .then((data) =>
        setForm({
          platformName: data.platformName ?? "SR Social Hub",
          primaryColor: data.primaryColor ?? "#00D2FF",
          secondaryColor: data.secondaryColor ?? "#C026FF",
          logoUrl: data.logoUrl ?? "/brand/logo.png",
          faviconUrl: data.faviconUrl ?? "/brand/favicon.png",
          loginHeadline: data.loginHeadline ?? "",
          loginSubcopy: data.loginSubcopy ?? "",
          supportEmail: data.supportEmail ?? "support@srsocialhub.in",
          themeDefault: data.themeDefault === "light" ? "light" : "dark",
          seoTitle: data.seoTitle ?? "SR Social Hub — Agency Social Media Command Center",
          seoDescription:
            data.seoDescription ??
            "All-in-one social media management for agencies — create, approve, and publish across Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads.",
          seoAuthor: data.seoAuthor ?? "SR Social Hub",
          seoPublisher: data.seoPublisher ?? "SR Social Hub",
          seoKeywordPool: data.seoKeywordPool ?? DEFAULT_KEYWORD_POOL.join(", "),
        }),
      )
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
      setForm({
        ...form,
        ...saved,
        themeDefault: saved.themeDefault === "light" ? "light" : "dark",
      });
      const theme = saved.themeDefault === "light" ? "light" : "dark";
      applyThemeNow(theme);
      setMessage(
        `Branding saved. Default theme (${theme}) applied across the app for this browser. SEO meta + daily keyword rotation are live.`,
      );
      toast.success("Branding saved", `Theme set to ${theme}`);
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
          <div className="space-y-5">
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
              <label className="block text-xs text-content-muted md:col-span-2">
                Default theme (applies project-wide for users without a personal toggle)
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.themeDefault}
                  onChange={(e) => setForm({ ...form, themeDefault: e.target.value })}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>
            </div>

            <div className="panel grid gap-3 p-5 md:grid-cols-2">
              <p className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
                SEO (sitewide)
              </p>
              <label className="block text-xs text-content-muted md:col-span-2">
                Page title (50–60 chars ideal)
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.seoTitle}
                  onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted md:col-span-2">
                Meta description
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.seoDescription}
                  onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted">
                Author
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.seoAuthor}
                  onChange={(e) => setForm({ ...form, seoAuthor: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted">
                Publisher
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.seoPublisher}
                  onChange={(e) => setForm({ ...form, seoPublisher: e.target.value })}
                />
              </label>
              <label className="block text-xs text-content-muted md:col-span-2">
                Keyword pool (comma-separated — a fresh subset rotates every day)
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
                  value={form.seoKeywordPool}
                  onChange={(e) => setForm({ ...form, seoKeywordPool: e.target.value })}
                />
              </label>
            </div>

            <button className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-ink-bg">
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
                title="Logo preview"
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
                title="Favicon preview"
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
