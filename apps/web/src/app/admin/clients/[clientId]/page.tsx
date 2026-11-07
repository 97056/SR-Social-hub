"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Detail = {
  client: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    businessName: string | null;
    brandVoice: string | null;
    timezone: string;
    logoUrl: string | null;
    approvalWorkflow: string;
    createdAt: string;
    company: { id: string; name: string };
    members: Array<{
      user: { fullName: string; email: string; phone: string | null; lastLoginAt: string | null };
    }>;
    socialAccounts: Array<{
      id: string;
      platformCode: string;
      accountName: string | null;
      username: string | null;
      status: string;
      connectionMode: string;
      createdAt: string;
      updatedAt: string;
      lastSyncedAt: string | null;
      lastError: string | null;
      tokenExpiresAt: string | null;
    }>;
  };
  posts: Array<{
    id: string;
    status: string;
    baseCaption: string;
    baseHashtags: string;
    scheduledAt: string | null;
    createdAt: string;
    updatedAt: string;
    mediaAsset: { id: string; kind: string; originalName: string; createdAt: string } | null;
    campaign: { id: string; name: string } | null;
    targets: Array<{
      platformCode: string;
      status: string;
      scheduledAt: string | null;
      publishedAt: string | null;
      externalPostId: string | null;
      lastError: string | null;
    }>;
    approvals: Array<{
      id: string;
      step: string;
      decision: string;
      comments: string | null;
      revision: number;
      createdAt: string;
      decidedAt: string | null;
      approver: { fullName: string; email: string } | null;
    }>;
  }>;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminClientDetailPage() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const clientId = params.clientId;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<Detail>(`/admin/clients/${clientId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [clientId, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, Detail["posts"]>();
    for (const p of data?.posts ?? []) {
      const published = p.targets.find((t) => t.publishedAt)?.publishedAt;
      const key = dayKey(published || p.scheduledAt || p.updatedAt || p.createdAt);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [data?.posts]);

  const c = data?.client;

  return (
    <AppShell
      title={c?.name ?? "Client detail"}
      subtitle={c ? `${c.company.name} · Super Admin` : "Super Admin"}
      nav={adminNav()}
      tone="#7B5CFF"
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      {c ? (
        <Link
          href={`/admin/companies/${c.company.id}`}
          className="mb-4 inline-block text-sm text-brand-primary"
        >
          ← Back to {c.company.name}
        </Link>
      ) : null}

      {c ? (
        <section className="panel mb-5 p-5">
          <div className="flex flex-wrap items-start gap-4">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-brand-primary/20 text-2xl font-bold">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
              <p className="mt-1 text-sm text-content-muted">
                {c.industry || "—"} · {c.timezone} · {c.approvalWorkflow}
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-xs text-content-muted">Contact</dt>
                  <dd>
                    {c.members[0]?.user.fullName || "—"}
                    <br />
                    {c.contactEmail || c.members[0]?.user.email || "—"}
                    <br />
                    {c.contactPhone || c.members[0]?.user.phone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Business / web</dt>
                  <dd>
                    {c.businessName || "—"}
                    <br />
                    {c.website || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">About</dt>
                  <dd className="line-clamp-4 text-content-muted">{c.brandVoice || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-content-muted">Created</dt>
                  <dd>{fmt(c.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      ) : null}

      <section className="panel mb-5 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Social connections</h2>
        <div className="space-y-2">
          {(c?.socialAccounts ?? []).map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <SocialPlatformIcon code={s.platformCode} className="h-5 w-5" />
              <strong>{s.platformCode}</strong>
              <span>{s.accountName || s.username || "—"}</span>
              {s.username ? <span className="text-brand-primary">@{s.username}</span> : null}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase ${
                  s.status === "CONNECTED"
                    ? "bg-brand-success/15 text-brand-success"
                    : "bg-white/5 text-content-muted"
                }`}
              >
                {s.status}
              </span>
              <span className="text-xs text-content-muted">Connected {fmt(s.createdAt)}</span>
              {s.status !== "CONNECTED" ? (
                <span className="text-xs text-content-muted">Updated / disconnected {fmt(s.updatedAt)}</span>
              ) : s.lastSyncedAt ? (
                <span className="text-xs text-content-muted">Synced {fmt(s.lastSyncedAt)}</span>
              ) : null}
              {s.lastError ? <span className="w-full text-xs text-brand-error">{s.lastError}</span> : null}
            </div>
          ))}
          {!c?.socialAccounts.length ? (
            <p className="text-sm text-content-muted">No social accounts yet.</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-lg font-semibold">Posts by date</h2>
        {grouped.map(([day, rows]) => (
          <div key={day}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">
              {day}
            </h3>
            <div className="space-y-3">
              {rows.map((p) => (
                <article key={p.id} className="panel p-4">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
                    onClick={() => setOpenPost((id) => (id === p.id ? null : p.id))}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium line-clamp-2">{p.baseCaption || "(No caption)"}</p>
                      <p className="mt-1 text-xs text-content-muted">
                        Updated {fmt(p.updatedAt)}
                        {p.scheduledAt ? ` · Scheduled ${fmt(p.scheduledAt)}` : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase">
                      {p.status}
                    </span>
                  </button>

                  {openPost === p.id ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-3 text-sm">
                      {p.baseHashtags ? (
                        <p className="text-xs text-brand-primary">{p.baseHashtags}</p>
                      ) : null}
                      {p.campaign?.name ? (
                        <p className="text-xs text-content-muted">Campaign: {p.campaign.name}</p>
                      ) : null}
                      {p.mediaAsset ? (
                        <p className="text-xs text-content-muted">
                          Media: {p.mediaAsset.kind} · {p.mediaAsset.originalName} · uploaded{" "}
                          {fmt(p.mediaAsset.createdAt)}
                        </p>
                      ) : null}

                      <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                        Networks
                      </p>
                      {p.targets.map((t) => (
                        <div key={`${p.id}-${t.platformCode}`} className="flex flex-wrap items-center gap-2">
                          <SocialPlatformIcon code={t.platformCode} className="h-4 w-4" />
                          <span>{t.platformCode}</span>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase">
                            {t.status}
                          </span>
                          <span className="text-xs text-content-muted">
                            {t.publishedAt
                              ? `Published ${fmt(t.publishedAt)}`
                              : t.scheduledAt
                                ? `Scheduled ${fmt(t.scheduledAt)}`
                                : "—"}
                          </span>
                          {t.lastError ? (
                            <span className="w-full text-xs text-brand-error">{t.lastError}</span>
                          ) : null}
                        </div>
                      ))}

                      <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                        Approvals
                      </p>
                      {p.approvals.length ? (
                        p.approvals.map((a) => (
                          <div key={a.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                            <p>
                              {a.step} · <strong>{a.decision}</strong> · rev {a.revision}
                            </p>
                            <p className="text-content-muted">
                              Requested {fmt(a.createdAt)}
                              {a.decidedAt ? ` · Decided ${fmt(a.decidedAt)}` : ""}
                              {a.approver ? ` · ${a.approver.fullName}` : ""}
                            </p>
                            {a.comments ? (
                              <p className="mt-1 text-brand-warning">Reason / comments: {a.comments}</p>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-content-muted">No approval history.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ))}
        {!data?.posts.length ? (
          <p className="panel p-5 text-sm text-content-muted">No posts for this client yet.</p>
        ) : null}
      </section>
    </AppShell>
  );
}
