"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { toast } from "@/components/toast";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

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
  clients: Array<{
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    businessName: string | null;
    socialAccounts: Array<{
      platformCode: string;
      accountName: string | null;
      username: string | null;
      status: string;
    }>;
    _count: { posts: number; members: number };
  }>;
  socialAccounts: Array<{
    platformCode: string;
    accountName: string | null;
    username: string | null;
    status: string;
    clientId: string;
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
                  <dd>
                    {data.owner.isActive && data.owner.emailVerifiedAt ? "Yes" : "No — needs activation"}
                  </dd>
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
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  disabled={busy || (data.owner.isActive && !!data.owner.emailVerifiedAt)}
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
            </>
          ) : (
            <p className="text-sm text-content-muted">No owner membership found.</p>
          )}
        </section>
      </div>

      <section className="panel mt-4 overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Clients</h2>
        {data?.clients?.length ? (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-content-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Socials</th>
                <th className="px-3 py-2 font-medium">Posts</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((c) => (
                <tr key={c.id} className="border-b border-white/5 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-content-muted">
                      {c.businessName || c.industry || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <p>{c.contactEmail || "—"}</p>
                    <p className="text-content-muted">{c.contactPhone || c.website || ""}</p>
                  </td>
                  <td className="px-3 py-3">
                    {c.socialAccounts.length ? (
                      <ul className="space-y-1 text-xs">
                        {c.socialAccounts.map((s) => (
                          <li key={`${c.id}-${s.platformCode}-${s.username ?? s.accountName}`}>
                            {s.platformCode} · {s.accountName || s.username || "—"} · {s.status}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-content-muted">None</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{c._count.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-content-muted">No clients added yet.</p>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">All social connections</h2>
        {data?.socialAccounts?.length ? (
          <ul className="space-y-2 text-sm">
            {data.socialAccounts.map((s) => (
              <li
                key={`${s.clientId}-${s.platformCode}-${s.username ?? s.accountName}`}
                className="rounded-xl border border-white/10 px-3 py-2"
              >
                <strong>{s.platformCode}</strong> · {s.accountName || s.username || "—"} · {s.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-content-muted">No social accounts connected.</p>
        )}
      </section>
    </AppShell>
  );
}
