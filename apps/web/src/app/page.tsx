import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/brand/logo.svg" alt="SR Social Hub" width={48} height={48} className="rounded-xl" priority />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-secondary">
            SR Social Hub
          </p>
        </div>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          All your socials. One command center.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-content-muted sm:text-lg">
          Manage clients, approvals, scheduling, and multi-network publishing from a premium agency
          workspace.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white"
          >
            Company / Client login
          </Link>
          <Link
            href="/admin/login"
            className="rounded-xl border border-white/15 bg-ink-elevated px-5 py-3 text-sm font-semibold"
          >
            Super Admin
          </Link>
        </div>
      </div>
      <footer className="mt-16 flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm text-content-muted">
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/delete-account" className="hover:text-white">
          Delete account
        </Link>
        <Link href="/support" className="hover:text-white">
          Support
        </Link>
        <Link href="/integrations" className="hover:text-white">
          Integration URLs
        </Link>
      </footer>
    </main>
  );
}
