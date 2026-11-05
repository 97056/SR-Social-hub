"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { apiFetch, getSessionUser, getToken, setSessionUser, setToken } from "@/lib/api";
import { adminNav, clientNav, companyNav, type NavItem } from "@/lib/nav";
import { firstLetter } from "@/lib/profile";
import type { AuthSessionUser } from "@/lib/types";

type MeResponse = {
  user: AuthSessionUser;
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: string; status?: string }>;
    clients: Array<{ id: string; name: string; companyId: string; role: string }>;
  };
};

function navForPath(pathname: string): NavItem[] {
  if (pathname.startsWith("/admin")) return adminNav();
  const app = pathname.match(/^\/app\/([^/]+)/);
  if (app) return companyNav(app[1]);
  const client = pathname.match(/^\/client\/([^/]+)/);
  if (client) return clientNav(client[1]);
  return adminNav();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--text)] sm:text-right">{value}</dd>
    </div>
  );
}

export function ProfilePageView({ subtitle }: { subtitle: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<MeResponse | null>(null);
  const [cached, setCached] = useState<AuthSessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCached(getSessionUser());
    if (!getToken()) {
      router.replace(pathname.startsWith("/admin") ? "/admin/login" : "/login");
      return;
    }
    apiFetch<MeResponse>("/auth/me")
      .then((res) => {
        setData(res);
        setSessionUser(res.user);
        setCached(res.user);
      })
      .catch((e: Error) => setError(e.message));
  }, [pathname, router]);

  const user = data?.user ?? cached;
  const letter = firstLetter(user?.fullName);

  async function signOut() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken(null);
    setSessionUser(null);
    router.replace(pathname.startsWith("/admin") ? "/admin/login" : "/login");
  }

  return (
    <AppShell title="My profile" subtitle={subtitle} nav={navForPath(pathname)} tone="#7B5CFF">
      {error ? <p className="mb-4 text-sm text-brand-error">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="panel overflow-hidden p-0">
          <div className="bg-gradient-to-br from-[#00D2FF]/25 via-[#7B5CFF]/20 to-[#C026FF]/25 px-5 py-8 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#00D2FF] to-[#C026FF] font-display text-3xl font-bold text-[#050814] shadow-lg">
              {letter}
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold text-[var(--text)]">
              {user?.fullName || "Loading…"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{user?.email || "—"}</p>
          </div>
          <div className="space-y-2 p-4 text-sm">
            <p className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-[var(--muted)]">
              Role: <span className="font-semibold text-[var(--text)]">{user?.globalRole || "—"}</span>
            </p>
            <p className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-[var(--muted)]">
              Account:{" "}
              <span className="font-semibold text-[var(--text)]">{user?.accountKind || "—"}</span>
            </p>
            <button
              type="button"
              onClick={signOut}
              className="w-full rounded-xl border border-brand-error/40 bg-brand-error/10 px-3 py-2.5 text-sm font-semibold text-brand-error"
            >
              Sign out
            </button>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-[var(--text)]">Login details</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Full account information for this signed-in user.</p>
          <dl className="mt-4">
            <Row label="Full name" value={user?.fullName || "—"} />
            <Row label="Email" value={user?.email || "—"} />
            <Row label="Phone" value={user?.phone || "—"} />
            <Row label="Account type" value={user?.accountKind || "—"} />
            <Row label="Global role" value={user?.globalRole || "—"} />
            <Row
              label="Email verified"
              value={
                user?.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : "Not verified"
              }
            />
            <Row
              label="Last login"
              value={user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
            />
            <Row
              label="Joined"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
            />
            <Row label="Status" value={user?.isActive === false ? "Inactive" : "Active"} />
            <Row label="User ID" value={user?.userCode || "—"} />
          </dl>

          {data?.workspaces ? (
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <h3 className="font-display text-lg font-semibold text-[var(--text)]">Workspaces</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {data.workspaces.companies.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-[var(--text)]"
                  >
                    Company: <strong>{c.name}</strong> · {c.role}
                    {c.status ? ` · ${c.status}` : ""}
                  </li>
                ))}
                {data.workspaces.clients.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-[var(--text)]"
                  >
                    Client: <strong>{c.name}</strong> · {c.role}
                  </li>
                ))}
                {!data.workspaces.companies.length && !data.workspaces.clients.length ? (
                  <li className="text-[var(--muted)]">No workspace memberships.</li>
                ) : null}
              </ul>
            </div>
          ) : null}

        </section>
      </div>
    </AppShell>
  );
}
