import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { fetchPublicBranding } from "@/lib/branding";

const socialNetworks = [
  { name: "Facebook", color: "#1877F2", short: "f" },
  { name: "Instagram", color: "#E1306C", short: "ig" },
  { name: "LinkedIn", color: "#0A66C2", short: "in" },
  { name: "X", color: "#E7E9EA", short: "x" },
  { name: "YouTube", color: "#FF0033", short: "yt" },
  { name: "Pinterest", color: "#E60023", short: "pin" },
  { name: "Threads", color: "#FFFFFF", short: "@" },
];

const platforms = socialNetworks.map((s) => s.name);

function SocialGlyph({ name }: { name: string }) {
  const common = "h-4 w-4 fill-current";
  switch (name) {
    case "Facebook":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm6.2-.9a1.1 1.1 0 1 0 1.1 1.1 1.1 1.1 0 0 0-1.1-1.1zM12 9.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5z" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M6.5 9.5H3.7V20h2.8zm.2-3.2a1.7 1.7 0 1 1-1.7-1.7 1.7 1.7 0 0 1 1.7 1.7zM20.3 13.2c0-2.7-1.4-4-3.4-4a3.1 3.1 0 0 0-2.8 1.5V9.5h-2.8c0 .8 0 10.5 0 10.5h2.8v-5.9c0-.3 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.7V20h2.8z" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M17.6 3H20l-6.2 7.1L21 21h-5.5l-4.3-5.6L6 21H3.6l6.6-7.6L3 3h5.6l3.9 5.2L17.6 3zm-1.9 16.2h1.5L8.4 4.7H6.8l8.9 14.5z" />
        </svg>
      );
    case "YouTube":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M23 12.2s0-3.2-.4-4.7a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.4a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.7a3 3 0 0 0 2.1 2.1c1.6.4 8.5.4 8.5.4s6.9 0 8.5-.4a3 3 0 0 0 2.1-2.1c.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
        </svg>
      );
    case "Pinterest":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.6 2-2.6.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.5-.3 1.1.5 1.9 1.6 1.9 1.9 0 3.2-2.4 3.2-5.3 0-2.2-1.5-3.8-4.2-3.8a4.5 4.5 0 0 0-4.7 4.5c0 .9.3 1.5.7 2l.2.2-.2.9c0 .1-.1.2-.3.1-1.3-.5-1.9-2-1.9-3.6A6 6 0 0 1 12.7 5.4c3.3 0 5.5 2.4 5.5 5 0 3.4-1.9 6-4.7 6-1 0-1.9-.5-2.2-1.2l-.6 2.3c-.2.8-.8 1.8-1.2 2.4A10 10 0 1 0 12 2z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M12.2 3c-2.4 0-4.3.8-5.6 2.3C5.2 7 4.6 9 4.8 11.5c.2 2.1 1 3.9 2.3 5.1l.5.4-.2 1.4-.3 1.9 2-.9.5-.2.5.1c1 .3 2 .4 3 .4 2.4 0 4.3-.8 5.6-2.3 1.4-1.6 2-3.7 1.8-6.1-.2-4.2-3.5-7.3-8.3-7.3zm4.6 10.7c-.2.4-.6.7-1.2 1.1-.4.2-.9.5-1.5.4-.6 0-1.1-.2-2.1-.7-1.4-.7-2.4-1.9-3.3-3.3-.2-.4-.6-1.1-.6-1.7 0-.5.3-1 .7-1.2.2-.1.4-.2.7-.2h.5c.2 0 .4 0 .5.4l.7 1.8c.1.2 0 .4-.1.6l-.3.4c-.1.1-.2.3-.1.5.3.5.8 1.1 1.4 1.5.5.4.9.5 1.2.4.2-.1.4-.3.5-.5l.4-.7c.1-.2.3-.3.6-.2l1.8.8c.2.1.3.2.4.4 0 .4-.1.9-.4 1.3z" />
        </svg>
      );
  }
}

