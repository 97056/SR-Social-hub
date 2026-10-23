# SR Social hub

One document for the product, the current code, and the next step. Give this file to the next coding session together with the repository. Do not paste real API keys into chat or into git.

## Names

| Surface | Name |
| --- | --- |
| Website | SR Social hub |
| App | SR Social hub |
| Admin panel | SR Social Admin |
| Tagline | All Your Socials. One Dashboard |

Currency is INR. Prices in the database are stored in paise. Seeded prices exclude tax until a plan record says otherwise.

## Who it is for

Marketing agencies manage several client brands in one workspace. An individual business manages its own brand in one workspace. A person registers, verifies email, creates an Agency or Business workspace, then adds client profiles, connects social accounts with each platform’s official OAuth, drafts posts, gets approval, schedules them, and sees a separate result for every account.

A post target is one post delivered to one connected account. One creative sent to Facebook and Instagram uses two post targets.

## Plans

These are the seeded defaults. SR Social Admin can change names, prices, and limits. The website must read them from the API. Do not hardcode them in the frontend.

| Plan | Price / month | Client profiles | Connected accounts | Post targets / month | Team members |
| --- | --- | --- | --- | --- | --- |
| Starter | ₹200 | 3 | 5 | 60 | 2 |
| Growth | ₹400 | 4 | 10 | 150 | 5 |
| Agency | ₹600 | 6 exactly | 15 | 300 | 10 |
| Custom | Request a quote | Negotiated | Negotiated | Negotiated | Negotiated |

The API rejects a seventh client on the Agency plan. Custom checkout sends the person to the quote form. The quote is stored for SR Social Admin and an acknowledgement is written to the email outbox.

## What is already built

- Next.js site and app in `apps/web`. Spring Boot API in `apps/api`. PostgreSQL schema and seed data in `apps/api/src/main/resources/db/migration`.
- Registration, email verification, login, password reset, logout, and HttpOnly session cookies.
- Agency and Business workspaces, members, and client profiles. Every workspace query is scoped by `workspace_id`. Another workspace’s id returns 404.
- Plans, usage limits, and Razorpay webhook checks. A duplicate webhook does not activate a plan twice.
- Quote form and admin inbox.
- Theme stored in the database and applied with CSS variables. A theme save does not need a redeploy.
- Provider settings screen. A saved secret is encrypted. The browser only receives `secretSet: true`. Saving credentials does not mark a connector verified.
- Approval rules and a publishing worker. An unapproved post is not published. If the scheduled time passes while approval is still pending, the job stays blocked. An uncertain publish is reconciled before any retry.
- Tests cover plan limits, tenant isolation, and webhook duplicates.

## What is not built yet

Do not tell a user that any of these work.

- Live checkout. The billing page refuses to start a payment until Razorpay is configured, and even then it does not mark a subscription active from the browser.
- Outbound email. Messages are stored in `email_outbox`. The development mailbox is `/dev/mailbox` and only exists on the local or embedded profile.
- Media upload to Cloudflare R2 or S3. The status stays `not_configured` until all four storage variables are set.
- Real OAuth and publishing for Facebook, Instagram, LinkedIn, YouTube, X, Pinterest, and Threads. They stay **coming soon**. The live adapter always fails with `integration_not_verified`. Sandbox mode, used only for local demos, labels results `sandbox_published` and does not count them as post targets.
- Calendar and composer screens.
- Sentry. `SENTRY_DSN` is reserved and is not wired.

## How the pieces connect

The browser talks only to the Next.js origin. Next.js forwards `/api` to the Spring Boot API so the session cookie stays on one site. The API owns permissions, billing, and publishing. PostgreSQL stores the data and the job queue. One API process runs the publishing worker.

Mutating API calls from the browser must send the header `X-Requested-With: sociallink`.

Public signup cannot create a super admin. The first admin is created only when `INITIAL_SUPER_ADMIN_EMAIL` and `INITIAL_SUPER_ADMIN_PASSWORD` are set and no super admin exists. Remove those two variables after the account exists. Admin pages stay closed until that account enrolls an authenticator.

## Run it locally

Java 21 and Maven 3.9 are required. Node is required for the website.

Option A, your own Postgres:

```shell
docker compose up -d
mvn -f apps/api spring-boot:run
pnpm --dir apps/web install
pnpm --dir apps/web dev
```

