# SR Social Hub — Architecture (Phase 1)

## Current stack decision

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Next.js 15 + React 19 + Tailwind | Premium dark theme tokens from product brief |
| Backend | NestJS + TypeScript | Versioned REST under `/api/v1`, OpenAPI at `/api/docs` |
| Database | PostgreSQL + Prisma | Migrations + seed; embedded Postgres helper when Docker is missing |
| Jobs | DB publishing queue (Phase 8) | Redis + BullMQ optional upgrade path |
| Auth | JWT access tokens + hashed refresh rows | Separate super-admin login endpoint |

Previous Coming Soon Next.js remnant and Spring Boot API were removed. NestJS was selected to match the product brief.

## Multi-tenant model

- `SUPER_ADMIN` uses `/auth/admin/login` and `/admin/*` APIs only.
- Company/client users share `/auth/login`.
- Redirect priority: admin → first company → first client.
- `CompanyAccessGuard` and `ClientAccessGuard` enforce membership in the API (not only UI routes).
- Company members may open client workspaces under their company; client members cannot open other clients.

## Design tokens

Dark defaults: `#080D19`, `#0B1220`, `#111A2B`, `#162136`, accent `#7565FF`, secondary `#22D3EE`.

## Phase map

1. Auth + tenant isolation
2–3. Admin panel + dynamic branding/settings
4. Company/client dashboards depth + Command Center
5. Facebook OAuth connect (mock/live)
6. Media library + composer
7. Approval workflows
8. Publishing queue + Facebook mock/live publisher
9. Remaining eight social adapters + mock publishers
10. Billing & subscriptions
11. AI, notifications, analytics (**current**)
