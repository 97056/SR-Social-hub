"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { SocialPlatformIcon } from "@/components/social-platform-icon";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type SocialRow = {
  id?: string;
  platformCode: string;
  accountName: string | null;
  username: string | null;
  status: string;
  clientId?: string;
};

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessName: string | null;
  brandVoice: string | null;
  timezone: string;
  externalCode: string | null;
  createdAt: string;
  members: Array<{
    user: {
      fullName: string;
      email: string;
      phone: string | null;
      isActive: boolean;
      lastLoginAt: string | null;
    };
  }>;
  socialAccounts: SocialRow[];
  _count: { posts: number; members: number; socialAccounts: number };
};

type Detail = {
  id: string;
  name: string;
  slug: string;
  status: string;
  website: string | null;
  phone: string | null;
  billingEmail: string | null;
  gstNumber: string | null;
  timezone: string;
  trialEndsAt: string | null;
  createdAt: string;
  isTrial: boolean;
  accessLabel: string;
  planLabel: string;
  plan: {
    code: string;
    name: string;
    clientQuota: number;
    accountQuota: number;
    teamQuota: number;
    monthlyPriceInr: number;
  } | null;
  subscription: {
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    interval: string;
  } | null;
  owner: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    accountKind: string;
    isActive: boolean;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    userCode: string | null;
    createdAt: string;
  } | null;
  members: Array<{
    role: string;
    status: string;
    user: { email: string; fullName: string; isActive: boolean };
  }>;
  clients: ClientRow[];
  socialAccounts: SocialRow[];
  recentPosts?: Array<{
    id: string;
    status: string;
    baseCaption: string;
    scheduledAt: string | null;
    updatedAt: string;
    createdAt: string;
    client: { id: string; name: string };
    targets: Array<{
      platformCode: string;
      status: string;
      publishedAt: string | null;
      scheduledAt: string | null;
      externalPostId: string | null;
      lastError: string | null;
    }>;
  }>;
  _count: { clients: number; members: number; socialAccounts: number; posts: number };
};

