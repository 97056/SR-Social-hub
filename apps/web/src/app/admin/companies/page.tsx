"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  trialEndsAt: string | null;
  plan: { code: string; name: string; monthlyPriceInr: number; clientQuota?: number } | null;
  subscriptions?: Array<{ status: string; trialEndsAt: string | null }>;
  members?: Array<{
    user: {
      email: string;
      fullName: string;
      accountKind: string;
      isActive: boolean;
      emailVerifiedAt: string | null;
    };
  }>;
  _count: { clients: number; members: number; socialAccounts?: number };
};

type Plan = { code: string; name: string };

function isTrialCompany(c: Company) {
  return c.status === "TRIAL" || c.subscriptions?.[0]?.status === "TRIALING";
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    planCode: "STARTER",
    ownerEmail: "",
    ownerPassword: "ChangeMeAgency!123",
    ownerName: "",
  });

  async function load() {
    const [c, p] = await Promise.all([
      apiFetch<Company[]>("/admin/companies"),
      apiFetch<Plan[]>("/admin/plans"),
    ]);
    setCompanies(c);
    setPlans(p);
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    load().catch((e: Error) => setError(e.message));
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/companies", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm((f) => ({ ...f, name: "", slug: "", ownerEmail: "", ownerName: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function setStatus(id: string, status: string) {
    await apiFetch(`/admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function setPlan(id: string, planCode: string) {
    await apiFetch(`/admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ planCode }),
    });
    await load();
  }

  const trialCount = companies.filter(isTrialCompany).length;

  return (
    <AppShell title="Companies" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={companies.length} />
        <StatCard
          label="Paid / active"
          value={companies.filter((c) => c.status === "ACTIVE" && !isTrialCompany(c)).length}
        />
        <StatCard label="Free trial" value={trialCount} />
      </div>

      <form onSubmit={onCreate} className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
        <h2 className="font-display text-lg font-semibold md:col-span-2">Create company</h2>
        <p className="text-xs text-content-muted md:col-span-2">
          New signups always start on a <strong className="text-white">7-day free trial</strong> with
          Starter catalog limits. Use the plan dropdown only when converting a workspace to paid.
        </p>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <select
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          value={form.planCode}
          onChange={(e) => setForm({ ...form, planCode: e.target.value })}
        >
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Owner email"
          type="email"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Owner name"
          value={form.ownerName}
          onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Owner password"
          type="password"
          value={form.ownerPassword}
          onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
        />
        <button className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white md:col-span-2">
          Create company
        </button>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Plan catalog</th>
              <th className="px-4 py-3 font-medium">Clients / socials</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const trial = isTrialCompany(c);
              const owner = c.members?.[0]?.user;
              return (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="font-medium text-brand-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-content-muted">{c.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {owner ? (
                      <>
                        <p>{owner.fullName}</p>
                        <p className="text-content-muted">{owner.email}</p>
                        <p className="text-content-muted">
                          {owner.accountKind}
                          {owner.isActive && owner.emailVerifiedAt ? "" : " · not activated"}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{
                        background: trial ? "rgba(240,193,74,0.15)" : "rgba(61,220,151,0.12)",
                        color: trial ? "#F0C14A" : "#3DDC97",
                      }}
                    >
                      {trial ? "Free trial" : c.status}
                    </span>
                    {trial && c.trialEndsAt ? (
                      <p className="mt-1 text-[11px] text-content-muted">
                        Ends {new Date(c.trialEndsAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="field max-w-[180px] py-1.5"
                      value={c.plan?.code ?? ""}
                      onChange={(e) => setPlan(c.id, e.target.value)}
                    >
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {trial ? (
                      <p className="mt-1 text-[11px] text-content-muted">Catalog only until paid</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {c._count.clients} / {c._count.socialAccounts ?? 0}
                  </td>
                  <td className="space-x-2 px-4 py-3">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="text-xs text-brand-primary hover:underline"
                    >
                      Details
                    </Link>
                    <button
                      className="text-xs text-brand-secondary"
                      onClick={() => setStatus(c.id, "ACTIVE")}
                      title="Mark as paid/active (ends trial mode)"
                    >
                      Mark paid
                    </button>
                    <button
                      className="text-xs text-brand-warning"
                      onClick={() => setStatus(c.id, "SUSPENDED")}
                    >
                      Suspend
                    </button>
                    {c.status !== "TRIAL" ? (
                      <button
                        className="text-xs text-[#F0C14A]"
                        onClick={() => setStatus(c.id, "TRIAL")}
                      >
                        Back to trial
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
