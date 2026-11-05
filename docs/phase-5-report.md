# Phase 5 completion report — Social account connections

## Delivered

- Prisma models: `SocialAccount`, `SocialAccountToken`, `OAuthState`
- Adapter interface + registry for all nine platforms
- **Facebook adapter** with:
  - Live OAuth dialog + token exchange (Graph API v21)
  - Mock OAuth for local architecture validation
- Encrypted token storage (AES-256-GCM)
- State-validated OAuth callback
- Connect / reauthorize / disconnect APIs with tenant checks
- Company + client Social Accounts UI

## Integration status

| Platform | Status |
| --- | --- |
| Facebook | Configured adapter; mock connect verified; live OAuth ready when admin credentials set and `SOCIAL_OAUTH_MODE=live` |
| Instagram | Stub — not available |
| LinkedIn | Stub — not available |
| X | Stub — not available |
| YouTube | Stub — not available |
| TikTok | Removed — developer access unavailable |
| Pinterest | Stub — not available |
| Threads | Stub — not available |
| Google Business Profile | Removed — not offered |

Mock connections are **never** described as real Facebook publications.

## How to use

1. Admin → Social Integrations → enable Facebook (optional credentials for live mode).
2. Company/Client → Social Accounts → Connect Facebook.
3. Default local mode is mock unless credentials + live mode are set.
