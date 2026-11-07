# SR Social Hub vs Annadatha Bazar

These are **separate products**. Do not merge configs, env files, or deploy scripts.

| Piece | Where it runs |
| --- | --- |
| `srsocialhub.in` frontend | Hostinger Node.js webapp (Git → `apps/web`) |
| `api.srsocialhub.in` API | `/opt/sr-social-hub` Docker (`deploy/docker-compose.prod.yml`) |
| SR database | SR Postgres volume on the API host |
| `annadathabazar.tech` | Separate `/opt/annadatha-bazar` stack |

## Why login showed "Failed to fetch"

The API hostname shared Annadatha's nginx templates. When Annadatha nginx was
redeployed/reset, the `api.srsocialhub.in` SSL vhost disappeared and the browser
rejected the wrong certificate → `Failed to fetch`.

## Rule going forward

1. Never paste SR server blocks into Annadatha `with-ssl` / `http-only` templates.
2. SR API vhost lives only in `/opt/sr-social-hub/deploy/nginx/api.srsocialhub.in.conf`.
3. Edge nginx loads it via **Annadatha `docker-compose.override.yml`** (server-local),
   which mounts that file as `/etc/nginx/conf.d/sr-api.conf`.
4. Deploy Annadatha with its own compose; deploy SR with `/opt/sr-social-hub/deploy`.
5. Hostinger webapp env must keep `NEXT_PUBLIC_API_URL=https://api.srsocialhub.in`.