export default function AdminCompanyDetailPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");

  async function load() {
    const detail = await apiFetch<Detail>(`/admin/companies/${companyId}`);
    setData(detail);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [companyId, router]);

  const ownerReady = Boolean(data?.owner?.isActive && data?.owner?.emailVerifiedAt);

  const filteredClients = useMemo(() => {
    const list = data?.clients ?? [];
    const q = clientQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const contact = c.members.map((m) => `${m.user.fullName} ${m.user.email}`).join(" ");
      const socials = c.socialAccounts
        .map((s) => `${s.platformCode} ${s.accountName ?? ""} ${s.username ?? ""}`)
        .join(" ");
      const hay = [
        c.name,
        c.businessName,
        c.industry,
        c.website,
        c.contactEmail,
        c.contactPhone,
        c.brandVoice,
        c.externalCode,
        contact,
        socials,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.clients, clientQuery]);

  async function activateOwner() {
    setBusy(true);
    try {
      const res = await apiFetch<{ message: string }>(`/admin/companies/${companyId}/activate-owner`, {
        method: "POST",
        body: "{}",
      });
      toast.success("Owner activated", res.message);
      await load();
    } catch (e) {
      toast.error("Failed", e instanceof Error ? e.message : "Could not activate");
    } finally {
      setBusy(false);
    }
  }

  async function resendActivation() {
    if (!data?.owner?.email) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ message: string }>("/auth/resend-activation", {
        method: "POST",
        body: JSON.stringify({ email: data.owner.email }),
      });
      toast.success("Email queued", res.message);
    } catch (e) {
      toast.error("Mail failed", e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={data?.name ?? "Company"} subtitle="Super Admin · Company detail" nav={adminNav()}>
      <div className="mb-4">
        <Link href="/admin/companies" className="text-sm text-brand-primary hover:underline">
          ← Back to companies
        </Link>
      </div>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Access" value={data?.accessLabel ?? "—"} />
        <StatCard label="Clients" value={data?._count.clients ?? 0} />
        <StatCard label="Social connects" value={data?._count.socialAccounts ?? 0} />
        <StatCard label="Team" value={data?._count.members ?? 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Workspace</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-content-muted">Name</dt>
              <dd className="font-medium">{data?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Slug</dt>
              <dd className="font-mono text-xs">{data?.slug ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Status</dt>
              <dd>{data?.status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Plan</dt>
              <dd>{data?.planLabel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Trial ends</dt>
              <dd>
                {data?.trialEndsAt ? new Date(data.trialEndsAt).toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-content-muted">Subscription</dt>
              <dd>{data?.subscription?.status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Billing email</dt>
              <dd>{data?.billingEmail || "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Phone</dt>
              <dd>{data?.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Website</dt>
              <dd className="truncate">{data?.website || "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">GST</dt>
              <dd>{data?.gstNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Timezone</dt>
              <dd>{data?.timezone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-content-muted">Created</dt>
              <dd>{data?.createdAt ? new Date(data.createdAt).toLocaleString() : "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-lg font-semibold">Owner / registrant</h2>
          {data?.owner ? (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-content-muted">Name</dt>
                  <dd className="font-medium">{data.owner.fullName}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Type</dt>
                  <dd>{data.owner.accountKind}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Email</dt>
                  <dd>{data.owner.email}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Phone</dt>
                  <dd>{data.owner.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">User ID</dt>
                  <dd className="font-mono text-xs">{data.owner.userCode || data.owner.id}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Login ready</dt>
                  <dd>{ownerReady ? "Yes" : "No — needs activation"}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">Last login</dt>
                  <dd>
                    {data.owner.lastLoginAt
                      ? new Date(data.owner.lastLoginAt).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
              </dl>
              {!ownerReady ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    disabled={busy}
                    onClick={activateOwner}
                    className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-[#050814] disabled:opacity-50"
                  >
                    Activate owner login
                  </button>
                  <button
                    disabled={busy}
                    onClick={resendActivation}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Resend activation email
                  </button>
                </div>
              ) : (
                <p className="pt-2 text-xs text-brand-success">Owner login is already active.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-content-muted">No owner membership found.</p>
          )}
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Clients</h2>
            <p className="text-xs text-content-muted">
              Showing {filteredClients.length} of {data?.clients?.length ?? 0} · fields from invite form
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
              placeholder="Search clients, contact, social…"
              className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
            <div className="flex rounded-xl border border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setView("table")}
                className={`rounded-lg px-3 py-1.5 ${view === "table" ? "bg-white/10" : "text-content-muted"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("cards")}
                className={`rounded-lg px-3 py-1.5 ${view === "cards" ? "bg-white/10" : "text-content-muted"}`}
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {!filteredClients.length ? (
          <p className="text-sm text-content-muted">
            {data?.clients?.length ? "No clients match this search." : "No clients added yet."}
          </p>
        ) : view === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/10 text-content-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Organization</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Business / web</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Socials</th>
                  <th className="px-3 py-2 font-medium">Posts</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => {
                  const primary = c.members[0]?.user;
                  const connected = c.socialAccounts.filter((s) => s.status !== "DISCONNECTED");
                  return (
                    <tr key={c.id} className="border-b border-white/5 align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-content-muted">
                          {c.industry || "—"} · {c.timezone}
                        </p>
                        {c.externalCode ? (
                          <p className="font-mono text-[11px] text-content-muted">{c.externalCode}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-medium text-white">{primary?.fullName || "—"}</p>
                        <p>{c.contactEmail || primary?.email || "—"}</p>
                        <p className="text-content-muted">
                          {c.contactPhone || primary?.phone || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p>{c.businessName || "—"}</p>
                        <p className="truncate text-content-muted">{c.website || "—"}</p>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 text-xs text-content-muted">
                        <p className="line-clamp-3">{c.brandVoice || "—"}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="mb-1 text-xs font-semibold">{connected.length} connected</p>
                        {connected.length ? (
                          <ul className="space-y-1 text-xs">
                            {connected.map((s) => (
                              <li
                                key={s.id ?? `${c.id}-${s.platformCode}-${s.username}`}
                                className="flex items-center gap-1.5"
                              >
                                <SocialPlatformIcon code={s.platformCode} className="h-3.5 w-3.5" />
                                <span>
                                  {s.platformCode} · {s.accountName || s.username || "—"} · {s.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-content-muted">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold">
                          {c._count.posts} posts
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((c) => {
              const primary = c.members[0]?.user;
              const connected = c.socialAccounts.filter((s) => s.status !== "DISCONNECTED");
              return (
                <article key={c.id} className="rounded-2xl border border-white/10 bg-ink-elevated p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-semibold">{c.name}</h3>
                      <p className="text-xs text-content-muted">{c.industry || "No industry"}</p>
                    </div>
                    <span className="rounded-lg bg-brand-primary/15 px-2 py-1 text-[11px] text-brand-primary">
                      {connected.length} socials
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div>
                      <dt className="text-content-muted">Contact</dt>
                      <dd>
                        {primary?.fullName || "—"} · {c.contactEmail || primary?.email || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Phone</dt>
                      <dd>{c.contactPhone || primary?.phone || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Business / website</dt>
                      <dd>
                        {c.businessName || "—"}
                        {c.website ? ` · ${c.website}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-content-muted">Description</dt>
                      <dd className="line-clamp-4 text-content-muted">{c.brandVoice || "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                      Connected
                    </p>
                    {connected.length ? (
                      <ul className="space-y-1 text-xs">
                        {connected.map((s) => (
                          <li key={s.id ?? `${c.id}-${s.platformCode}-${s.username}`}>
                            {s.platformCode} · {s.accountName || s.username || "—"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-content-muted">No social accounts yet.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">All social connections</h2>
        {data?.socialAccounts?.length ? (
          <ul className="space-y-2 text-sm">
            {data.socialAccounts.map((s) => {
              const clientName = data.clients.find((c) => c.id === s.clientId)?.name;
              return (
                <li
                  key={s.id ?? `${s.clientId}-${s.platformCode}-${s.username ?? s.accountName}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2"
                >
                  <SocialPlatformIcon code={s.platformCode} className="h-5 w-5" />
                  <strong>{s.platformCode}</strong> · {s.accountName || s.username || "—"} · {s.status}
                  {clientName ? (
                    <span className="rounded-md bg-brand-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                      Client: {clientName}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-content-muted">No social accounts connected.</p>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">Posts by client</h2>
            <p className="text-xs text-content-muted">
              Recent activity across all clients ({data?.recentPosts?.length ?? 0} shown)
            </p>
          </div>
        </div>
        {data?.recentPosts?.length ? (
          <div className="space-y-3">
            {data.recentPosts.map((p) => (
              <article key={p.id} className="rounded-xl border border-white/10 bg-ink-elevated p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                      {p.client.name}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{p.baseCaption || "(No caption)"}</p>
                    <p className="mt-2 text-[11px] text-content-muted">
                      Updated {new Date(p.updatedAt).toLocaleString()}
                      {p.scheduledAt ? ` · Scheduled ${new Date(p.scheduledAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold uppercase">
                    {p.status}
                  </span>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                  {p.targets.length ? (
                    p.targets.map((t) => (
                      <div
                        key={`${p.id}-${t.platformCode}-${t.externalPostId ?? t.status}`}
                        className="flex flex-wrap items-center gap-2 text-xs"
                      >
                        <SocialPlatformIcon code={t.platformCode} className="h-4 w-4" />
                        <span className="font-medium">{t.platformCode}</span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 uppercase">{t.status}</span>
                        <span className="text-content-muted">
                          {t.publishedAt
                            ? `Published ${new Date(t.publishedAt).toLocaleString()}`
                            : t.scheduledAt
                              ? `Scheduled ${new Date(t.scheduledAt).toLocaleString()}`
                              : "—"}
                        </span>
                        {t.externalPostId ? (
                          <span className="font-mono text-[10px] text-content-muted">
                            ID {t.externalPostId}
                          </span>
                        ) : null}
                        {t.lastError ? (
                          <span className="w-full text-brand-error">{t.lastError}</span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-content-muted">No network targets</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-content-muted">No posts yet for this company.</p>
        )}
      </section>
    </AppShell>
  );
}
