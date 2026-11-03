"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type Post = {
  id: string;
  status: string;
  baseCaption: string;
  updatedAt: string;
  client: { id: string; name: string };
  targets: Array<{ platformCode: string }>;
};

export default function PostsPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Post[]>(`/companies/${companyId}/posts`)
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  return (
    <AppShell title="Posts" subtitle="Company workspace" nav={companyNav(companyId)}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4">
        <button
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={() => router.push(`/app/${companyId}/create`)}
        >
          Create post
        </button>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Caption</th>
              <th className="px-4 py-3">Targets</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
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
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-xs">{p.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-content-muted">
                  {new Date(p.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!posts.length ? (
              <tr>
                <td className="px-4 py-6 text-content-muted" colSpan={5}>
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
