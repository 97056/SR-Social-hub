"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Post = {
  id: string;
  status: string;
  baseCaption: string;
  scheduledAt?: string | null;
  updatedAt: string;
  client: { id: string; name: string };
  targets: Array<{ platformCode: string; scheduledAt?: string | null }>;
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
    <AppShell title="Posts" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Caption</th>
              <th className="px-4 py-3">Targets</th>
              <th className="px-4 py-3">Scheduled</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="px-4 py-3">{p.client.name}</td>
                <td className="max-w-xs truncate px-4 py-3">{p.baseCaption || "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {p.targets.map((t) => t.platformCode).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-content-muted">
                  {formatWhen(p.scheduledAt)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-xs">{p.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-content-muted">
                  {formatWhen(p.updatedAt)}
                </td>
                <td className="px-4 py-3">
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
                  ) : (
                    <span className="text-xs text-content-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!posts.length ? (
              <tr>
                <td className="px-4 py-6 text-content-muted" colSpan={7}>
                  No posts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
