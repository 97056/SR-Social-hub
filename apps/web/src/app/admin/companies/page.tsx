"use client";

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
  plan: { code: string; name: string; monthlyPriceInr: number } | null;
  _count: { clients: number; members: number };
};

type Plan = { code: string; name: string };

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

  return (
    <AppShell title="Companies" subtitle="Super Admin" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={companies.length} />
        <StatCard label="Active" value={companies.filter((c) => c.status === "ACTIVE").length} />
        <StatCard label="Trial" value={companies.filter((c) => c.status === "TRIAL").length} />
      </div>

      <form onSubmit={onCreate} className="panel mb-6 grid gap-3 p-5 md:grid-cols-2">
        <h2 className="font-display text-lg font-semibold md:col-span-2">Create company</h2>
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm"
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          required
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

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-content-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Clients</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-content-muted">{c.slug}</p>
                </td>
                <td className="px-4 py-3">{c.plan?.name ?? "—"}</td>
                <td className="px-4 py-3">{c._count.clients}</td>
                <td className="px-4 py-3">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-xs">{c.status}</span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    className="text-xs text-brand-secondary"
                    onClick={() => setStatus(c.id, "ACTIVE")}
                  >
                    Activate
                  </button>
                  <button
                    className="text-xs text-brand-warning"
                    onClick={() => setStatus(c.id, "SUSPENDED")}
                  >
                    Suspend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
