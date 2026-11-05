import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Delete Account & User Data · SR Social Hub",
  description:
    "Instructions for deleting your SR Social Hub account and associated user data, including social connection data.",
};

export default function DeleteAccountPage() {
  return (
    <LegalShell title="Delete Account & User Data" updated="3 November 2026">
      <p>
        This page explains how to delete your SR Social Hub account and related personal data. Social
        platforms (including Meta) may ask for this URL when you configure an app.
      </p>

      <h2>1. In-app deletion (preferred)</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Sign in at the company or client login.</li>
        <li>Disconnect social accounts under Social Accounts (revokes local tokens).</li>
        <li>
          Ask your company owner/admin to remove your membership, or contact support to close the
          workspace.
        </li>
        <li>
          Email{" "}
          <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
            support@srsocialhub.in
          </a>{" "}
          from your registered email with subject <strong>Account deletion request</strong>.
        </li>
      </ol>

      <h2>2. Email deletion request</h2>
      <p>Include:</p>
      <ul>
        <li>Full name and registered email</li>
        <li>Company / client workspace name (if known)</li>
        <li>Whether you also want media assets and posts removed</li>
      </ul>
      <p>
        We will verify ownership and process the request. Typical completion window: <strong>up to 30
        days</strong> (often sooner for local/demo environments).
      </p>

      <h2>3. What we delete</h2>
      <ul>
        <li>User profile and login credentials</li>
        <li>Membership records for company/client workspaces</li>
        <li>Social connection records and encrypted tokens stored by SR Social Hub</li>
        <li>Notifications and AI usage records tied to your user id</li>
        <li>Content authored solely by you when requested and not required for another account’s records</li>
      </ul>

      <h2>4. What may remain</h2>
      <ul>
        <li>Billing invoices required for tax/compliance</li>
        <li>Aggregated analytics that no longer identify you</li>
        <li>
          Content that remains on third-party social networks after publishing (delete those posts
          directly on each platform if needed)
        </li>
      </ul>

      <h2>5. Revoking provider access</h2>
      <p>
        After disconnecting in SR Social Hub, also remove the app from the provider’s account settings
        (for example Facebook Settings → Business Integrations, Google Account → Third-party access).
      </p>

      <h2>6. Meta / Facebook data deletion callback</h2>
      <p>
        For Meta app review, use this page as the <strong>User data deletion</strong> instructions URL.
        If a signed callback endpoint is later required in production, it will be documented here as:
      </p>
      <p className="rounded-xl border border-white/10 bg-ink-elevated px-4 py-3 font-mono text-xs text-white">
        https://&lt;your-api-host&gt;/api/v1/privacy/data-deletion
      </p>
      <p className="text-xs">
        Local development instructions URL:{" "}
        <span className="font-mono text-white">http://localhost:3000/delete-account</span>
      </p>

      <h2>7. Contact</h2>
      <p>
        <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
          support@srsocialhub.in
        </a>{" "}
        ·{" "}
        <a className="text-brand-secondary underline" href="/support">
          Support
        </a>{" "}
        ·{" "}
        <a className="text-brand-secondary underline" href="/privacy">
          Privacy Policy
        </a>
      </p>
    </LegalShell>
  );
}
