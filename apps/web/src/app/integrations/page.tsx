import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Integration URLs · SR Social Hub",
  description: "Public website, API, OAuth callback, and social connection URLs for SR Social Hub.",
};

const WEB = "https://srsocialhub.in";
const API = "https://api.srsocialhub.in";

const rows: Array<{ label: string; url: string; note: string }> = [
  {
    label: "1. Frontend website URL",
    url: WEB,
    note: "Live Next.js app (login, admin, privacy, social UI).",
  },
  {
    label: "2. Backend / API base URL",
    url: `${API}/api/v1`,
    note: "NestJS API base. Health: /api/v1/health. Deploy API on this host/subdomain.",
  },
  {
    label: "3. Social account connection page",
    url: `${WEB}/app/{companyId}/social-accounts`,
    note: "Agency view. Client view: /client/{clientId}/social-accounts. Replace IDs after login.",
  },
  {
    label: "4. Facebook OAuth start URL",
    url: `${WEB}/client/{clientId}/social-accounts?connect=FACEBOOK`,
    note: "Opens Connect for Facebook after login. API: POST /companies/{companyId}/clients/{clientId}/social-accounts/FACEBOOK/connect",
  },
  {
    label: "5. Instagram OAuth start URL",
    url: `${WEB}/client/{clientId}/social-accounts?connect=INSTAGRAM`,
    note: "Opens Connect for Instagram after login. API platform code: INSTAGRAM.",
  },
  {
    label: "6. OAuth callback URL",
    url: `${API}/api/v1/oauth/callback`,
    note: "Register this exact redirect URI in Meta / Google / etc. developer consoles.",
  },
  {
    label: "7. Disconnect account URL",
    url: `${API}/api/v1/social-accounts/{accountId}/disconnect`,
    note: "POST with Bearer token. UI disconnect is on the social accounts page.",
  },
];

export default function IntegrationsPage() {
  return (
    <LegalShell title="Integration & OAuth URLs" updated="4 November 2026">
      <p>
        Use these production URLs for Meta / Instagram app settings and internal QA. Frontend is live
        on <Link href={WEB}>{WEB}</Link>. The API host must be deployed at{" "}
        <span className="font-mono text-white">{API}</span> (or update this page if you choose a
        different API domain).
      </p>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-white/10 bg-ink-elevated p-4">
            <p className="text-sm font-semibold text-white">{row.label}</p>
            <p className="mt-2 break-all font-mono text-xs text-brand-secondary">{row.url}</p>
            <p className="mt-2 text-sm text-content-muted">{row.note}</p>
          </div>
        ))}
      </div>

      <h2>Related legal URLs</h2>
      <ul>
        <li>
          <Link href="/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/terms">Terms of Service</Link>
        </li>
        <li>
          <Link href="/delete-account">Delete Account / Data</Link>
        </li>
        <li>
          <Link href="/support">Support</Link>
        </li>
      </ul>

    </LegalShell>
  );
}
