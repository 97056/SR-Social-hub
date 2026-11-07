import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service · SR Social Hub",
  description:
    "Terms governing accounts, workspaces, social publishing, billing, acceptable use, and liability for SR Social Hub.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="8 November 2026">
      <p>
        These Terms of Service (“Terms”) are the rules of the road for using SR Social Hub. By
        creating an account, inviting teammates, connecting social networks, or otherwise using the
        service, you agree to these Terms. If you are accepting them for a company, you confirm you
        have authority to bind that company.
      </p>

      <h2>1. What the service is</h2>
      <p>
        SR Social Hub provides multi-tenant social media operations tools: company and client
        workspaces, media libraries, drafting, approvals, scheduling, publishing queues, billing,
        notifications, and related features. Some features depend on third-party networks (Meta,
        LinkedIn, X, Google/YouTube, Pinterest, Threads, and others). Those networks can change APIs,
        rate limits, app review status, or permissions at any time. When that happens, affected
        features may slow down, require reconnect, or become temporarily unavailable. That is outside
        our sole control.
      </p>

      <h2>2. Accounts, roles, and responsibility</h2>
      <ul>
        <li>Provide accurate registration details and keep login credentials confidential.</li>
        <li>
          Company owners and admins are responsible for members they invite, clients they create,
          content they approve, and social accounts connected under their workspace.
        </li>
        <li>
          You must have legal authority to manage every social account you connect and every piece of
          content you publish.
        </li>
        <li>
          Client portal users may only use the product for the client workspace they were invited to.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use SR Social Hub to:</p>
      <ul>
        <li>Break the law or violate another person’s rights.</li>
        <li>
          Violate the terms, community standards, or advertising policies of any connected social
          platform.
        </li>
        <li>Upload malware, scrape the product without permission, or attack our systems.</li>
        <li>Impersonate others, spam, or run deceptive engagement schemes.</li>
        <li>
          Misrepresent AI or analysis suggestions as guaranteed reach, rankings, revenue, or legal
          advice.
        </li>
        <li>Resell access to the product except as expressly allowed in a written enterprise deal.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that create risk for the platform, other customers, or
        the public.
      </p>

      <h2>4. Content ownership and license</h2>
      <p>
        You keep ownership of content you upload or create. You grant SR Social Hub a limited,
        worldwide, non-exclusive license to host, process, transmit, display, and publish that content
        solely to operate the features you use — including sending it to social platforms you
        authorize. We do not claim ownership of your brand assets.
      </p>

      <h2>5. Third-party platforms and publishing results</h2>
      <p>
        Publishing success depends on valid tokens, correct account types (for example Facebook Pages
        or Instagram professional accounts), media requirements, and provider approval. A “queued” or
        “sent” job can still fail if the provider rejects the post. You are responsible for reviewing
        captions, media, disclosures, and targeting before approval. SR Social Hub is a workflow
        tool; it does not replace your compliance review.
      </p>

      <h2>6. Trials, plans, and payments</h2>
      <p>
        Free trials and paid plans are governed by the quotas shown in the product and managed by
        Super Admin settings. Fees are charged through our payment partner when you upgrade. Taxes may
        apply. Unless required by law or stated otherwise at checkout, fees are non-refundable once a
        paid period begins. If a payment fails, publishing or other features may be restricted until
        the account is brought current.
      </p>

      <h2>7. Confidentiality</h2>
      <p>
        Each party should treat non-public business information learned through the service as
        confidential and use it only to perform under these Terms, except where disclosure is required
        by law or already public through no fault of the receiving party.
      </p>

      <h2>8. Privacy</h2>
      <p>
        Personal data handling is described in our{" "}
        <a className="text-brand-secondary underline" href="/privacy">
          Privacy Policy
        </a>
        , which forms part of these Terms by reference.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        The SR Social Hub software, design system, documentation, and trademarks remain our property
        (or our licensors’). You may not copy, reverse engineer, or create derivative works of the
        service except to the extent the law forbids that restriction.
      </p>

      <h2>10. Mistakes, accuracy, and product limits</h2>
      <p>
        Software can make mistakes. SR Social Hub may show wrong statuses, delayed queues, incomplete
        profiles, failed or partial publishes, outdated analytics, incorrect plan counters, or AI /
        analysis suggestions that do not match the real world. Third-party platforms can also reject
        content, revoke tokens, or change rules without notice. You agree to double-check important
        captions, media, schedules, billing amounts, and account connections before you rely on them.
        Nothing in the product is a guarantee of reach, revenue, compliance, or uninterrupted service.
      </p>

      <h2>11. Complaints, tickets, and how we help</h2>
      <p>
        If something goes wrong — a bug, a billing doubt, a privacy request, a publishing failure, or
        any other issue — raise it with us so we can investigate. The fastest path is:
      </p>
      <ul>
        <li>
          Email{" "}
          <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
            support@srsocialhub.in
          </a>{" "}
          with your account email, company or client name, what you expected, what happened, and
          screenshots or job IDs when you have them.
        </li>
        <li>
          Or open a complaint / support ticket through{" "}
          <a className="text-brand-secondary underline" href="/support">
            Support
          </a>
          .
        </li>
      </ul>
      <p>
        We will use reasonable efforts to acknowledge genuine tickets and work toward a fix or a clear
        explanation. Filing a ticket does not create a promise of refund, damages, or a specific
        timeline beyond what the law requires. Urgent security or data-deletion requests should say so
        in the subject line.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The website, APIs, dashboards, mobile or desktop apps, APKs, installers, browser extensions,
        and any other software published under the srsocialhub.in domain (or official SR Social Hub
        brand channels) are provided on an “as is” and “as available” basis. To the fullest extent
        allowed by law, we disclaim warranties of merchantability, fitness for a particular purpose,
        and non-infringement. We do not warrant uninterrupted uptime, error-free publishing, accurate
        forecasts, or that third-party APIs will remain compatible forever.
      </p>

      <h2>13. No responsibility for issues arising from use</h2>
      <p>
        By using this website or any related app / APK / client tied to this domain, you acknowledge
        that SR Social Hub, its operators, owners, employees, contractors, and the organization behind
        the product are <strong>not responsible</strong> for losses, disputes, account bans, rejected
        posts, reputational harm, business interruption, device problems, data loss, or other issues
        you may face because of:
      </p>
      <ul>
        <li>Bugs, downtime, maintenance windows, or incorrect displays in our product.</li>
        <li>Actions or failures of Meta, LinkedIn, X, Google/YouTube, Pinterest, Threads, payment
          providers, hosting providers, or other third parties.</li>
        <li>Content you or your team wrote, approved, scheduled, or published.</li>
        <li>Misconfigured connections, weak passwords, unauthorized teammate invites, or device
          malware outside our control.</li>
        <li>Downloading or installing any APK or app distributed for this product, including install
          conflicts, OS permission prompts, or store policy outcomes.</li>
      </ul>
      <p>
        Where local law still gives you non-waivable consumer rights, those rights stay intact. This
        section is meant to be read together with the limitation of liability below.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, SR Social Hub and its operators will not be liable for
        indirect, incidental, special, consequential, exemplary, or lost-profit damages, or for loss
        of data, goodwill, or business opportunity. Our aggregate liability arising out of these Terms
        or the service is limited to the fees you paid us for the service in the three (3) months
        before the claim (or INR 5,000 if you are on a free trial). Some jurisdictions do not allow
        certain limitations; in those places, our liability is limited to the maximum extent allowed.
      </p>

      <h2>15. Indemnity</h2>
      <p>
        You will defend and indemnify SR Social Hub against claims arising from your content, your
        connected accounts, your misuse of the service, or your violation of law or these Terms,
        including reasonable legal fees.
      </p>

      <h2>16. Suspension and termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate access for breach,
        non-payment, legal risk, or prolonged inactivity on trial accounts. After termination, we may
        delete workspace data according to our retention practices, except records we must keep by
        law.
      </p>

      <h2>17. Governing law</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-law rules.
        Courts in India will have exclusive jurisdiction, except where consumer protection law gives
        you mandatory rights in your home country.
      </p>

      <h2>18. Changes</h2>
      <p>
        We may update these Terms as the product evolves. Material changes will be marked with a new
        date and, where practical, communicated to account owners. Continued use after the update
        means you accept the revised Terms.
      </p>

      <h2>19. Contact</h2>
      <p>
        Questions about these Terms, or to file a complaint / ticket:{" "}
        <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
          support@srsocialhub.in
        </a>{" "}
        ·{" "}
        <a className="text-brand-secondary underline" href="/support">
          Support
        </a>
        .
      </p>
    </LegalShell>
  );
}
