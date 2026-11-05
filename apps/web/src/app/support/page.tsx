import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { fetchPublicBranding } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Support · SR Social Hub",
  description: "FAQs and help for SR Social Hub.",
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  published: boolean;
  sortOrder: number;
};

async function fetchFaqs(): Promise<FaqItem[]> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${api}/api/v1/faqs`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return (await res.json()) as FaqItem[];
  } catch {
    return [];
  }
}

export default async function SupportPage() {
  const [brand, faqs] = await Promise.all([fetchPublicBranding(), fetchFaqs()]);

  return (
    <main className="landing relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-grid" />
      </div>

      <SiteHeader logoUrl={brand.logoUrl} platformName={brand.platformName} />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-12">
        <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
          Help center
        </p>
        <h1 className="landing-heading font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Support
        </h1>
        <p className="mt-4 text-base leading-7 text-content-muted">
          Browse answers about trials, plans, approvals, publishing, and account help. Manage these
          FAQs anytime from Admin → Support FAQs.
        </p>

        <div className="mt-10 space-y-3">
          {faqs.length ? (
            faqs.map((faq) => (
              <details
                key={faq.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 open:border-brand-primary/35 open:bg-brand-primary/5"
              >
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>{faq.question}</span>
                    <span className="mt-0.5 text-brand-primary transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-content-muted">{faq.answer}</p>
              </details>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-content-muted">
              FAQs will appear here once published from Admin → Support FAQs.
            </p>
          )}
        </div>
      </section>

      <SiteFooter
        platformName={brand.platformName}
        supportEmail={brand.supportEmail}
        logoUrl="/brand/logo-mark.png"
      />
    </main>
  );
}
