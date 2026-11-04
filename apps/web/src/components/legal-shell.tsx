import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/delete-account", label: "Delete Account / Data" },
  { href: "/support", label: "Support" },
  { href: "/integrations", label: "Integration URLs" },
];

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-ink-base text-content-primary">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo.svg"
              alt="SR Social Hub"
              width={40}
              height={40}
              className="rounded-lg"
              priority
            />
            <span className="font-display text-lg font-semibold tracking-tight">SR Social Hub</span>
          </Link>
          <Link href="/login" className="text-sm text-content-muted hover:text-white">
            Sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-secondary">
          Legal
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-content-muted">Last updated: {updated}</p>
        <div className="prose-legal mt-8 space-y-5 text-sm leading-7 text-content-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </article>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 py-6 text-sm text-content-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
