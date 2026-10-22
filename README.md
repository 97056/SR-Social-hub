# SR Social hub

All Your Socials. One Dashboard. Multi-tenant social media management for marketing agencies and individual businesses. The public site and app are SR Social hub. The operator console is SR Social Admin. Workspaces have their own clients, members, drafts, approvals, and per-account publishing results. A super admin, created only by a one-time bootstrap, manages plans, appearance, and provider settings.

This repository is the foundation and the first vertical slices: account security, workspaces, database-driven plans, server-side limits, quote intake, theme tokens, and a publishing worker that will not pretend a provider call succeeded.

## Stack

- Web: Next.js, React, TypeScript, Tailwind CSS, and shadcn-style components in `apps/web/src/components/ui`
- API: Java 21, Spring Boot, Spring Security, Flyway, OpenAPI
- Database: PostgreSQL
- Jobs: PostgreSQL-backed `scheduled_jobs` table and a worker in the same API process
- Payments: Razorpay webhook verification. Checkout does not activate a plan locally.
- Media and email providers are configuration points. They are not treated as working until credentials and a real delivery path exist.

## Layout

```text
apps/api     Spring Boot API, Flyway migrations, worker, tests
apps/web     Next.js product and admin UI
docs         Architecture, deployment, provider onboarding, release checklist
```

## Run locally

1. Start PostgreSQL. `docker compose up -d` matches the default URL in `apps/api/src/main/resources/application.yml`. Copy `.env.example` and change the database password before using it anywhere but a local machine.
2. API, from `apps/api`:

```shell
mvn spring-boot:run
```

3. Web, from `apps/web`:

```shell
pnpm install
pnpm dev
```

The web app proxies `/api` to `http://localhost:8080`. Open `http://localhost:3000`.

Java 21 and Maven 3.9 are required. Tests:

```shell
mvn -f apps/api test
```

Embedded Postgres is used for the API integration tests, so Docker is not required to run them. The first test run downloads PostgreSQL binaries.

### Local mail and sandbox publishing

Verification and reset messages are written to `email_outbox`. With the `embedded` profile they can be read at `/dev/mailbox`. That profile also turns on the sandbox publisher.

```shell
mvn -f apps/api spring-boot:run -Pembedded-db -Dspring-boot.run.profiles=embedded
```

That profile starts its own Postgres and does not connect to the Docker database. Set `INITIAL_SUPER_ADMIN_EMAIL` and `INITIAL_SUPER_ADMIN_PASSWORD` on the first boot if you need an admin. Public signup cannot create one.

Sandbox results use the status `sandbox_published` and an id prefixed with `sandbox:`. They are not counted as post targets. Production must use the `prod` profile, which refuses the development session pepper and token key.

## Plans

Seeded defaults, stored in paise and editable by a super admin:

| Plan | Price | Client profiles | Accounts | Post targets / month | Members |
| --- | --- | --- | --- | --- | --- |
| Starter | ₹200 | 3 | 5 | 60 | 2 |
| Growth | ₹400 | 4 | 10 | 150 | 5 |
| Agency | ₹600 | 6 | 15 | 300 | 10 |
| Custom | Quote | Negotiated | Negotiated | Negotiated | Negotiated |

Prices exclude taxes unless the plan record says otherwise. A post target is one post delivered to one connected account. The Agency cap is enforced in the API: the seventh client is rejected.

## Security notes

- Public registration cannot set `is_super_admin`. The optional `INITIAL_SUPER_ADMIN_EMAIL` and `INITIAL_SUPER_ADMIN_PASSWORD` variables create the first super admin only when none exists.
- Sessions are random tokens stored as an HMAC. The cookie is HttpOnly and SameSite=Lax.
- Mutating browser calls must send `X-Requested-With: sociallink`.
- Provider secrets and OAuth tokens are encrypted with `TOKEN_ENCRYPTION_KEY` and are not returned by admin APIs.
- Admin routes require MFA while `security_settings.mfa_required_for_admins` is true.
- Razorpay webhooks are accepted only with a valid HMAC and a unique event id.

## What is intentionally not claimed

Facebook, Instagram, LinkedIn, YouTube, X, Pinterest, and Threads are listed as coming soon. Connect and publish return a clear unavailable response. The live adapter never returns a successful external post id. Do not mark an integration verified until an authorized account has completed a real publish and reconnect test.

## Roadmap

1. Foundation — repo, migrations, UI shell, CI workflow
2. Auth and workspaces — implemented
3. Plans, entitlements, webhook idempotency — implemented; live checkout waits on Razorpay plan ids and a signed webhook test
4. Clients and the six-profile Agency cap — implemented
5. Approval rules and post API — implemented; calendar UI is not built yet
6. First real integration — blocked on Meta app review and an authorized test
7. Publishing worker — implemented, including reconcile-before-retry
8. LinkedIn, YouTube, X, then Pinterest and Threads
9. Remaining admin screens: email provider delivery, legal publishing, security policy editor
10. Launch hardening in `docs/release-checklist.md`
