"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, EmptyState } from "@/components/shell";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { useClientBrand } from "@/hooks/use-client-brand";
import { apiFetch, getToken } from "@/lib/api";
import { clientNav } from "@/lib/nav";

type PostRow = {
  id: string;
  status: string;
  baseCaption: string;
  baseHashtags?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; name: string } | null;
  mediaAsset?: { id: string; kind: string; originalName: string } | null;
  targets: Array<{
    platformCode: string;
    status: string;
    scheduledAt?: string | null;
    publishedAt?: string | null;
    externalPostId?: string | null;
    lastError?: string | null;
  }>;
};

function dayKey(iso?: string | null) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ClientPostsPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const brand = useClientBrand(clientId);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<PostRow[]>(`/clients/${clientId}/posts`)
      .then(setPosts)
      .catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of posts) {
      const published = p.targets.find((t) => t.publishedAt)?.publishedAt;
      const key = dayKey(published || p.scheduledAt || p.updatedAt || p.createdAt);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [posts]);

  return (
    <AppShell
      title="Posted content"
      subtitle={brand ? `Managed by ${brand.companyName}` : "Client workspace"}
      nav={clientNav(clientId)}
      brandLogoUrl={brand?.logoUrl}
      brandName={brand?.name}
      tone="#C026FF"
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <p className="mb-5 text-sm text-[var(--muted)]">
        Date-wise view of your posts — status, networks, and publish details.
      </p>

      <div className="space-y-8">
        {grouped.map(([day, rows]) => (
          <section key={day}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {day}
            </h2>
            <div className="space-y-3">
              {rows.map((post) => (
                <article key={post.id} className="panel p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                        {post.baseCaption || "(No caption)"}
                      </p>
                      {post.baseHashtags ? (
                        <p className="mt-2 text-xs text-brand-primary">{post.baseHashtags}</p>
                      ) : null}
                      {post.campaign?.name ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">Campaign: {post.campaign.name}</p>
                      ) : null}
                      {post.mediaAsset ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Media: {post.mediaAsset.kind} · {post.mediaAsset.originalName}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                      {post.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Posted on
                    </p>
                    {post.targets.length ? (
                      post.targets.map((t) => (
                        <div
                          key={`${post.id}-${t.platformCode}`}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <SocialPlatformIcon code={t.platformCode} className="h-5 w-5" />
                          <span className="font-medium">{t.platformCode}</span>
                          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">
                            {t.status}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {t.publishedAt
                              ? `Published ${new Date(t.publishedAt).toLocaleString()}`
                              : t.scheduledAt
                                ? `Scheduled ${new Date(t.scheduledAt).toLocaleString()}`
                                : "—"}
                          </span>
                          {t.externalPostId ? (
                            <span className="font-mono text-[10px] text-[var(--muted)]">
                              ID {t.externalPostId}
                            </span>
                          ) : null}
                          {t.lastError ? (
                            <span className="w-full text-xs text-brand-error">{t.lastError}</span>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--muted)]">No network targets yet.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!posts.length ? (
          <EmptyState
            title="No posts yet"
            body="When your agency publishes or schedules content for this brand, it will appear here by date."
          />
        ) : null}
      </div>
    </AppShell>
  );
}
