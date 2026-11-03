import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Support · SR Social Hub",
  description: "Contact and support information for SR Social Hub.",
};

export default function SupportPage() {
  return (
    <LegalShell title="Support" updated="3 November 2026">
      <p>
        Need help with onboarding, OAuth connections, billing, or account deletion? Reach us using
        the contacts below.
      </p>

      <h2>Contact</h2>
      <ul>
        <li>
          General support:{" "}
          <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.local">
            support@srsocialhub.local
          </a>
        </li>
        <li>
          Privacy / deletion:{" "}
          <a className="text-brand-secondary underline" href="mailto:privacy@srsocialhub.local">
            privacy@srsocialhub.local
          </a>
        </li>
        <li>
          Legal:{" "}
          <a className="text-brand-secondary underline" href="mailto:legal@srsocialhub.local">
            legal@srsocialhub.local
          </a>
        </li>
      </ul>

      <h2>Common links for developer consoles</h2>
      <ul>
        <li>
          Privacy Policy:{" "}
          <a className="text-brand-secondary underline" href="/privacy">
            /privacy
          </a>
        </li>
        <li>
          Terms of Service:{" "}
          <a className="text-brand-secondary underline" href="/terms">
            /terms
          </a>
        </li>
        <li>
          Delete account / user data:{" "}
          <a className="text-brand-secondary underline" href="/delete-account">
            /delete-account
          </a>
        </li>
        <li>
          App logo:{" "}
          <a className="text-brand-secondary underline" href="/brand/logo.svg">
            /brand/logo.svg
          </a>
        </li>
      </ul>

      <h2>Local demo logins</h2>
      <p className="text-xs">
        Admin, agency, and client seed accounts are listed in the setup docs. Do not use demo
        credentials in production.
      </p>
    </LegalShell>
  );
}
