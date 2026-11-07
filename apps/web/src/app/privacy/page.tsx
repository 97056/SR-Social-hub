import type { Metadata } from "next";
import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy · SR Social Hub",
  description:
    "How SR Social Hub collects, uses, stores, shares, and deletes personal and social-account data for agencies and client workspaces.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="8 November 2026">
      <p>
        This Privacy Policy is written for the people who actually use SR Social Hub — agency owners,
        teammates, client approvers, and anyone whose social accounts get connected through the
        product. It explains what we collect, why we need it, where it goes, how long we keep it, and
        what control you have. We try to keep the language plain on purpose. If a sentence sounds
        vague, treat the clearer operational description later in this page as the controlling meaning.
      </p>

      <h2>1. Who we are</h2>
      <p>
        SR Social Hub is a social media operations product for agencies and brands. It helps teams
        draft content, collect approvals, schedule posts, connect networks, and publish to platforms
        you authorize. For privacy questions, contact{" "}
        <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
          support@srsocialhub.in
        </a>
        .
      </p>

      <h2>2. The information we collect</h2>
      <p>We only collect what we need to run the product securely and as designed:</p>
      <ul>
        <li>
          <strong>Account identity.</strong> Name, email address, optional phone number, password
          (stored as a secure hash — we never store your raw password), role, and login history needed
          for security.
        </li>
        <li>
          <strong>Workspace data.</strong> Company and client names, branding fields, plan and usage
          limits, team memberships, invitations, and support tickets you send us.
        </li>
        <li>
          <strong>Social connection metadata.</strong> When you connect a network, we store platform,
          account or page name, username/handle, external account identifiers, connection status, and
          the scopes you approved.
        </li>
        <li>
          <strong>Encrypted access credentials.</strong> OAuth access and refresh tokens are encrypted
          at rest so the product can publish or manage content you asked us to send. We do not use
          those tokens for advertising resale.
        </li>
        <li>
          <strong>Content you create.</strong> Captions, media files, schedules, approval decisions,
          comments inside the product, and publishing results returned by social platforms.
        </li>
        <li>
          <strong>Billing records.</strong> Plan selection, invoices, payment status, and provider
          payment references when you pay through our payment partner.
        </li>
        <li>
          <strong>Technical and security logs.</strong> IP address, browser type, device signals,
          timestamps, and error diagnostics used to keep the service stable and investigate abuse.
        </li>
      </ul>

      <h2>3. Why we use this information</h2>
      <ul>
        <li>To authenticate you and protect workspaces from unauthorized access.</li>
        <li>To operate client workspaces, approvals, media libraries, scheduling, and publishing.</li>
        <li>To talk to social platforms you connect through their official OAuth and APIs.</li>
        <li>To enforce plan quotas, trials, upgrades, invoices, and payment confirmation.</li>
        <li>To send transactional mail such as invites, password resets, and access credentials.</li>
        <li>To diagnose outages, prevent fraud, and improve reliability.</li>
        <li>
          To run optional analysis features (for example competitor landscape planning) using the
          business description and website details you choose to submit.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> sell personal data. We do <strong>not</strong> sell connected social
        content. We do <strong>not</strong> use your private workspace content to train public
        foundation models. If an optional drafting or analysis feature uses a model provider in the
        future, we will say so clearly and limit the payload to what you submit for that feature.
      </p>

      <h2>4. Legal bases (where applicable)</h2>
      <p>
        Depending on where you live, we rely on one or more of: performing our contract with you;
        legitimate interests in securing and improving the service; your consent for optional
        connections and features; and legal obligations such as tax or accounting retention.
      </p>

      <h2>5. Social platform permissions</h2>
      <p>
        Connecting Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, Threads, or another supported
        network means you authorize SR Social Hub to use the permissions shown on that provider’s
        consent screen. Those permissions are chosen so we can connect the account, read the profile
        details needed to identify it, and publish content you approve. You can disconnect inside SR
        Social Hub at any time. You should also revoke access in the provider’s security settings if
        you want the provider-side grant removed immediately.
      </p>
      <p>
        Social platforms are independent controllers for data they hold on their own systems. Their
        policies continue to apply to content once it is published on their networks.
      </p>

      <h2>6. Who we share data with</h2>
      <p>We share information only when it is necessary:</p>
      <ul>
        <li>Social platforms you connect, to complete authorized actions.</li>
        <li>Hosting, email, SMS, and payment processors that help us run the service.</li>
        <li>Professional advisers under confidentiality when needed for legal or accounting work.</li>
        <li>Authorities when the law requires disclosure, or to protect rights, safety, and security.</li>
      </ul>
      <p>
        Team members and client users inside your workspace can see content and accounts according to
        the roles you assign. That is intentional product behavior, not a “sale” of data.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Our infrastructure and vendors may process data in India and other countries. When we transfer
        personal data across borders, we use appropriate safeguards available for the relationship
        (contractual protections, vendor diligence, and access controls).
      </p>

      <h2>8. Retention</h2>
      <p>
        We keep account and workspace data while your organization uses SR Social Hub. Encrypted
        tokens are removed or invalidated when you disconnect an account. After a verified deletion
        request, we delete or anonymize personal data within a reasonable operational window, except
        where law requires longer retention (for example paid invoices or fraud logs). Backups roll
        off on a limited schedule and are not used as a live product database.
      </p>

      <h2>9. Security</h2>
      <p>
        We use encryption for secrets at rest, HTTPS in transit, role-based access, and operational
        monitoring. No online service can promise perfect security. You remain responsible for strong
        passwords, careful invite practices, and keeping third-party developer apps in good standing.
      </p>

      <h2>10. Children</h2>
      <p>
        SR Social Hub is built for business teams. It is not directed at children under 16 (or the
        higher age required in your region). If you believe a child created an account, contact us and
        we will take appropriate steps.
      </p>

      <h2>11. Your choices and rights</h2>
      <ul>
        <li>Update profile and workspace settings inside the product.</li>
        <li>Disconnect social accounts and revoke provider access.</li>
        <li>
          Request access, correction, or deletion through{" "}
          <a className="text-brand-secondary underline" href="/delete-account">
            Delete Account / Data
          </a>{" "}
          or by emailing support.
        </li>
        <li>
          Depending on your location, you may also have rights to object, restrict processing, or
          lodge a complaint with a supervisory authority.
        </li>
      </ul>

      <h2>12. Cookies and similar technologies</h2>
      <p>
        We use essential cookies and local storage for login sessions, theme preference, and security.
        We do not run third-party advertising trackers on the product for the purpose of selling your
        data. Analytics, if enabled, is limited to understanding product health and usage patterns.
      </p>

      <h2>13. Complaints and tickets</h2>
      <p>
        If you believe we mishandled personal data, or you hit a product mistake that affects your
        privacy or account, please tell us. Email{" "}
        <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
          support@srsocialhub.in
        </a>{" "}
        or use{" "}
        <a className="text-brand-secondary underline" href="/support">
          Support
        </a>{" "}
        to open a complaint / ticket. Include enough detail for us to find your account and the issue.
        We take genuine reports seriously and will work to correct what we can. Raising a ticket does
        not, by itself, create liability beyond what the law and our{" "}
        <a className="text-brand-secondary underline" href="/terms">
          Terms of Service
        </a>{" "}
        already describe.
      </p>

      <h2>14. Product mistakes and organization responsibility</h2>
      <p>
        Displays, exports, analysis results, and automated actions can be wrong or incomplete. Social
        networks, payment partners, and hosting providers can fail independently of us. To the extent
        allowed by law, SR Social Hub and the organization operating this domain are not responsible
        for harm that comes only from relying on an incorrect screen, a delayed job, a third-party
        outage, or an official app / APK related to srsocialhub.in. Please verify critical actions and
        contact support when something looks off. Full liability limits and disclaimers live in the
        Terms of Service.
      </p>

      <h2>15. Changes to this policy</h2>
      <p>
        When we update this Policy in a material way, we will revise the date at the top of the page
        and, where appropriate, notify account owners by email or an in-product notice. Continued use
        after the effective date means the updated Policy applies.
      </p>

      <h2>16. Contact</h2>
      <p>
        Privacy and data requests:{" "}
        <a className="text-brand-secondary underline" href="mailto:support@srsocialhub.in">
          support@srsocialhub.in
        </a>
        . Product help and complaints:{" "}
        <a className="text-brand-secondary underline" href="/support">
          Support
        </a>
        .
      </p>
    </LegalShell>
  );
}