Open `http://localhost:3000`. The site proxies `/api` to `http://localhost:8080`.

Option B, no Docker. This starts a disposable database and the sandbox publisher:

```shell
mvn -f apps/api spring-boot:run -Pembedded-db -Dspring-boot.run.profiles=embedded
```

Set the two super-admin variables on that first boot if you need SR Social Admin. Verification messages are then visible at `http://localhost:3000/dev/mailbox`. Do not use the embedded profile in production.

Tests:

```shell
mvn -f apps/api test
```

Copy `.env.example` to a local env file that is not committed. Replace `change-me` values before any shared environment. Never commit real keys.

## Next step: collect API keys

Do this in the provider consoles yourself. Then put the values only in the server environment or in SR Social Admin, where secrets are masked after save. The next coding session should wire each key after you have it. It must not invent keys, must not put secrets in frontend code, and must not mark a connector verified until an authorized account has connected, published, and reconnected.

Create separate test and live credentials. Staging must not use live keys.

### 1. Core secrets, before any provider

| Variable | What to put there |
| --- | --- |
| `DATABASE_URL` | JDBC URL for PostgreSQL |
| `DATABASE_USERNAME` | Database user |
| `DATABASE_PASSWORD` | Database password |
| `APP_BASE_URL` | Public site URL, for example `https://your-domain` |
| `SESSION_SECRET` | Long random string. Production rejects the development value. |
| `TOKEN_ENCRYPTION_KEY` | 32-byte key, raw or base64. Production rejects the development value. |
| `INITIAL_SUPER_ADMIN_EMAIL` | First admin email. Remove after the first boot. |
| `INITIAL_SUPER_ADMIN_PASSWORD` | First admin password. Remove after the first boot. |

### 2. Razorpay, so checkout can be finished

Console: https://dashboard.razorpay.com/
Docs: https://razorpay.com/docs/payments/subscriptions/

| Variable | What to put there |
| --- | --- |
| `RAZORPAY_KEY_ID` | Test key first, then a separate live key |
| `RAZORPAY_KEY_SECRET` | Matching secret |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for the webhook endpoint |

Also create a Razorpay plan for Starter, Growth, and Agency, and store each Razorpay plan id on the matching SR Social hub plan as `providerPlanId`. The webhook must send `X-Razorpay-Signature` and `X-Razorpay-Event-Id`. Subscription notes must include `workspace_id` and `plan_code`. A repeated event id must not increase `charge_count`.

Checkout stays blocked until those plan ids exist and a signed webhook has been tested.

### 3. Meta: Facebook Pages and Instagram

Console: https://developers.facebook.com/
Facebook docs: https://developers.facebook.com/docs/graph-api/
Instagram docs: https://developers.facebook.com/docs/instagram-platform/

| Variable | What to put there |
| --- | --- |
| `META_APP_ID` | Meta app id |
| `META_APP_SECRET` | Meta app secret |
| `META_REDIRECT_URI` | Exact callback URL registered on the Meta app |

Instagram publishing needs an eligible professional account and the current permissions. App review is not automatic. Leave both connectors as coming soon until a real Page and a real Instagram account publish through this product.

### 4. LinkedIn

Console: https://www.linkedin.com/developers/
Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

| Variable | What to put there |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | LinkedIn client id |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn client secret |
| `LINKEDIN_REDIRECT_URI` | Exact redirect URL |

Organization posting depends on the member’s role and on approved product access.

### 5. YouTube

Console: https://console.cloud.google.com/
Docs: https://developers.google.com/youtube/v3

| Variable | What to put there |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Exact redirect URL |

Enable the YouTube Data API, configure the OAuth consent screen, and check upload quota before enabling the connector.

### 6. X

Console: https://developer.x.com/
Docs: https://docs.x.com/

| Variable | What to put there |
| --- | --- |
| `X_CLIENT_ID` | X client id |
| `X_CLIENT_SECRET` | X client secret |
| `X_REDIRECT_URI` | Exact redirect URL |

Check the current API price before enabling publishing. Do not promise unlimited posts.

### 7. Pinterest and Threads, after the earlier networks

Pinterest console: https://developers.pinterest.com/
Pinterest docs: https://developers.pinterest.com/docs/
Threads docs: https://developers.facebook.com/docs/threads/

