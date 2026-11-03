# Local setup guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (recommended) **or** use the embedded Postgres helper

## 1. Install

```bash
pnpm install
pnpm --filter @sr/shared build
```

## 2. Database

### Option A — Docker Compose

```bash
docker compose up -d
cp .env.example apps/api/.env
```

### Option B — Embedded Postgres (no Docker)

```bash
pnpm --filter @sr/api db:up
```

This starts Postgres on port `54329` and writes `apps/api/.env`.

Keep that process running, then in another terminal:

```bash
pnpm --filter @sr/api prisma:generate
pnpm --filter @sr/api exec prisma migrate dev --name phase1_init
pnpm --filter @sr/api prisma:seed
```

## 3. Run

```bash
pnpm dev:api
pnpm dev:web
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1/health
- Swagger: http://localhost:4000/api/docs

## Seeded accounts

| Role | Email | Password | Entry URL |
| --- | --- | --- | --- |
| Super admin | admin@srsocialhub.local | ChangeMeAdmin!123 | http://localhost:3000/admin/login |
| Company owner | agency@srsocialhub.local | ChangeMeAgency!123 | http://localhost:3000/login |
| Client approver | client@srsocialhub.local | ChangeMeClient!123 | http://localhost:3000/login |

## Social API keys

See [api-keys-guide.md](./api-keys-guide.md) for how to create provider apps, which values to copy, and where to paste them in Admin → Social Integrations.
