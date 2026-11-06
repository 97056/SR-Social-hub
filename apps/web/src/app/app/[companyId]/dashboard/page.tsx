"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell, StatCard } from "@/components/shell";
import { apiFetch, getSessionUser, getToken } from "@/lib/api";
import { companyNav } from "@/lib/nav";

type SocialLink = {
  id: string;
  platformCode: string;
  accountName: string | null;
  username: string | null;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  contactEmail: string | null;
  postCount: number;
  memberCount: number;
  socials: SocialLink[];
};

type Workspace = {
  company: {
    id: string;
    name: string;
    status: string;
    website: string | null;
    phone: string | null;
    billingEmail: string | null;
    gstNumber: string | null;
    timezone: string;
    planEndsAt: string | null;
    planCountdown: {
      label: string;
      endsAt: string | null;
      daysLeft: number | null;
      hoursLeft: number | null;
      expired: boolean;
      isTrial: boolean;
    };
    plan: {
      name: string;
      clientQuota: number;
      accountQuota: number;
      teamQuota: number;
      aiQuota: number;
      monthlyPriceInr: number;
      maxSocialNetworks?: number;
      catalogClientQuota?: number;
      catalogAccountQuota?: number;
    } | null;
    subscription: { status: string; interval: string } | null;
    counts: { clients: number; members: number };
  };
  clients: ClientRow[];
  dashboard: {
    totalClients: number;
    teamMembers: number;
    connectedAccounts: number;
    awaitingApproval: number;
    postsScheduled: number;
    publishedThisMonth: number;
    remainingClientQuota: number | null;
    remainingSocialQuota: number | null;
  };
};

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  FACEBOOK: { label: "Facebook", color: "#1877F2" },
  INSTAGRAM: { label: "Instagram", color: "#E1306C" },
  LINKEDIN: { label: "LinkedIn", color: "#0A66C2" },
  X: { label: "X", color: "#8B98A5" },
  YOUTUBE: { label: "YouTube", color: "#FF0000" },
  PINTEREST: { label: "Pinterest", color: "#E60023" },
  THREADS: { label: "Threads", color: "#A8A8A8" },
};

