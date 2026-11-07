import Image from "next/image";
import Link from "next/link";

const socialNetworks = [
  { name: "Facebook", color: "#1877F2" },
  { name: "Instagram", color: "#E1306C" },
  { name: "LinkedIn", color: "#0A66C2" },
  { name: "X", color: "#E7E9EA" },
  { name: "YouTube", color: "#FF0033" },
  { name: "Pinterest", color: "#E60023" },
  { name: "Threads", color: "#FFFFFF" },
];

function Icon({
  name,
  className = "h-3.5 w-3.5",
}: {
  name: string;
  className?: string;
}) {
  const props = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };
  switch (name) {
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
    case "users":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4zM4 7l8 6 8-6" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
        </svg>
      );
    case "check":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5 11 14.5 15.5 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
      );
    case "login":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5M14 12h7M17 9l4 3-4 3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...props} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 3 4 14h7l-1 7 10-12h-7l1-6z" />
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

function SocialGlyph({ name }: { name: string }) {
  const common = "h-3.5 w-3.5 fill-current";
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
          <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5z" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M6.5 9.5H3.7V20h2.8zm.2-3.2a1.7 1.7 0 1 1-1.7-1.7 1.7 1.7 0 0 1 1.7 1.7zM20.3 13.2c0-2.7-1.4-4-3.4-4a3.1 3.1 0 0 0-2.8 1.5V9.5h-2.8V20h2.8v-5.9c0-.3 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.7V20h2.8z" />
        </svg>
      );
    case "X":
      return (
        <svg viewBox="0 0 24 24" className={common} aria-hidden>
          <path d="M17.6 3H20l-6.2 7.1L21 21h-5.5l-4.3-5.6L6 21H3.6l6.6-7.6L3 3h5.6l3.9 5.2L17.6 3z" />
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
          <path d="M12.2 3c-2.4 0-4.3.8-5.6 2.3C5.2 7 4.6 9 4.8 11.5c.2 2.1 1 3.9 2.3 5.1l.5.4-.2 1.4-.3 1.9 2-.9.5-.2.5.1c1 .3 2 .4 3 .4 2.4 0 4.3-.8 5.6-2.3 1.4-1.6 2-3.7 1.8-6.1-.2-4.2-3.5-7.3-8.3-7.3z" />
        </svg>
      );
  }
}

