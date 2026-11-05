# OAuth + multipublish smoke report

Generated: 2026-11-04T19:16:00.000Z (local API)

## Scope

- Test OAuth client IDs/secrets loaded into **Admin → Integrations** (encrypted in Postgres; source file `apps/api/.data/test-oauth-keys.json` is gitignored).
- Runtime: `SOCIAL_OAUTH_MODE=mock` — validates connect + one-post→all-networks publishing architecture.
- These are **not** live posts on Facebook/Instagram/etc. Live requires browser OAuth per network after you set `SOCIAL_OAUTH_MODE=live` and a public callback URL.

## 1. Keys integrated

| Platform | Enabled | Secret stored | Client ID |
| --- | --- | --- | --- |
| FACEBOOK | true | true | 1933614430934548 |
| INSTAGRAM | true | true | 1933614430934548 |
| LINKEDIN | true | true | 86vu06xkuhkthf |
| X | true | true | UkFMZDFJSEItRXZwcks5RlpUcUE6MTpjaQ |
| YOUTUBE | true | true | 151123674790-fanoa5fo2pka0a4h6bnm4plllneou9jr.apps.googleusercontent.com |
| PINTEREST | true | true | 1634460 |
| THREADS | true | true | 1725919778867856 |

Instagram Unified Login Configuration ID stored in capabilities: `1154246043953710`.

Redirect URI configured on each integration: `http://localhost:4000/api/v1/oauth/callback`

## 2. Connect

All seven platforms have connected social accounts in **mock** mode (`connectionMode: mock`) for client Bright Retail.

## 3. One post → all medias

- **Post ID:** `cmw2hyhrw00cwl350x2xd7v8u`
- **Caption:** SR Social Hub multipublish smoke — one post targeting all connected networks (architecture test).
- **Post status:** `PUBLISHED`
- **Targets:** FACEBOOK, INSTAGRAM, LINKEDIN, X, YOUTUBE, PINTEREST, THREADS

| Platform | Job status | External post ID |
| --- | --- | --- |
| FACEBOOK | PUBLISHED | mock_fb_post_6ac9796a1e2d |
| INSTAGRAM | PUBLISHED | mock_ig_post_7b0ca4a91a1b |
| LINKEDIN | PUBLISHED | mock_li_post_df091b5280c3 |
| X | PUBLISHED | mock_x_post_83c5110d4e53 |
| YOUTUBE | PUBLISHED | mock_yt_post_c1b98f81b17c |
| PINTEREST | PUBLISHED | mock_pin_post_69f2d3393eab |
| THREADS | PUBLISHED | mock_th_post_0413779e0048 |

**Result: yes — one post successfully published to all 7 connected medias** (mock publishers).

## 4. Verdict

| Check | Result |
| --- | --- |
| Keys in admin DB | Pass |
| Platforms enabled | Pass (7) |
| Connect all | Pass (mock) |
| One post → all medias | **Pass (7/7 PUBLISHED)** |
| Live provider posts | Not run (needs live OAuth + public callback) |

## 5. Live next steps (when ready)

1. Register redirect URI `https://api.srsocialhub.in/api/v1/oauth/callback` in every provider console (and keep localhost for local).
2. Deploy API + set `SOCIAL_OAUTH_MODE=live`, `API_URL`, `WEB_URL`, `CORS_ORIGINS`.
3. Re-enter keys from Admin if rotated.
4. Open each Social Accounts → Connect and complete browser consent.
5. Compose one multi-target post again; Facebook can live-publish when a real Page token exists — other networks may return assisted until each API is certified.

## Security

**Rotate these App Secrets** — they were pasted in chat. Do not commit secrets. Replace via Admin when you reset keys.
