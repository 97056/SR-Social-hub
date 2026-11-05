# SR Social Hub

Premium, AI-powered social media management SaaS for agencies and businesses.

## Status

**Phases 1–3, 5–11 complete:** nine-network connect/publish, approvals, mock billing/quotas, AI assist, notifications, and internal analytics.

Core SaaS loop is live for local demo (mock OAuth/billing/AI).

## Stack

- **Web:** Next.js 15, React 19, Tailwind CSS
- **API:** NestJS, Prisma, PostgreSQL
- **Jobs (planned):** Redis + BullMQ

## Quick start

```bash
pnpm install
pnpm --filter @sr/shared build
pnpm --filter @sr/api db:up   # if Docker is unavailable
pnpm db:generate
pnpm --filter @sr/api exec prisma migrate dev --name phase1_init
pnpm db:seed
pnpm dev:api
pnpm dev:web
```

## Docs

- [Facebook + Threads Live setup](docs/meta-facebook-threads-live.md)