| Variable | What to put there |
| --- | --- |
| `PINTEREST_CLIENT_ID` | Pinterest client id |
| `PINTEREST_CLIENT_SECRET` | Pinterest client secret |
| `PINTEREST_REDIRECT_URI` | Exact redirect URL |
| `THREADS_APP_ID` | Threads app id |
| `THREADS_APP_SECRET` | Threads app secret |
| `THREADS_REDIRECT_URI` | Exact redirect URL |

### 8. Media storage

Cloudflare R2: https://dash.cloudflare.com/
Docs: https://developers.cloudflare.com/r2/

| Variable | What to put there |
| --- | --- |
| `OBJECT_STORAGE_ENDPOINT` | S3-compatible endpoint |
| `OBJECT_STORAGE_BUCKET` | Bucket name |
| `OBJECT_STORAGE_ACCESS_KEY` | Restricted access key |
| `OBJECT_STORAGE_SECRET_KEY` | Restricted secret |

Uploads must be checked for type and size and served with signed URLs.

### 9. Optional later

| Variable | What to put there |
| --- | --- |
| `EMAIL_PROVIDER_API_KEY` | Provider key for real email. Until delivery code exists, mail stays in the outbox. |
| `SENTRY_DSN` | Error reporting. The SDK is not connected yet. |

reCAPTCHA, if you want it on registration and the quote form: https://www.google.com/recaptcha/admin/

## Rules for the next coding session

- Use only the official docs linked above. Re-check scopes, app review, and quotas. They change.
- Prefer the admin integration screen for provider client ids. Secrets stay encrypted and are never returned to the browser.
- Use HTTPS, an OAuth `state` value, PKCE where the platform supports it, and the exact redirect URI.
- Never ask a user for a social-network password.
- A connector becomes verified only after an authorized end-to-end test. The health button must not call the provider and must not flip that status.
- One post can have many targets. Track each target’s status, API response, and retry on its own.
- Do not retry an uncertain publish until it has been reconciled.
- A post that needs approval cannot publish before approval. A real content change after approval requires approval again.
- Store schedule times in UTC. Show and edit them in the workspace or client timezone.
- On an expired subscription, block new publishing. Do not delete the user’s content.

## Deploy later

Use staging and production on a VPS with Nginx and HTTPS. Staging must not use live provider apps or live Razorpay keys.

1. Install Java 21 and PostgreSQL 16.
2. Keep database password, session secret, and token key outside git.
3. Start the API with `SPRING_PROFILES_ACTIVE=prod`. Flyway runs the migrations.
4. Build the website with `pnpm --dir apps/web build` and put TLS in front. Production cookies are Secure.
5. Run one API process with the worker enabled. Do not run two different code versions against the same queue.
6. Dump PostgreSQL at least daily, store the dump off the server, and test a restore before launch.
7. Point uptime checks at `/actuator/health`. Logs must not contain cookies, tokens, or webhook bodies.

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

The embedded profile is only for a local demo.

## Launch checklist

Do not launch because the screens exist.

- [ ] Counsel has replaced the draft terms, privacy, refund, and data-deletion pages, and their review status is published.
- [ ] Prices, taxes, and the Agency cap of six clients are confirmed.
- [ ] A person can register, verify email, sign in, and create a Business workspace and an Agency workspace.
- [ ] The API rejects an extra client, account, member, and post target.
- [ ] An unapproved post cannot be queued. A real edit clears the old approval.
- [ ] A schedule that passes while approval is pending does not publish.
- [ ] Each target shows its own status, including a partial failure.
- [ ] A duplicate Razorpay webhook does not increase `charge_count`.
- [ ] One workspace cannot read another workspace’s client.
- [ ] Only connectors that passed an authorized publish and reconnect test are verified.
- [ ] Sandbox mode is off in production.
- [ ] X API cost is known before that connector is enabled.
- [ ] Secrets are not in the frontend or in API responses.
- [ ] Production session and token keys are unique.
- [ ] Super-admin bootstrap variables have been removed.
- [ ] Every super admin has an authenticator.
- [ ] A database restore has been tested.
- [ ] A worker crash during publishing ends in `needs_reconcile`, not a second post.

## Repository map

```text
apps/api     Spring Boot API, Flyway migrations, worker, tests
apps/web     Next.js website, app, and SR Social Admin
docs/SR-SOCIAL-HUB.md   This file
.env.example Placeholder variable names only
```
