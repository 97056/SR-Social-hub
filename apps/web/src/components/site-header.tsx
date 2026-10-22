"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { api } from "@/lib/api";

const links = [
  ["Features", "/#features"],
  ["Pricing", "/#pricing"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

export function SiteHeader() {
  const theme = useTheme();
  const pathname = usePathname();
  const admin = pathname.startsWith("/admin");
  const brand = admin ? "SR Social Admin" : theme?.brandName ?? "SR Social hub";
  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-canvas/90 backdrop-blur">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 min-w-8 place-items-center rounded-brand bg-primary px-1.5 text-xs text-primary-foreground">SR</span>
          {brand}
        </Link>
        <nav className="hidden items-center gap-5 text-sm md:flex" aria-label="Primary">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-secondary">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <SignOutButton />
          <Link href="/login" className="rounded-brand px-3 py-2 hover:bg-black/5">Sign in</Link>
          <Link href="/register" className="rounded-brand bg-primary px-3 py-2 text-primary-foreground">Get started</Link>
        </div>
      </div>
    </header>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    api("/api/auth/me").then(() => setSignedIn(true)).catch(() => setSignedIn(false));
  }, []);

  if (!signedIn) return null;

  return (
    <button
      type="button"
      className="rounded-brand px-3 py-2 hover:bg-black/5"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        setSignedIn(false);
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function SiteFooter() {
  const theme = useTheme();
  return (
    <footer className="border-t border-black/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm">
        <p>{theme?.brandName ?? "SR Social hub"} · All Your Socials. One Dashboard</p>
        <nav className="flex flex-wrap gap-4" aria-label="Legal">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/refunds">Refunds</Link>
          <Link href="/legal/data-deletion">Data deletion</Link>
        </nav>
      </div>
    </footer>
  );
}
