"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Post = {
  id: string;
  status: string;
  baseCaption: string;
  baseHashtags?: string | null;
  scheduledAt?: string | null;
  updatedAt: string;
  createdAt?: string;
  client: { id: string; name: string };
  targets: Array<{
    platformCode: string;
    status?: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    externalPostId?: string | null;
    lastError?: string | null;
  }>;
};

function formatWhen(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function inRange(iso: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (t > end.getTime()) return false;
  }
  return true;
}

export default function PostsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientFilter, setClientFilter] = useState("ALL");
  const [view, setView] = useState<"list" | "grid">("list");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setPosts(await apiFetch<Post[]>(`/companies/${companyId}/posts`));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) map.set(p.client.id, p.client.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [posts]);

  const visible = useMemo(() => {
    return posts.filter((p) => {
      if (clientFilter !== "ALL" && p.client.id !== clientFilter) return false;
      const published = p.targets.find((t) => t.publishedAt)?.publishedAt;
      const anchor = published || p.scheduledAt || p.updatedAt || p.createdAt;
      return inRange(anchor, from, to);
    });
  }, [posts, clientFilter, from, to]);

  async function publishNow(postId: string) {
    setBusy(postId);
    setError(null);
    try {
      await apiFetch(`/posts/${postId}/publish`, { method: "POST", body: "{}" });
      toast.success("Publishing", "Post queued to connected networks");
      await load();
      router.push(`/app/${companyId}/publishing`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      setError(message);
      toast.error("Publish failed", message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Posts" subtitle="Client-wise publishing history" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <button className="btn-primary" onClick={() => router.push(`/app/${companyId}/create`)}>
          Create post
        </button>
        <button className="btn-ghost" onClick={() => router.push(`/app/${companyId}/publishing`)}>
          Publishing queue
        </button>
        <label className="text-xs text-content-muted">
          Client
          <select
            className="mt-1 block min-w-[160px] rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="ALL">All clients</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-content-muted">
          From
          <input
            type="date"
            className="mt-1 block rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-content-muted">
          To
          <input
            type="date"
            className="mt-1 block rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div className="ml-auto flex rounded-xl border border-white/10 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${view === "list" ? "bg-white/10" : "text-content-muted"}`}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 ${view === "grid" ? "bg-white/10" : "text-content-muted"}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
        </div>
      </div>

      <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
        {visible.map((p) => {
          const open = openId === p.id;
          return (
            <article key={p.id} className="panel p-4">
              <button
                type="button"
                className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                onClick={() => setOpenId(open ? null : p.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                    {p.client.name}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm font-medium">{p.baseCaption || "—"}</p>
                  <p className="mt-2 text-xs text-content-muted">
                    Updated {formatWhen(p.updatedAt)}
                    {p.scheduledAt ? ` · Scheduled ${formatWhen(p.scheduledAt)}` : ""}
                  </p>
                </div>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase">
                  {p.status}
                </span>
              </button>

              {open ? (
                <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3 text-sm">
                  {p.baseHashtags ? (
                    <p className="text-xs text-brand-primary">{p.baseHashtags}</p>
                  ) : null}
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                    Networks & status
                  </p>
                  {p.targets.length ? (
                    p.targets.map((t) => (
                      <div
                        key={`${p.id}-${t.platformCode}-${t.externalPostId ?? t.status}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <SocialPlatformIcon code={t.platformCode} className="h-5 w-5" />
                        <span className="font-medium">{t.platformCode}</span>
                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">
                          {t.status ?? "—"}
                        </span>
                        <span className="text-xs text-content-muted">
                          {t.publishedAt
                            ? `Published ${formatWhen(t.publishedAt)}`
                            : t.scheduledAt
                              ? `Scheduled ${formatWhen(t.scheduledAt)}`
                              : "—"}
                        </span>
                        {t.lastError ? (
                          <span className="w-full text-xs text-brand-error">{t.lastError}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-content-muted">No targets</p>
                  )}
                  <p className="text-xs text-content-muted">
                    Approval / workflow status: <strong className="text-[var(--text)]">{p.status}</strong>
                  </p>
                  {["APPROVED", "FAILED", "SCHEDULED"].includes(p.status) ? (
                    <button
                      className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-[#050814] disabled:opacity-50"
                      disabled={busy === p.id}
                      onClick={() => publishNow(p.id)}
                    >
                      {busy === p.id ? "Queuing…" : "Publish now"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.targets.slice(0, 6).map((t) => (
                    <SocialPlatformIcon
                      key={`${p.id}-${t.platformCode}`}
                      code={t.platformCode}
                      className="h-4 w-4"
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {!visible.length ? (
          <div className="panel p-6 text-sm text-content-muted sm:col-span-full">
            No posts for this filter / date range.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
