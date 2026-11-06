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

export default function PostsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientFilter, setClientFilter] = useState("ALL");
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

  const visible = useMemo(
    () => (clientFilter === "ALL" ? posts : posts.filter((p) => p.client.id === clientFilter)),
    [posts, clientFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of visible) {
      const key = p.client.name;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

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
        <button
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.push(`/app/${companyId}/create`)}
        >
          Create post
        </button>
        <button
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.push(`/app/${companyId}/publishing`)}
        >
          Publishing queue
        </button>
        <label className="ml-auto block text-xs text-content-muted">
          Filter by client
          <select
            className="mt-1 block min-w-[200px] rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-white"
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
      </div>

      <div className="space-y-8">
        {grouped.map(([clientName, rows]) => (
          <section key={clientName}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-[var(--text)]">{clientName}</h2>
              <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-content-muted">
                {rows.length} post{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-3">
              {rows.map((p) => (
                <article key={p.id} className="panel p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm leading-6">{p.baseCaption || "—"}</p>
                      {p.baseHashtags ? (
                        <p className="mt-1 text-xs text-brand-primary">{p.baseHashtags}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-content-muted">
                        Scheduled {formatWhen(p.scheduledAt)} · Updated {formatWhen(p.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                        {p.status}
                      </span>
                      {["APPROVED", "FAILED", "SCHEDULED"].includes(p.status) ? (
                        <button
                          className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-[#050814] disabled:opacity-50"
                          disabled={busy === p.id}
                          onClick={() => publishNow(p.id)}
                        >
                          {busy === p.id ? "Queuing…" : "Publish now"}
                        </button>
                      ) : p.status === "PUBLISHING" || p.status === "PUBLISHED" ? (
                        <button
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs"
                          onClick={() => router.push(`/app/${companyId}/publishing`)}
                        >
                          View queue
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-muted">
                      Networks
                    </p>
                    {p.targets.length ? (
                      p.targets.map((t) => (
                        <div
                          key={`${p.id}-${t.platformCode}-${t.externalPostId ?? t.status}`}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <SocialPlatformIcon code={t.platformCode} className="h-5 w-5" />
                          <span className="font-medium">{t.platformCode}</span>
                          {t.status ? (
                            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">
                              {t.status}
                            </span>
                          ) : null}
                          <span className="text-xs text-content-muted">
                            {t.publishedAt
                              ? `Published ${formatWhen(t.publishedAt)}`
                              : t.scheduledAt
                                ? `Scheduled ${formatWhen(t.scheduledAt)}`
                                : "—"}
                          </span>
                          {t.externalPostId ? (
                            <span className="font-mono text-[10px] text-content-muted">
                              ID {t.externalPostId}
                            </span>
                          ) : null}
                          {t.lastError ? (
                            <span className="w-full text-xs text-brand-error">{t.lastError}</span>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-content-muted">No targets</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!visible.length ? (
          <div className="panel p-6 text-sm text-content-muted">No posts yet for this filter.</div>
        ) : null}
      </div>
    </AppShell>
  );
}