const features = [
  {
    icon: "bolt",
    color: "#00D2FF",
    title: "Cut hours off every campaign",
    body: "Compose once, map media per channel, and ship across networks from one screen — no more copying the same post into seven apps.",
  },
  {
    icon: "check",
    color: "#3DDC97",
    title: "Client approvals inside the platform",
    body: "Send drafts for sign-off, collect feedback in-thread, and move approved work straight into the publish queue — clients never need your passwords.",
  },
  {
    icon: "users",
    color: "#C026FF",
    title: "Agency + client dual workspace",
    body: "Your team runs calendars, media, and publishing. Clients open a focused portal to review and approve — clean separation, faster turns.",
  },
  {
    icon: "broadcast",
    color: "#FF6B6B",
    title: "One post. Multi-network publish",
    body: "Schedule or publish live to Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads — unlocked by plan (3 networks on Starter, all on Growth+).",
  },
  {
    icon: "gift",
    color: "#F0C14A",
    title: "7-day free trial to feel the speed",
    body: "Start free for 7 days with 1 client profile. Prove the approval + publish flow, then pick a plan that matches your roster.",
  },
  {
    icon: "chart",
    color: "#7B5CFF",
    title: "Media library & publishing pulse",
    body: "Reuse creatives, track job outcomes, and keep every client workspace tidy so delivery stays fast when volume climbs.",
  },
];

const steps = [
  {
    n: "01",
    icon: "login",
    color: "#00D2FF",
    title: "Step into the hub",
    body: "Sign in, land in your workspace, and see the client roster that matches your plan.",
  },
  {
    n: "02",
    icon: "link",
    color: "#C026FF",
    title: "Plug in the networks",
    body: "Link Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads under each brand profile.",
  },
  {
    n: "03",
    icon: "spark",
    color: "#3DDC97",
    title: "Spark → approve → broadcast",
    body: "Draft once, get the nod, then publish now or schedule when the feed is hottest.",
  },
];

function FeatureIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const props = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, viewBox: "0 0 24 24" };
  switch (name) {
    case "bolt":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 3 4 14h7l-1 7 10-12h-7l1-6z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5 11 14.5 15.5 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      );
    case "users":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8a3 3 0 1 1-4.5 2.6M22 21v-2a3.5 3.5 0 0 0-2.5-3.3" />
        </svg>
      );
    case "broadcast":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 18.5a8.5 8.5 0 0 1 0-13M8.5 16a5 5 0 0 1 0-8M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 18.5a8.5 8.5 0 0 0 0-13M15.5 16a5 5 0 0 0 0-8" />
        </svg>
      );
    case "gift":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M4 8h16v4H4zM12 8v13M12 8H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zM12 8h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
        </svg>
      );
    case "login":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5M14 12h7M17 9l4 3-4 3" />
        </svg>
      );
    case "link":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.1.1l1.8-1.8a5 5 0 0 0-7.1-7.1L10.5 5.5M14 11a5 5 0 0 0-7.1-.1L5.1 12.7a5 5 0 0 0 7.1 7.1l1.3-1.3" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
        </svg>
      );
    case "grid":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.6 13.4 12.7 21.3a2 2 0 0 1-2.8 0L3 14.4V4h10.4l7.2 7.2a2 2 0 0 1 0 2.2zM8 8h.01" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4zM4 7l8 6 8-6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3z" />
        </svg>
      );
    case "external":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M10 14 20 4M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      );
    default:
      return (
        <svg {...props} aria-hidden>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}

