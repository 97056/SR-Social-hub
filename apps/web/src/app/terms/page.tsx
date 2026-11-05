import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service · SR Social Hub",
  description: "Terms governing use of the SR Social Hub platform.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="3 November 2026">
      <p>
        These Terms of Service (“Terms”) govern access to and use of SR Social Hub. By creating an
        account or using the service, you agree to these Terms.
      </p>

      <h2>1. The service</h2>
      <p>
        SR Social Hub provides multi-tenant social media management tools including client workspaces,
        content drafting, approvals, scheduling, publishing queues, billing, and related features. Some
        features depend on third-party social platforms and may be unavailable if a provider changes
        APIs, limits access, or revokes permissions.
      </p>

      <h2>2. Accounts and workspaces</h2>
      <ul>
        <li>You must provide accurate registration information and keep credentials secure.</li>
        <li>
          Company owners are responsible for members, clients, content, and social accounts connected
          under their workspace.
        </li>
        <li>You must have authority to manage any social account you connect.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Violate platform policies of Meta, LinkedIn, X, Google, Pinterest, or others.</li>
        <li>Upload unlawful, infringing, or harmful content.</li>
        <li>Attempt unauthorized access, abuse APIs, or disrupt the service.</li>
        <li>Misrepresent AI-generated drafts as guaranteed performance outcomes.</li>
      </ul>

      <h2>4. Content and licenses</h2>
      <p>
        You retain ownership of content you submit. You grant us a limited license to host, process,
        and transmit that content solely to operate the features you use (including publishing to
        networks you authorize).
      </p>

      <h2>5. Subscriptions and trials</h2>
      <p>
        Paid plans, trials, quotas, and cancellations are described in-product. Fees are charged only
        through authorized checkout. After trial expiry or failed payment (after any grace period),
        publishing and other plan-gated actions may be restricted while billing access remains
        available.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        Social networks and payment providers are independent services. Their terms and privacy
        policies also apply when you connect or pay through them. We are not responsible for outages
        or policy enforcement by those providers.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The service is provided “as is”. We do not guarantee uninterrupted availability, delivery of
        every post, engagement results, or that AI suggestions will meet your goals. Mock/demo modes
        never claim real social publications.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, SR Social Hub is not liable for indirect, incidental,
        special, consequential, or lost-profit damages arising from use of the service or third-party
        platforms.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the service and request deletion as described on the{" "}
        <a className="text-brand-secondary underline" href="/delete-account">
          Delete Account / Data
        </a>{" "}
        page. We may suspend or terminate access for Terms violations or security risks.
      </p>

      <h2>10. Contact</h2>
      <p>
        Legal questions:{" "}
        <a className="text-brand-secondary underline" href="mailto:legal@srsocialhub.local">
          legal@srsocialhub.local
        </a>
        .
      </p>
    </LegalShell>
  );
}