export function SiteHeader({
  logoUrl,
  platformName,
  homeAnchors = false,
}: {
  logoUrl: string;
  platformName: string;
  homeAnchors?: boolean;
}) {
  const nav = (
    [
      [homeAnchors ? "#features" : "/#features", "Features", "grid", "#00D2FF"],
      [homeAnchors ? "#pricing" : "/#pricing", "Pricing", "tag", "#C026FF"],
      [homeAnchors ? "#about" : "/#about", "About", "users", "#3DDC97"],
      [homeAnchors ? "#contact" : "/#contact", "Contact", "mail", "#F0C14A"],
    ] as const
  );

  return (
    <header className="mx-auto max-w-6xl px-6 pt-5">
      <div className="landing-header flex items-center justify-between gap-4 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[0_0_40px_rgba(0,210,255,0.08)] backdrop-blur-xl sm:px-5">
        <Link
          href="/"
          className="landing-logo-pulse relative inline-flex shrink-0"
          aria-label={platformName}
          title={`${platformName} home`}
        >
          <Image
            src={logoUrl}
            alt={platformName}
            title={platformName}
            width={88}
            height={88}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-primary/45 sm:h-[4.5rem] sm:w-[4.5rem]"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-content-muted md:flex">
          {nav.map(([href, label, icon, color]) => (
            <Link
              key={href}
              href={href}
              title={`${label} — ${platformName}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 transition hover:bg-white/5 hover:text-white"
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10"
                style={{ color, background: `${color}18` }}
              >
                <Icon name={icon} />
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/register"
            title={`Register on ${platformName}`}
            className="hidden rounded-full border border-white/15 px-3.5 py-2 text-sm text-content-muted transition hover:border-white/30 hover:text-white sm:inline-flex"
          >
            Register
          </Link>
          <Link
            href="/login"
            title={`Sign in to ${platformName}`}
            className="landing-cta px-4 py-2.5 text-sm font-semibold sm:px-5"
          >
            Enter hub
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  logoUrl = "/brand/logo-mark.png",
  platformName,
  supportEmail,
  homeAnchors = false,
}: {
  logoUrl?: string;
  platformName: string;
  supportEmail: string;
  homeAnchors?: boolean;
}) {
  const prefix = homeAnchors ? "#" : "/#";
  const columns = [
    {
      title: "Explore",
      color: "#00D2FF",
      links: [
        { href: `${prefix}features`, label: "Features", icon: "grid" },
        { href: `${prefix}pricing`, label: "Pricing", icon: "tag" },
        { href: `${prefix}how`, label: "How it flows", icon: "spark" },
        { href: `${prefix}about`, label: "About", icon: "users" },
      ],
    },
    {
      title: "Connect",
      color: "#C026FF",
      links: [
        { href: `${prefix}contact`, label: "Contact", icon: "mail" },
        { href: "/support", label: "Support", icon: "check" },
        { href: "/login", label: "Sign in", icon: "login" },
        { href: "/register", label: "Register", icon: "users" },
      ],
    },
    {
      title: "Trust",
      color: "#3DDC97",
      links: [
        { href: "/privacy", label: "Privacy", icon: "shield" },
        { href: "/terms", label: "Terms", icon: "check" },
        { href: "/delete-account", label: "Delete account", icon: "bolt" },
      ],
    },
  ] as const;

  return (
    <footer className="landing-footer relative mt-10 overflow-hidden border-t border-white/10 bg-[#060914]">
      <div className="pointer-events-none absolute inset-0 -z-10 landing-footer-glow" aria-hidden />
      <div className="landing-footer-beam" aria-hidden />

      <div className="mx-auto max-w-6xl px-6 pt-14">
        <div className="flex flex-col gap-8 border-b border-white/10 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <Image
                src={logoUrl}
                alt={platformName}
                title={platformName}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover ring-1 ring-brand-primary/50"
              />
              <div>
                <p className="font-display text-lg font-semibold tracking-wide text-white">{platformName}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">
                  Spark · Approve · Broadcast
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-content-muted">
              The all-in-one social media management platform for teams who refuse to lose the plot
              between draft and publish.
            </p>
          </div>
          <Link
            href="/login"
            title={`Sign in to ${platformName}`}
            className="landing-cta w-fit px-6 py-3.5 text-sm font-semibold"
          >
            Enter the hub
          </Link>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <p
                className="landing-footer-heading text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: col.color }}
              >
                {col.title}
              </p>
              <ul className="mt-4 space-y-3 text-sm text-content-muted">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      title={`${l.label} — ${platformName}`}
                      className="landing-footer-link inline-flex items-center gap-2.5"
                    >
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10"
                        style={{ color: col.color, background: `${col.color}18` }}
                      >
                        <Icon name={l.icon} />
                      </span>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="landing-footer-heading text-xs font-semibold uppercase tracking-[0.2em] text-[#F0C14A]">
              Networks
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {socialNetworks.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    color: s.color,
                    borderColor: `${s.color}44`,
                    background: `${s.color}14`,
                  }}
                >
                  <SocialGlyph name={s.name} />
                  {s.name}
                </span>
              ))}
            </div>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-5 inline-flex items-center gap-2 text-sm text-brand-primary transition hover:text-white"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-brand-primary/30 bg-brand-primary/10">
                <Icon name="mail" />
              </span>
              {supportEmail}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-content-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {platformName}. Crafted for the always-on feed.
          </p>
          <p>
            Developed by{" "}
            <a
              href="https://solynx.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-primary transition hover:text-white"
            >
              Solynx Innovations
              <Icon name="external" className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
