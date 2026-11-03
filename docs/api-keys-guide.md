# Social API keys collection guide

Use this file while creating developer apps for each network. Paste values into **Admin → Social Integrations**, then enable the platform and test Connect from the company/client workspace.

## Shared redirect URI (required for all apps)

Register this exact callback in every provider console:

```text
http://localhost:4000/api/v1/oauth/callback
```

Production later:

```text
https://<your-api-host>/api/v1/oauth/callback
```

## Branding + legal URLs (required by most developer consoles)

Providers usually ask for logo, privacy policy, terms, and a delete-account / data-deletion page.

### Use these public HTTPS URLs now (currently live on srsocialhub.in)

The Hostinger site is still on an older deployment that uses `/legal/...` paths. These work today:

| Field | Public URL (use in Meta/Google/etc.) |
| --- | --- |
| Privacy Policy | https://srsocialhub.in/legal/privacy |
| Terms of Service | https://srsocialhub.in/legal/terms |
| Delete account / user data | https://srsocialhub.in/legal/data-deletion |
| Support / contact | https://srsocialhub.in/contact |
| App logo | Upload a square PNG in the console (1024×1024 preferred). Site favicon may work temporarily. |

Do **not** use `https://srsocialhub.in/privacy` until a new Hostinger deploy succeeds — that path 404s on the current live build.

### Local / after next successful deploy

| Field | URL |
| --- | --- |
| App logo | http://localhost:3000/brand/logo.svg → later https://srsocialhub.in/brand/logo.svg |
| Privacy | http://localhost:3000/privacy |
| Terms | http://localhost:3000/terms |
| Delete account | http://localhost:3000/delete-account |
| Support | http://localhost:3000/support |

After the Nest/Next rebuild deploys successfully, `/legal/*` redirects to the new pages automatically.

## Where to paste keys in SR Social Hub

1. Open http://localhost:3000/admin/login  
   - Email: `admin@srsocialhub.local`  
   - Password: `ChangeMeAdmin!123`
2. Go to **Social Integrations**
3. For each network:
   - Tick **Enabled**
   - Paste **OAuth client ID**
   - Paste **Client secret**
   - Confirm redirect URI = `http://localhost:4000/api/v1/oauth/callback`
   - Click **Save config**
4. To use **live** OAuth (real provider dialogs), set in `apps/api/.env`:

```env
SOCIAL_OAUTH_MODE=live
```

Then restart the API.  
If mode is `mock` (current default), Connect still works for architecture testing without real keys.

---

## Collection checklist

Copy this block into a private notes file (do **not** commit secrets to git).

```text
[ ] Facebook
    App ID:
    App Secret:
    Notes:

[ ] Instagram (usually same Meta app as Facebook)
    App ID:
    App Secret:
    Notes:

[ ] LinkedIn
    Client ID:
    Client Secret:
    Notes:

[ ] X (Twitter)
    Client ID:
    Client Secret:
    Notes:

[ ] YouTube (Google Cloud OAuth client)
    Client ID:
    Client Secret:
    Notes:

[ ] TikTok
    Client Key:
    Client Secret:
    Notes:

[ ] Pinterest
    App ID:
    App Secret:
    Notes:

[ ] Threads (Meta)
    App ID:
    App Secret:
    Notes:

[ ] Google Business Profile (Google Cloud OAuth client)
    Client ID:
    Client Secret:
    Notes:
```

---

## 1. Facebook (+ Instagram via Meta)

**Portal:** https://developers.facebook.com/apps/

### Steps

1. Create an app → type **Business**.
2. Add products: **Facebook Login for Business**, **Instagram** / **Instagram Graph API** (as available).
3. Settings → Basic → copy **App ID** and **App Secret**.
4. Facebook Login → Settings → Valid OAuth Redirect URIs → add:
   - `http://localhost:4000/api/v1/oauth/callback`
5. Request / enable permissions (App Review may be required for live publish):
   - `pages_show_list`
   - `pages_manage_posts` / `pages_read_engagement`
   - Instagram: `instagram_basic`, `instagram_content_publish`
6. Use a **Facebook Page** you admin. For Instagram, use a **Professional** IG account linked to that Page.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `FACEBOOK` and/or `INSTAGRAM` |
| OAuth client ID | Meta App ID |
| Client secret | Meta App Secret |
| Redirect URI | `http://localhost:4000/api/v1/oauth/callback` |
| API version (optional) | `v21.0` |

### Local test path

Agency login → Social Accounts → pick client → **Connect** Facebook / Instagram.

---

## 2. LinkedIn

**Portal:** https://www.linkedin.com/developers/apps

### Steps

1. Create an app and associate a LinkedIn Page / company.
2. Auth tab → copy **Client ID** and **Client Secret**.
3. Authorized redirect URLs → add `http://localhost:4000/api/v1/oauth/callback`.
4. Products: request **Share on LinkedIn** / **Marketing Developer Platform** as needed for organization posting.
5. Scopes used by SR: `openid`, `profile`, `w_member_social` (org posting may need extra Marketing API access).

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `LINKEDIN` |
| OAuth client ID | LinkedIn Client ID |
| Client secret | LinkedIn Client Secret |

