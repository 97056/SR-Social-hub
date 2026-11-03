import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy · SR Social Hub",
  description: "How SR Social Hub collects, uses, and protects account and social connection data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="3 November 2026">
      <p>
        This Privacy Policy explains how SR Social Hub (“we”, “us”, “our”) handles information when
        you use our social media management platform for agencies and businesses.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>Account details such as name, email address, and company or client workspace membership.</li>
        <li>
          Social account connection metadata (platform, account name/username, page identifiers) when
          you authorize a network.
        </li>
        <li>
          Encrypted OAuth tokens and related connection status needed to publish or manage content on
          your behalf.
        </li>
        <li>Content you create in the product (captions, media uploads, schedules, approvals).</li>
        <li>Billing and subscription records when you subscribe to a plan.</li>
        <li>Basic product usage and diagnostics needed to operate and secure the service.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide authentication, workspaces, approvals, scheduling, and publishing features.</li>
        <li>Connect to social platforms you authorize using official OAuth flows.</li>
        <li>Enforce plan quotas, billing, security, and support requests.</li>
        <li>Improve reliability and prevent abuse.</li>
      </ul>
      <p>
        We do not sell personal data. We do not use connected social content to train public AI models.
        Optional AI drafting features use your prompts and brand context only to generate editable
        suggestions inside your workspace.
      </p>

      <h2>3. Social platform permissions</h2>
      <p>
        When you connect Facebook, Instagram, LinkedIn, X, YouTube, TikTok, Pinterest, Threads, Google
        Business Profile, or other supported networks, we request only the permissions needed for
        connection, publishing, and account management as configured for your workspace. You can
        disconnect accounts in the product at any time; you may also revoke access in the provider’s
        security settings.
      </p>

      <h2>4. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>Social platforms you connect, to complete authorized actions.</li>
        <li>Infrastructure and payment processors required to run the service.</li>
        <li>Authorities when legally required.</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        We retain account and workspace data while your organization uses SR Social Hub. Tokens are
        removed or invalidated when you disconnect an account. After account deletion requests, we
        delete or anonymize personal data within a reasonable period unless law requires longer
        retention (for example billing records).
      </p>

      <h2>6. Security</h2>
      <p>
        Secrets such as OAuth client credentials and access tokens are encrypted at rest. Access is
        restricted by role-based workspace controls. No method of transmission or storage is 100%
        secure; please use strong passwords and keep provider apps in good standing.
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>Update profile and workspace settings in the product.</li>
        <li>Disconnect social accounts.</li>
        <li>
          Request account/data deletion via{" "}
          <a className="text-brand-secondary underline" href="/delete-account">
            Delete Account / Data
          </a>
          .
        </li>
      </ul>

      <h2>8. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a className="text-brand-secondary underline" href="mailto:privacy@srsocialhub.local">
          privacy@srsocialhub.local
        </a>
        . Support:{" "}
        <a className="text-brand-secondary underline" href="/support">
          Support
        </a>
        .
      </p>
    </LegalShell>
  );
}
