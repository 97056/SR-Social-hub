# Live OAuth / integration URLs

Canonical production hosts:

- **Frontend:** `https://srsocialhub.in` (live)
- **API:** `https://api.srsocialhub.in` (create Hostinger Node app + DNS A/CNAME + Postgres)

Public catalog page: https://srsocialhub.in/integrations

| # | Purpose | URL |
| --- | --- | --- |
| 1 | Frontend website | https://srsocialhub.in |
| 2 | Backend/API base | https://api.srsocialhub.in/api/v1 |
| 3 | Social connection page | https://srsocialhub.in/app/{companyId}/social-accounts |
| 4 | Facebook OAuth start (UI) | https://srsocialhub.in/client/{clientId}/social-accounts?connect=FACEBOOK |
| 5 | Instagram OAuth start (UI) | https://srsocialhub.in/client/{clientId}/social-accounts?connect=INSTAGRAM |
| 6 | OAuth callback | https://api.srsocialhub.in/api/v1/oauth/callback |
| 7 | Disconnect account | POST https://api.srsocialhub.in/api/v1/social-accounts/{accountId}/disconnect |

Also register in Meta:

- Privacy: https://srsocialhub.in/privacy
- Terms: https://srsocialhub.in/terms
- Data deletion: https://srsocialhub.in/delete-account

API JSON mirror (when API is up): `GET https://api.srsocialhub.in/api/v1/public/integration-urls`

## Provider setup (Instagram + YouTube first)

Step-by-step console checklist (Meta Live mode + Google redirect URI):

→ [oauth-instagram-youtube.md](./oauth-instagram-youtube.md)