function greetingForNow(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatCountdown(c: Workspace["company"]["planCountdown"]) {
  if (!c.endsAt) return "No end date set";
  if (c.expired) return "Expired — renew to keep publishing";
  if (c.daysLeft != null && c.daysLeft > 1) return `${c.daysLeft} days left`;
  if (c.hoursLeft != null) return `${c.hoursLeft} hours left`;
  return "Ending soon";
}

export default function CompanyDashboardPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const companyId = params.companyId;
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [sessionName, setSessionName] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    setSessionName(getSessionUser()?.fullName?.split(" ")[0] ?? null);
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<Workspace>(`/companies/${companyId}/workspace`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [companyId, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const greeting = useMemo(() => (now ? greetingForNow(now) : "Welcome"), [now]);
  const firstName = sessionName || data?.company.name?.split(" ")[0] || "there";
  const title = `${greeting}, ${firstName}`;
  const countdown = data?.company.planCountdown;

  return (
    <AppShell
      title={title}
      subtitle={data?.company.plan?.name ?? "Company workspace"}
      nav={companyNav(companyId)}
      tone="#00D2FF"
    >
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      {/* Plan / trial banner */}
      <section
        className="panel mb-4 overflow-hidden p-0"
        style={{
          borderColor: countdown?.expired
            ? "#FF6B6B"
            : countdown?.isTrial
              ? "#F0C14A"
              : "#00D2FF",
        }}
      >
        <div
          className="grid gap-4 p-5 sm:grid-cols-[1.2fr_0.8fr] sm:items-center"
          style={{
            background: countdown?.expired
              ? "linear-gradient(105deg, rgba(255,107,107,0.16), transparent 60%)"
              : countdown?.isTrial
                ? "linear-gradient(105deg, rgba(240,193,74,0.16), transparent 60%)"
                : "linear-gradient(105deg, rgba(0,210,255,0.14), transparent 60%)",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              {countdown?.isTrial ? "Free trial" : "Your plan"}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--text)]">
              {data?.company.plan?.name ?? "No plan assigned"}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Workspace: <span className="text-[var(--text)]">{data?.company.name ?? "—"}</span>
              {data?.company.gstNumber ? ` · GST ${data.company.gstNumber}` : ""}
            </p>
            {countdown?.isTrial ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Trial caps: {data?.company.plan?.clientQuota ?? "—"} client
                {(data?.company.plan?.clientQuota ?? 0) === 1 ? "" : "s"} · up to{" "}
                {data?.company.plan?.accountQuota ?? "—"} social connection
                {(data?.company.plan?.accountQuota ?? 0) === 1 ? "" : "s"} (from Admin free trial;
                paid plan unlocks catalog quotas).
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2.5 py-1 text-[var(--text)]">
                Status: {data?.company.status ?? "—"}
              </span>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2.5 py-1 text-[var(--text)]">
                Clients {data?.dashboard.totalClients ?? 0}/{data?.company.plan?.clientQuota ?? "—"}
              </span>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2.5 py-1 text-[var(--text)]">
                Socials {data?.dashboard.connectedAccounts ?? 0}/{data?.company.plan?.accountQuota ?? "—"}
              </span>
              <span className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2.5 py-1 text-[var(--text)]">
                Team {data?.dashboard.teamMembers ?? 0}/{data?.company.plan?.teamQuota ?? "—"}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4 text-center sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {countdown?.label ?? "Plan timeline"}
            </p>
            <p
              className="mt-2 font-display text-3xl font-semibold"
              style={{
                color: countdown?.expired ? "#FF6B6B" : countdown?.isTrial ? "#F0C14A" : "#00D2FF",
              }}
            >
              {countdown ? formatCountdown(countdown) : "—"}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {countdown?.endsAt
                ? new Date(countdown.endsAt).toLocaleString()
                : "Add a plan end date from billing"}
            </p>
            <button
              type="button"
              className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-[#050814]"
              style={{ background: countdown?.isTrial ? "#F0C14A" : "#00D2FF" }}
              onClick={() => router.push(`/app/${companyId}/billing`)}
            >
              {countdown?.isTrial ? "Upgrade plan" : "View billing"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Create Post", "Multi-platform content studio", `/app/${companyId}/create`, "#F0C14A"],
            ["Media Library", "Upload images and video", `/app/${companyId}/media`, "#FF6B6B"],
            ["Command Center", "Daily operating screen", `/app/${companyId}/command-center`, "#C026FF"],
            ["Add Client", "Grow your client roster", `/app/${companyId}/clients`, "#7B5CFF"],
          ] as const
        ).map(([cardTitle, body, href, color]) => (
          <button
            key={cardTitle}
            className="panel p-4 text-left transition hover:-translate-y-0.5"
            style={{
              borderColor: color,
              borderWidth: 1,
              background: `linear-gradient(165deg, ${color}14, var(--card) 42%)`,
            }}
            onClick={() => router.push(href)}
          >
            <span
              className="mb-3 inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ background: color }}
            >
              Open
            </span>
            <p className="font-display font-semibold text-[var(--text)]">{cardTitle}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={data?.dashboard.totalClients ?? "—"} accent="#7B5CFF" />
        <StatCard label="Social connected" value={data?.dashboard.connectedAccounts ?? 0} accent="#3DDC97" />
        <StatCard label="Awaiting approval" value={data?.dashboard.awaitingApproval ?? 0} accent="#FFB020" />
        <StatCard
          label="Published this month"
          value={data?.dashboard.publishedThisMonth ?? 0}
          accent="#00D2FF"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--text)]">
                Clients ({data?.clients.length ?? 0})
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Names, industries, and connected social networks
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-[#050814]"
              onClick={() => router.push(`/app/${companyId}/clients`)}
            >
              Manage clients
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {(data?.clients ?? []).map((client) => (
              <li
                key={client.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-[var(--text)]">{client.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {client.industry || "Industry not set"}
                      {client.contactEmail ? ` · ${client.contactEmail}` : ""}
                      {client.website ? ` · ${client.website}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {client.postCount} posts · {client.memberCount} members · {client.socials.length}{" "}
                      socials
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                    onClick={() => router.push(`/client/${client.id}/dashboard`)}
                  >
                    Open
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {client.socials.length ? (
                    client.socials.map((s) => {
                      const meta = PLATFORM_META[s.platformCode] ?? {
                        label: s.platformCode,
                        color: "#9AA3B8",
                      };
                      return (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-white"
                          style={{
                            background: meta.color,
                            borderColor: meta.color,
                            opacity: s.status === "CONNECTED" ? 1 : 0.65,
                          }}
                          title={s.username ? `@${s.username}` : s.accountName || meta.label}
                        >
                          {meta.label}
                          {s.username ? (
                            <span className="font-normal opacity-90">· @{s.username.slice(0, 20)}</span>
                          ) : s.accountName ? (
                            <span className="font-normal opacity-90">
                              · {s.accountName.slice(0, 18)}
                            </span>
                          ) : null}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-[var(--muted)]">No social accounts connected yet</span>
                  )}
                </div>
              </li>
            ))}
            {!data?.clients?.length ? (
              <li className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                No clients yet. Add your first client to start connecting socials and publishing.
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Company snapshot</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Timezone</dt>
                <dd className="font-medium text-[var(--text)]">{data?.company.timezone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Billing email</dt>
                <dd className="max-w-[60%] truncate font-medium text-[var(--text)]">
                  {data?.company.billingEmail || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Phone</dt>
                <dd className="font-medium text-[var(--text)]">{data?.company.phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Website</dt>
                <dd className="max-w-[60%] truncate font-medium text-[var(--text)]">
                  {data?.company.website || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">GST</dt>
                <dd className="font-medium text-[var(--text)]">{data?.company.gstNumber || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Quota left</dt>
                <dd className="font-medium text-[var(--text)]">
                  {data?.dashboard.remainingClientQuota ?? "—"} clients ·{" "}
                  {data?.dashboard.remainingSocialQuota ?? "—"} socials
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Scheduled</dt>
                <dd className="font-medium text-[var(--text)]">{data?.dashboard.postsScheduled ?? 0}</dd>
              </div>
            </dl>
          </div>

          <div className="panel p-5">
            <h2 className="font-display text-lg font-semibold text-[var(--text)]">Suggested next</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>1. Add clients under Clients</li>
              <li>2. Connect social accounts per client</li>
              <li>3. Create and submit posts for approval</li>
              <li>4. Watch publishing queue + analytics</li>
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
