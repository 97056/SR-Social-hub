import Link from "next/link";
import { Pricing } from "@/components/pricing";

const features = [
  ["One workspace, many brands", "Agencies keep each client in its own profile. A business uses the same tools for a single brand."],
  ["Approval before publishing", "A post that needs approval cannot go out until a reviewer accepts that version. Edits send it back."],
  ["One result per account", "Publishing to Facebook and Instagram counts as two post targets, and each target keeps its own status."],
  ["Official connections only", "People connect accounts with each platform’s OAuth flow. The product never asks for a social password."],
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">SR Social hub</p>
          <h1 className="mt-3 max-w-xl text-5xl font-semibold leading-tight tracking-tight">All Your Socials. One Dashboard</h1>
          <p className="mt-4 max-w-xl text-lg">Agencies and businesses plan, approve, and publish from one workspace. Connectors stay marked coming soon until their official API access has passed a real test.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-brand bg-primary px-4 py-2 font-semibold text-primary-foreground">Create a workspace</Link>
            <Link href="/quote" className="rounded-brand border border-primary px-4 py-2 font-semibold text-primary">Request a custom quote</Link>
          </div>
        </div>
        <aside className="rounded-brand border border-black/10 bg-surface p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">A post target</p>
          <p className="mt-2 text-2xl font-semibold">One post, delivered to one connected account.</p>
          <p className="mt-3 text-sm">A creative sent to a Facebook Page and an Instagram professional account uses two post targets. Limits are stored on the plan and enforced by the API.</p>
        </aside>
      </section>
      <section id="features" className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-3xl font-semibold tracking-tight">What the workspace does</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {features.map(([title, copy]) => (
            <article key={title} className="rounded-brand bg-surface p-5">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-3xl font-semibold tracking-tight">Plans</h2>
        <p className="mt-2 max-w-2xl text-sm">Starter, Growth, and Agency are monthly prices in INR. Taxes are extra unless a plan says otherwise. Custom limits are quoted. An admin can change every number without a redeploy.</p>
        <div className="mt-6"><Pricing /></div>
      </section>
    </div>
  );
}
