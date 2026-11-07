import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { fetchPublicBranding } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Under maintenance",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const brand = await fetchPublicBranding();
  const logo = brand.logoUrl || "/brand/logo.png";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-base px-6 text-center text-content-primary">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${brand.primaryColor}33, transparent), radial-gradient(ellipse 60% 40% at 80% 100%, ${brand.secondaryColor}22, transparent)`,
        }}
      />
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center">
        <Image
          src={logo}
          alt={brand.platformName}
          width={88}
          height={88}
          className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/15"
          priority
        />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary">
          Maintenance
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          We&apos;ll be right back
        </h1>
        <p className="mt-4 text-sm leading-7 text-content-muted sm:text-base">
          {brand.platformName} is undergoing scheduled maintenance. Publishing, approvals, and
          sign-in for agencies are paused until we finish. Thanks for your patience.
        </p>
        <a
          href={`mailto:${brand.supportEmail}`}
          className="mt-8 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white"
        >
          Contact {brand.supportEmail}
        </a>
        <p className="mt-6 text-xs text-content-muted">
          Super admins can still open{" "}
          <Link href="/admin/login" className="text-brand-primary hover:underline">
            Admin login
          </Link>{" "}
          to turn maintenance off.
        </p>
      </div>
    </main>
  );
}
