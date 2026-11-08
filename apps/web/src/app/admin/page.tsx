"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getToken } from "@/lib/api";
import { adminNav } from "@/lib/nav";

type Overview = {
  metrics: {
    registeredCompanies: number;
    activeCompanies: number;
    trialAccounts: number;
    activeClientWorkspaces: number;
    enabledIntegrations: number;
    monthlyRecurringRevenue: number;
    totalPostsCreated: number;
    revenueAllTimeInr: number;
    revenueTodayInr: number;
    revenueThisWeekInr: number;
    revenueThisMonthInr: number;
    successfulPayments: number;
    visitorsOverall: number;
    visitorsToday: number;
    visitorsThisWeek: number;
    visitorsThisMonth: number;
    visitorsAverageDaily: number;
    landingPageViews: number;
  };
  charts: {
    revenueDaily: Array<{ date: string; revenueInr: number }>;
    visitorsDaily: Array<{ date: string; visitors: number; landing: number }>;
    revenueByPlan: Array<{ name: string; amountInr: number }>;
    companiesByStatus: Array<{ status: string; count: number }>;
    topPaths: Array<{ path: string; views: number }>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { email: string; fullName: string } | null;
  }>;
};

const PIE_COLORS = ["#00D2FF", "#7B5CFF", "#3DDC97", "#F0C14A", "#FF6B6B", "#C026FF", "#38BDF8"];

function inr(n: number | undefined) {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    apiFetch<Overview>("/admin/overview")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [router]);

  const revenueLine = useMemo(
    () =>
      (data?.charts.revenueDaily ?? []).map((row) => ({
        ...row,
        label: shortDate(row.date),
      })),
    [data],
  );

  const visitorsLine = useMemo(
    () =>
      (data?.charts.visitorsDaily ?? []).map((row) => ({
        ...row,
        label: shortDate(row.date),
      })),
    [data],
  );

  const planPie = data?.charts.revenueByPlan?.length
    ? data.charts.revenueByPlan
    : [{ name: "No payments yet", amountInr: 1 }];

  const statusPie = data?.charts.companiesByStatus?.length
    ? data.charts.companiesByStatus.map((s) => ({ name: s.status, value: s.count }))
    : [{ name: "None", value: 1 }];

  return (
    <AppShell title="Platform overview" subtitle="Super Admin · revenue · visitors · charts" nav={adminNav()}>
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">Revenue</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total revenue" value={inr(data?.metrics.revenueAllTimeInr)} accent="#3DDC97" />
        <StatCard label="Today" value={inr(data?.metrics.revenueTodayInr)} accent="#00D2FF" />
        <StatCard label="This week" value={inr(data?.metrics.revenueThisWeekInr)} accent="#7B5CFF" />
        <StatCard label="This month" value={inr(data?.metrics.revenueThisMonthInr)} accent="#F0C14A" />
        <StatCard label="MRR (plan)" value={inr(data?.metrics.monthlyRecurringRevenue)} accent="#C026FF" />
      </div>

      <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">Visitors</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Overall visits" value={data?.metrics.visitorsOverall ?? "—"} accent="#00D2FF" />
        <StatCard label="Today" value={data?.metrics.visitorsToday ?? "—"} accent="#3DDC97" />
        <StatCard label="This week" value={data?.metrics.visitorsThisWeek ?? "—"} accent="#7B5CFF" />
        <StatCard label="This month" value={data?.metrics.visitorsThisMonth ?? "—"} accent="#F0C14A" />
        <StatCard label="Avg / day (month)" value={data?.metrics.visitorsAverageDaily ?? "—"} accent="#FF6B6B" />
      </div>

      <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">Platform</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Landing page views" value={data?.metrics.landingPageViews ?? "—"} accent="#00D2FF" />
        <StatCard label="Companies" value={data?.metrics.registeredCompanies ?? "—"} accent="#7B5CFF" />
        <StatCard label="Active / Trials" value={`${data?.metrics.activeCompanies ?? 0} / ${data?.metrics.trialAccounts ?? 0}`} accent="#3DDC97" />
        <StatCard label="Successful payments" value={data?.metrics.successfulPayments ?? "—"} accent="#F0C14A" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Revenue · last 30 days</h2>
          <p className="mt-1 text-xs text-content-muted">Succeeded Razorpay / payment amounts (₹)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueLine}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D2FF" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00D2FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(value: number) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenueInr" stroke="#00D2FF" fill="url(#revFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Visitors · last 30 days</h2>
          <p className="mt-1 text-xs text-content-muted">Public site pageviews (landing highlighted)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitorsLine}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                />
                <Legend />
                <Line type="monotone" dataKey="visitors" name="All pages" stroke="#7B5CFF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="landing" name="Landing /" stroke="#3DDC97" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Revenue by plan</h2>
          <p className="mt-1 text-xs text-content-muted">Succeeded payments · last 30 days</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planPie}
                  dataKey="amountInr"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {planPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(value: number, name: string) => [
                    data?.charts.revenueByPlan?.length ? `₹${Number(value).toLocaleString("en-IN")}` : "—",
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Companies by status</h2>
          <p className="mt-1 text-xs text-content-muted">Active · trial · and other statuses</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0B1220", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Top public pages (30d)</h2>
          <ul className="mt-4 space-y-2">
            {(data?.charts.topPaths ?? []).length ? (
              data!.charts.topPaths.map((row) => (
                <li key={row.path} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-white">{row.path}</span>
                  <span className="text-content-muted">{row.views.toLocaleString("en-IN")} views</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-content-muted">
                No visitor data yet. Counts start after the landing page is opened with tracking live.
              </li>
            )}
          </ul>
        </div>

        <div className="panel p-5">
          <h2 className="font-display text-lg font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {(data?.recentActivity ?? []).slice(0, 10).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{item.action}</p>
                  <p className="text-content-muted">{item.actor?.fullName ?? "System"}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-content-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {!data?.recentActivity?.length ? (
              <li className="text-sm text-content-muted">No audit events yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
