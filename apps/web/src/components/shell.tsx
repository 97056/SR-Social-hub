"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon?: string };

export function AppShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-ink-sidebar lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-primary font-display text-sm font-bold text-white">
            SR
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide">SR Social Hub</p>
            <p className="text-xs text-content-muted">{subtitle ?? "Workspace"}</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 pb-6">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-brand-primary/20 text-white"
                    : "text-content-muted hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-ink-bg/80 px-5 py-4 backdrop-blur">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/10 bg-ink-elevated px-3 py-2 text-sm text-content-muted">
              Notifications
            </button>
            <button className="rounded-xl bg-brand-primary px-3 py-2 text-sm font-medium text-white">
              Quick Create
            </button>
          </div>
        </header>
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="px-5 py-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-content-muted">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint ? <p className="mt-2 text-sm text-content-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-content-muted">{body}</p>
    </div>
  );
}