---

## 3. X (Twitter)

**Portal:** https://developer.x.com/en/portal/dashboard

### Steps

1. Create a Project + App.
2. User authentication settings → enable OAuth 2.0.
3. Callback URI: `http://localhost:4000/api/v1/oauth/callback`
4. App permissions: **Read and write** (+ offline access if available).
5. Copy **Client ID** and **Client Secret** (OAuth 2.0).
6. Write posting requires an eligible API tier.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `X` |
| OAuth client ID | X OAuth 2.0 Client ID |
| Client secret | X Client Secret |

---

## 4. YouTube

**Portal:** https://console.cloud.google.com/apis/credentials

### Steps

1. Create / select a Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Configure OAuth consent screen (External or Internal).
4. Create credentials → **OAuth client ID** → Application type **Web application**.
5. Authorized redirect URIs → `http://localhost:4000/api/v1/oauth/callback`
6. Copy Client ID + Client Secret.
7. Scopes used: `youtube.upload`, `youtube.readonly`.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `YOUTUBE` |
| OAuth client ID | Google OAuth Client ID |
| Client secret | Google Client Secret |

---

## 5. TikTok

**Portal:** https://developers.tiktok.com/

### Steps

1. Create a TikTok developer account / app.
2. Enable **Login Kit** + **Content Posting API** (approval often required).
3. Copy **Client key** and **Client secret**.
4. Redirect URI: `http://localhost:4000/api/v1/oauth/callback`
5. Scopes used: `user.info.basic`, `video.publish`, `video.upload`.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `TIKTOK` |
| OAuth client ID | TikTok Client key |
| Client secret | TikTok Client secret |

---

## 6. Pinterest

**Portal:** https://developers.pinterest.com/apps/

### Steps

1. Create an app.
2. Copy App ID + App secret.
3. Add redirect URI `http://localhost:4000/api/v1/oauth/callback`.
4. Request scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`.
5. Production pin create may need Pinterest approval.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `PINTEREST` |
| OAuth client ID | Pinterest App ID |
| Client secret | Pinterest App secret |

---

## 7. Threads

**Portal:** Meta Developers (Threads API) — https://developers.facebook.com/

### Steps

1. Use a Meta app with Threads API access (eligibility required).
2. Add redirect URI `http://localhost:4000/api/v1/oauth/callback`.
3. Scopes: `threads_basic`, `threads_content_publish`.
4. Use App ID / App Secret from the Meta app.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `THREADS` |
| OAuth client ID | Meta App ID |
| Client secret | Meta App Secret |

---

## 8. Google Business Profile

**Portal:** https://console.cloud.google.com/apis/credentials

### Steps

1. Same Google Cloud project pattern as YouTube (can reuse OAuth client **or** create a dedicated one).
2. Enable **Google Business Profile API** / Business Profile APIs available to your project.
3. OAuth client (Web) redirect: `http://localhost:4000/api/v1/oauth/callback`
4. Scope used: `https://www.googleapis.com/auth/business.manage`
5. You need a verified Business Profile location linked to the Google account that authorizes.

### Paste into admin

| Field | Value |
| --- | --- |
| Platform | `GOOGLE_BUSINESS` |
| OAuth client ID | Google OAuth Client ID |
| Client secret | Google Client Secret |

---

## After you collect keys — connect & test order

### A. Admin

1. http://localhost:3000/admin/login  
2. Enable + save credentials for the networks you collected (start with **Facebook**).  
3. Confirm each card shows a masked secret after save.

### B. Agency (company user)

1. http://localhost:3000/login  
   - `agency@srsocialhub.local` / `ChangeMeAgency!123`
2. Open **Social Accounts** (or client workspace → Social Accounts).
3. Click **Connect** for an enabled network.
4. Complete the provider consent screen (live mode) or mock callback (mock mode).
5. Confirm account appears as connected.

### C. Client approver

1. Same login page with:
   - `client@srsocialhub.local` / `ChangeMeClient!123`
2. Open client **Social Accounts** / **Approvals** to verify client-side visibility.

### D. Publish smoke (after connect)

1. Agency → Create Post → target the connected account.  
2. Submit → approve → Publishing Queue.  
3. Mock publish returns `mock_*_post_*`. Live auto-publish is Facebook-first; other live networks may return assisted until certified.

---

## Mode cheat sheet

| Goal | `SOCIAL_OAUTH_MODE` | Admin credentials |
| --- | --- | --- |
| Architecture / UI test without real apps | `mock` | optional |
| Real provider login dialogs | `live` | required App ID + Secret |
| Mixed local | leave unset | live if credentials present, else mock |

Restart API after changing `.env`.

---

## Security

- Never commit App Secrets to git.
- Prefer a password manager / private vault for the checklist values.
- Rotate any secret that was pasted into chat or screenshots.
- Local secrets are encrypted at rest in Postgres using `ENCRYPTION_KEY` from `apps/api/.env`.