const plans = [
  {
    name: "Free trial",
    price: "₹0",
    detail: "7 days · 1 client",
    blurb: "Taste the full approval → publish loop before you commit.",
    perks: [
      "1 client profile only",
      "Up to 2 social connections",
      "Client approvals on-platform",
      "Compose + publish during trial",
    ],
    highlight: false,
    badge: "Start here",
  },
  {
    name: "Starter",
    price: "₹499",
    detail: "3 clients · any 3 socials",
    blurb: "Lean teams who need speed without opening every network yet.",
    perks: [
      "3 client profiles",
      "Any 3 social networks",
      "Client approvals + feedback",
      "Multi-network compose & schedule",
      "Basic publishing pulse",
    ],
    highlight: false,
    badge: null,
  },
  {
    name: "Growth",
    price: "₹999",
    detail: "6 clients · everything unlocked",
    blurb: "Full platform — all networks, approvals, analytics, and room to scale.",
    perks: [
      "6 client profiles",
      "All 7 social networks",
      "Full client approval workflow",
      "Unlimited publish across connected accounts*",
      "Full analytics pulse + media library",
    ],
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Agency Pro",
    price: "₹1,499",
    detail: "9 clients · everything +",
    blurb: "Same full unlock as Growth with more client seats for busy rosters.",
    perks: [
      "9 client profiles",
      "All 7 social networks",
      "Everything in Growth",
      "Higher team & storage quotas",
    ],
    highlight: false,
    badge: null,
  },
  {
    name: "Custom",
    price: "Let's talk",
    detail: "Negotiate quota",
    blurb: "Larger agencies — seats, socials, and limits tailored with us.",
    perks: [
      "Client seats by agreement",
      "All networks available",
      "Everything unlocked",
      "Priority onboarding help",
    ],
    highlight: false,
    badge: null,
  },
];

const highlightCards = [
  {
    icon: "bolt",
    color: "#00D2FF",
    title: "Faster campaigns",
    body: "Cut tab-hopping and ship once across networks.",
  },
  {
    icon: "check",
    color: "#3DDC97",
    title: "On-platform approvals",
    body: "Clients review and green-light without passwords.",
  },
  {
    icon: "broadcast",
    color: "#FF6B6B",
    title: "Multi-network publish",
    body: "Schedule or go live on the channels your plan unlocks.",
  },
  {
    icon: "gift",
    color: "#F0C14A",
    title: "7-day free trial",
    body: "1 client profile to prove the flow before you pay.",
  },
];

