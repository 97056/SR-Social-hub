"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { apiFetch, getSessionUser, getToken, setSessionUser, setToken } from "@/lib/api";
import type { NavItem } from "@/lib/nav";
import { filterGrowthNav } from "@/lib/nav";
import { firstLetter, profileHrefFromPath } from "@/lib/profile";
import { NavGlyph } from "@/components/nav-icons";
import { SupportChatAgent } from "@/components/support-chat-agent";

export type { NavItem };

type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    globalRole: "SUPER_ADMIN" | "USER";
    phone?: string | null;
    accountKind?: string | null;
    emailVerifiedAt?: string | null;
    lastLoginAt?: string | null;
    createdAt?: string | null;
  };
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: string; status?: string }>;
    clients: Array<{ id: string; name: string; companyId: string; role: string }>;
  };
};

type NotifItem = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

function applyDocumentTheme(next: "dark" | "light") {
  document.documentElement.classList.toggle("light", next === "light");
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.dataset.theme = next;
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const userChoice = localStorage.getItem("sr_theme_user") as "dark" | "light" | null;
    if (userChoice === "light" || userChoice === "dark") {
      setTheme(userChoice);
      applyDocumentTheme(userChoice);
      return;
    }

    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${api}/api/v1/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { themeDefault?: string } | null) => {
        const next = data?.themeDefault === "light" ? "light" : "dark";
        localStorage.setItem("sr_theme", next);
        setTheme(next);
        applyDocumentTheme(next);
      })
      .catch(() => {
        applyDocumentTheme("dark");
      });
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sr_theme", next);
    localStorage.setItem("sr_theme_user", next);
    applyDocumentTheme(next);
  }

  return { theme, toggle };
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SIDEBAR_SCROLL_KEY = "sr_sidebar_scroll_y";

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const bestHref = nav
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="space-y-1.5 px-3 pb-6">
      {nav.map((item, index) => {
        const prev = nav[index - 1];
        const showSection = Boolean(item.section && item.section !== prev?.section);
        const active = item.href === bestHref || (item.href === "/admin" && pathname === "/admin");
        return (
          <div key={item.href}>
            {showSection ? (
              <p className="mb-2 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                {item.section}
              </p>
            ) : null}
            <Link
              href={item.href}
              title={item.label}
              data-active={active ? "true" : undefined}
              onClick={() => {
                // Persist current scroll before route change remounts the shell.
                const aside = document.querySelector<HTMLElement>("[data-app-sidebar]");
                if (aside) sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(aside.scrollTop));
                onNavigate?.();
              }}
              className={cn(
                "app-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "is-active text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
              style={{
                ["--nav-accent" as string]: item.color,
                background: active ? hexToRgba(item.color, 0.14) : undefined,
                boxShadow: active ? `inset 3px 0 0 ${item.color}` : undefined,
              }}
            >
              <span
                className="app-nav-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                style={{
                  color: item.color,
                  background: hexToRgba(item.color, 0.16),
                  borderColor: hexToRgba(item.color, 0.35),
                }}
              >
                <NavGlyph name={item.icon} className="h-[1.05rem] w-[1.05rem]" />
              </span>
              <span className={cn("truncate font-medium", active && "text-[var(--text)]")}>{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function useSidebarScrollRestore(pathname: string) {
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const onScroll = () => sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || "0");
    if (Number.isFinite(saved) && saved > 0) el.scrollTop = saved;
    // Keep the active Growth item visible without jumping to absolute top.
    requestAnimationFrame(() => {
      const active = el.querySelector<HTMLElement>("[data-active='true']");
      active?.scrollIntoView({ block: "nearest", inline: "nearest" });
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
    });
  }, [pathname]);

  return asideRef;
}

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  tone,
  brandLogoUrl,
  brandName,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: React.ReactNode;
  tone?: string;
  /** When set (e.g. client brand logo), replaces the default SR mark. */
  brandLogoUrl?: string | null;
  brandName?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useSidebarScrollRestore(pathname);
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [platformLogo, setPlatformLogo] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState<string | null>(null);
  const [growthCenterEnabled, setGrowthCenterEnabled] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);

  const visibleNav = useMemo(
    () => filterGrowthNav(nav, growthCenterEnabled),
    [nav, growthCenterEnabled],
  );

  const activeTone =
    tone ||
    visibleNav.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.color ||
    "#00D2FF";

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return visibleNav.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6);
  }, [visibleNav, search]);

  useEffect(() => {
    setOpen(false);
    setSearch("");
    setNotifOpen(false);
  }, [pathname]);

  useEffect(() => {
    const cached = getSessionUser();
    if (cached) {
      setMe((prev) =>
        prev ?? {
          user: cached,
          workspaces: { isSuperAdmin: cached.globalRole === "SUPER_ADMIN", companies: [], clients: [] },
        },
      );
    }
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    fetch(`${api}/api/v1/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { logoUrl?: string; platformName?: string } | null) => {
        if (data?.logoUrl) setPlatformLogo(data.logoUrl);
        if (data?.platformName) setPlatformName(data.platformName);
      })
      .catch(() => {
        setPlatformLogo("/brand/logo.png");
        setPlatformName("SR Social Hub");
      });
    fetch(`${api}/api/v1/public/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { growthCenterEnabled?: boolean } | null) => {
        setGrowthCenterEnabled(data?.growthCenterEnabled !== false);
      })
      .catch(() => setGrowthCenterEnabled(true));
    if (!getToken()) return;
    apiFetch<MeResponse>("/auth/me")
      .then((res) => {
        setMe(res);
        setSessionUser(res.user);
      })
      .catch(() => {
        /* keep cached session user for avatar */
      });
    apiFetch<{ count: number }>("/notifications/unread-count")
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [pathname]);

  useEffect(() => {
    if (growthCenterEnabled) return;
    if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/")) return;
    if (!pathname.includes("/growth")) return;
    if (pathname.startsWith("/app/")) {
      const companyId = pathname.split("/")[2];
      if (companyId) router.replace(`/app/${companyId}/dashboard`);
      return;
    }
    if (pathname.startsWith("/client/")) {
      const clientId = pathname.split("/")[2];
      if (clientId) router.replace(`/client/${clientId}/dashboard`);
    }
  }, [growthCenterEnabled, pathname, router]);

  const shellLogo = brandLogoUrl || platformLogo || "/brand/logo.png";
  const shellName = brandName || platformName || "SR Social Hub";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function openNotifications() {
    setNotifOpen((v) => !v);
    try {
      const list = await apiFetch<NotifItem[]>("/notifications");
      setNotifs(list.slice(0, 8));
      const c = await apiFetch<{ count: number }>("/notifications/unread-count");
      setUnread(c.count);
    } catch {
      setNotifs([]);
    }
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setToken(null);
    setSessionUser(null);
    router.replace(pathname.startsWith("/admin") ? "/admin/login" : "/login");
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchHits[0]) router.push(searchHits[0].href);
  }

  // Only use React state here — never localStorage during render (avoids SSR/client hydration mismatch).
  const avatarLetter = firstLetter(me?.user.fullName);
  const profileHref = profileHrefFromPath(pathname);

  return (
    <div
      className="app-shell min-h-screen lg:grid lg:grid-cols-[272px_1fr]"
      style={{ ["--page-accent" as string]: activeTone }}
    >
      <aside
        ref={sidebarRef}
        data-app-sidebar
        className="app-sidebar hidden max-h-screen overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar)] lg:sticky lg:top-0 lg:block lg:min-h-screen"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shellLogo}
            alt={shellName}
            title={shellName}
            className="h-11 w-11 rounded-2xl object-cover shadow-sm ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight text-[var(--text)]">
              {shellName}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">{subtitle ?? "Workspace"}</p>
          </div>
        </div>
        <div className="pt-3">
          <NavLinks nav={visibleNav} pathname={pathname} />
        </div>
      </aside>

      <div className="min-w-0 bg-[var(--bg)]">
        <header className="app-header sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="app-icon-btn grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] lg:hidden"
                aria-label="Open menu"
                onClick={() => setOpen(true)}
              >
                <span className="flex w-4 flex-col gap-1">
                  <span className="h-0.5 w-full bg-[var(--text)]" />
                  <span className="h-0.5 w-full bg-[var(--text)]" />
                  <span className="h-0.5 w-3 bg-[var(--text)]" />
                </span>
              </button>
              <div className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                  {subtitle ?? "SR Social Hub"}
                </p>
                <h1 className="truncate font-display text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                  {title}
                </h1>
              </div>
            </div>

            <form onSubmit={onSearchSubmit} className="relative order-3 w-full sm:order-none sm:max-w-xs lg:max-w-sm">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages…"
                className="app-search-input w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] py-2.5 pl-10 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--page-accent)]"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              {searchHits.length ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-panel">
                  {searchHits.map((hit) => (
                    <button
                      key={hit.href}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--elevated)]"
                      onClick={() => {
                        setSearch("");
                        router.push(hit.href);
                      }}
                    >
                      <span
                        className="grid h-7 w-7 place-items-center rounded-md"
                        style={{ color: hit.color, background: `${hit.color}18` }}
                      >
                        <NavGlyph name={hit.icon} className="h-3.5 w-3.5" />
                      </span>
                      {hit.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </form>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                className="app-icon-btn grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] text-[var(--text)]"
                aria-label="Toggle theme"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 14.5A8.5 8.5 0 1110 3.5 7 7 0 0021 14.5z" />
                  </svg>
                )}
              </button>

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={openNotifications}
                  className="app-icon-btn relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] text-[var(--text)]"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z" />
                    <path d="M10 19a2 2 0 004 0" />
                  </svg>
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-error px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </button>
                <AnimatePresence>
                  {notifOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(92vw,340px)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-panel"
                    >
                      <div className="border-b border-[var(--border)] px-4 py-3">
                        <p className="font-display text-sm font-semibold text-[var(--text)]">Notifications</p>
                      </div>
                      <ul className="max-h-80 overflow-y-auto">
                        {notifs.map((n) => (
                          <li key={n.id} className="border-b border-[var(--border)] px-4 py-3 last:border-0">
                            <p className="text-sm font-medium text-[var(--text)]">{n.title}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{n.body}</p>
                          </li>
                        ))}
                        {!notifs.length ? (
                          <li className="px-4 py-6 text-sm text-[var(--muted)]">No notifications yet.</li>
                        ) : null}
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    router.push(profileHref);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] text-base font-bold text-[#050814]"
                  style={{ background: `linear-gradient(135deg, ${activeTone}, #C026FF)` }}
                  aria-label="Open profile"
                  title={me?.user.fullName || "Profile"}
                >
                  {avatarLetter}
                </button>
              </div>
            </div>
          </div>
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${activeTone}, transparent)` }} />
        </header>

        <AnimatePresence>
          {open ? (
            <motion.div
              className="fixed inset-0 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                data-app-sidebar
                className="relative flex h-full w-[min(86vw,288px)] flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar)]"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-5">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shellLogo}
                      alt={shellName}
                      title={shellName}
                      className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"
                    />
                    <div>
                      <p className="font-display text-sm font-semibold text-[var(--text)]">
                        {shellName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{subtitle ?? "Workspace"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <NavLinks nav={visibleNav} pathname={pathname} onNavigate={() => setOpen(false)} />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="px-4 py-5 sm:px-5 sm:py-6"
        >
          <div
            className="mb-5 h-1.5 w-full max-w-xs rounded-full sm:max-w-sm"
            style={{ background: `linear-gradient(90deg, ${activeTone}, transparent)` }}
            aria-hidden
          />
          {children}
        </motion.main>
      </div>
      <SupportChatAgent />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "#00D2FF",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="panel relative overflow-hidden p-4 sm:p-5">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full"
        style={{ background: hexToRgba(accent, 0.16) }}
      />
      <div className="mb-3 h-1 w-10 rounded-full" style={{ background: accent }} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 font-display text-2xl font-semibold text-[var(--text)] sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-[var(--text)]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{body}</p>
    </div>
  );
}