export default async function HomePage() {
  const brand = await fetchPublicBranding();

  return (
    <main className="landing relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-glow landing-glow-a" />
        <div className="landing-glow landing-glow-b" />
        <div className="landing-grid" />
      </div>

      <SiteHeader logoUrl={brand.logoUrl} platformName={brand.platformName} homeAnchors />

      <section className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24">
        <div className="landing-fade-up">
          <p className="landing-eyebrow inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em]">
            <span className="landing-live-dot" aria-hidden />
            Broadcast-ready social OS
          </p>
          <h1 className="font-display mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            One spark.
            <span className="landing-heading-accent"> Every feed.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-content-muted sm:text-lg">
            SR Social Hub turns scattered social ops into a single neon command — draft, approve, and
            publish across the networks that actually move your brands.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="landing-cta px-6 py-3.5 text-sm font-semibold">
              Enter the hub
            </Link>
            <a
              href="#pricing"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:border-brand-primary/40 hover:bg-white/10"
            >
              Explore plans
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {socialNetworks.map((s, i) => (
              <span
                key={s.name}
                className="landing-social-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  ["--chip-i" as string]: i,
                  color: s.color,
                  borderColor: `${s.color}55`,
                  background: `linear-gradient(135deg, ${s.color}22, transparent 70%)`,
                  boxShadow: `0 0 18px ${s.color}22`,
                }}
              >
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: `${s.color}33`, color: s.color }}
                >
                  <SocialGlyph name={s.name} />
                </span>
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="landing-hero-stage relative mx-auto aspect-square w-full max-w-[480px] sm:max-w-[520px]">
          <div className="landing-orbit-ring" aria-hidden />
          <div className="landing-orbit-ring landing-orbit-ring-slow" aria-hidden />
          <div className="landing-social-orbit" aria-hidden>
            {socialNetworks.map((s, i) => (
              <div
                key={s.name}
                className="landing-social-slot"
                style={{ ["--i" as string]: i, ["--n" as string]: socialNetworks.length }}
              >
                <span
                  className="landing-social-bubble"
                  style={{
                    background: `linear-gradient(145deg, ${s.color}, ${s.color}cc)`,
                    boxShadow: `0 0 22px ${s.color}66`,
                    color: s.name === "X" || s.name === "Threads" ? "#0a0a0a" : "#fff",
                  }}
                  title={s.name}
                >
                  <SocialGlyph name={s.name} />
                </span>
              </div>
            ))}
          </div>
          <div className="absolute inset-[14%] z-10 overflow-hidden rounded-full border border-white/15 shadow-[0_0_60px_rgba(0,210,255,0.35)] ring-2 ring-brand-primary/30">
            <Image
              src={brand.logoUrl}
              alt={`${brand.platformName} neon brand mark`}
              width={640}
              height={640}
              className="h-full w-full scale-110 object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/10 bg-black/30 py-6">
        <div className="landing-marquee" aria-hidden>
          <div className="landing-marquee-track">
            {[...socialNetworks, ...socialNetworks, ...socialNetworks].map((s, i) => (
              <span
                key={`${s.name}-${i}`}
                className="landing-marquee-item inline-flex items-center gap-2.5"
                style={{ color: s.color }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
                  style={{
                    background: `linear-gradient(145deg, ${s.color}, ${s.color}bb)`,
                    borderColor: `${s.color}88`,
                    boxShadow: `0 0 16px ${s.color}44`,
                    color: s.name === "X" || s.name === "Threads" ? "#0a0a0a" : "#fff",
                  }}
                >
                  <SocialGlyph name={s.name} />
                </span>
                <span className="font-semibold tracking-[0.16em]">{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlightCards.map((card) => (
            <div
              key={card.title}
              className="landing-mosaic-cell rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div
                className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border"
                style={{
                  color: card.color,
                  borderColor: `${card.color}55`,
                  background: `linear-gradient(145deg, ${card.color}30, transparent 70%)`,
                  boxShadow: `0 0 24px ${card.color}22`,
                }}
              >
                <FeatureIcon name={card.icon} className="h-5 w-5" />
              </div>
              <h3 className="landing-heading font-display text-base font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-content-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
            What you get
          </p>
          <h2 className="landing-heading font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built to shrink turnaround — and keep clients in the loop.
          </h2>
          <p className="mt-4 text-base leading-7 text-content-muted">
            SR Social Hub is the command center where faster drafting, on-platform client approvals,
            and multi-network publishing replace seven browser tabs and endless WhatsApp markups.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="landing-feature landing-feature-hover">
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                style={{
                  color: f.color,
                  borderColor: `${f.color}55`,
                  background: `linear-gradient(145deg, ${f.color}28, transparent 70%)`,
                  boxShadow: `0 0 24px ${f.color}22`,
                }}
              >
                <FeatureIcon name={f.icon} />
              </div>
              <h3 className="landing-heading font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm leading-6 text-content-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-card/40">
          <div className="relative overflow-hidden px-6 py-10 sm:px-10">
            <div className="pointer-events-none absolute inset-0 landing-how-mesh" aria-hidden />
            <div className="pointer-events-none absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-brand-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute right-8 top-6 h-28 w-28 rounded-full bg-brand-secondary/25 blur-2xl" />
            <div className="relative max-w-xl">
              <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
                How it flows
              </p>
              <h2 className="landing-heading font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Three beats from blank to broadcast.
              </h2>
            </div>
          </div>
          <ol className="grid gap-0 border-t border-white/10 md:grid-cols-3">
            {steps.map((s, idx) => (
              <li
                key={s.n}
                className={`bg-ink-card/60 p-6 sm:p-8 ${idx > 0 ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
                    style={{
                      color: s.color,
                      borderColor: `${s.color}55`,
                      background: `linear-gradient(145deg, ${s.color}28, transparent)`,
                      boxShadow: `0 0 20px ${s.color}25`,
                    }}
                  >
                    <FeatureIcon name={s.icon} />
                  </span>
                  <span className="font-display text-3xl font-semibold text-transparent bg-clip-text landing-gradient-text">
                    {s.n}
                  </span>
                </div>
                <h3 className="landing-heading mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-content-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
            Plans &amp; availability
          </p>
          <h2 className="landing-heading font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Start free. Unlock networks as you grow.
          </h2>
          <p className="mt-4 text-base leading-7 text-content-muted">
            7-day trial with 1 client. Starter opens any 3 socials. Growth (₹999) unlocks the full
            platform — every network and feature. Agency Pro adds more seats; Custom is by
            negotiation.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`landing-plan flex flex-col rounded-2xl border p-6 transition duration-300 ${
                plan.highlight
                  ? "border-brand-primary/40 bg-gradient-to-b from-brand-primary/15 to-transparent shadow-[0_0_40px_rgba(0,210,255,0.12)]"
                  : "border-white/10 bg-white/[0.03] hover:border-brand-secondary/35"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-content-muted">
                  {plan.name}
                </p>
                {plan.badge ? (
                  <span className="rounded-full border border-brand-primary/40 bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                    {plan.badge}
                  </span>
                ) : null}
              </div>
              <p className="font-display mt-3 text-3xl font-semibold text-white">{plan.price}</p>
              <p className="mt-1 text-sm text-brand-primary">{plan.detail}</p>
              <p className="mt-3 text-sm leading-6 text-content-muted">{plan.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2 border-t border-white/10 pt-4 text-sm text-content-muted">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-content-muted">
          *Connected-account limits apply per plan quota. Growth and above include all seven
          networks with full feature access.
        </p>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-white/10 bg-ink-card/50 p-8">
            <div className="pointer-events-none absolute inset-0 landing-how-mesh" aria-hidden />
            <div className="relative flex h-full flex-col items-center justify-center gap-8 text-center">
              <Image
                src="/brand/logo-mark.png"
                alt={brand.platformName}
                width={160}
                height={160}
                className="h-36 w-36 rounded-full object-cover ring-2 ring-brand-primary/40 shadow-[0_0_40px_rgba(0,210,255,0.3)]"
              />
              <div>
                <p className="font-display text-xl font-semibold text-white">{brand.platformName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brand-primary">
                  All-in-one social OS
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {socialNetworks.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                    style={{
                      color: s.name === "X" || s.name === "Threads" ? "#0a0a0a" : "#fff",
                      background: `linear-gradient(145deg, ${s.color}, ${s.color}bb)`,
                      borderColor: `${s.color}66`,
                      boxShadow: `0 0 16px ${s.color}33`,
                    }}
                    title={s.name}
                  >
                    <SocialGlyph name={s.name} />
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="landing-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em]">
              Why we exist
            </p>
            <h2 className="landing-heading font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for teams who broadcast for a living.
            </h2>
            <p className="mt-4 text-base leading-7 text-content-muted">
              We designed SR Social Hub for agencies and in-house crews tired of password chaos and
              seven half-finished drafts. Strategy, approvals, and live publish share one neon
              heartbeat — so every brand story ships with clarity.
            </p>
            <p className="mt-4 text-base leading-7 text-content-muted">
              From first spark to final post, the product stays one composition: connect, create,
              approve, broadcast.
            </p>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-6 pb-8 pt-8 sm:pt-12">
        <ContactForm supportEmail={brand.supportEmail} />
      </section>

      <SiteFooter
        platformName={brand.platformName}
        supportEmail={brand.supportEmail}
        logoUrl="/brand/logo-mark.png"
        homeAnchors
      />
    </main>
  );
}
