# Clear Instagram + YouTube OAuth (production)

Canonical callback used by SR Social Hub (must match **exactly**, including `https` and no trailing slash):

```
https://api.srsocialhub.in/api/v1/oauth/callback
```

Also keep privacy / terms URLs registered where the provider asks for them:

- https://srsocialhub.in/privacy
- https://srsocialhub.in/terms
- https://srsocialhub.in/delete-account

---

## 1) Instagram (uses Facebook Login)

Instagram Professional connect goes through **Facebook OAuth** with the same Meta app as Facebook.

### Symptoms you saw

| Error | Meaning |
| --- | --- |
| **App not active** | Meta app is in Development / restricted; only listed testers can log in, or the app was disabled. |
| Redirect / URL blocked | Valid OAuth Redirect URI missing, or Facebook Login product not enabled. |

### Fix checklist (Meta Developer Console)

1. Open [developers.facebook.com](https://developers.facebook.com/) → your app (App ID used in Admin → Integrations for Facebook/Instagram).
2. **App mode:** switch from **Development** to **Live** when ready for real customers.  
   - While still in Development, add every tester under **Roles → Roles / Testers** and accept the invite on Facebook.
3. Add product **Facebook Login** (if missing) → **Settings**.
4. Under **Valid OAuth Redirect URIs**, add exactly:
   ```
   https://api.srsocialhub.in/api/v1/oauth/callback
   ```
5. Under **Client OAuth settings**, turn **ON**:
   - Client OAuth Login
   - Web OAuth Login
6. **App Domains:** `srsocialhub.in` and `api.srsocialhub.in` (as Meta allows).
7. **Instagram Graph API** / Instagram product: ensure the IG professional account is linked to a Facebook Page owned by the connecting user.
8. Request / use permissions that match Admin scopes (typical):  
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` (+ Facebook Page scopes for FB itself).
9. In **SR Social Hub → Admin → Social Integrations**:
   - Facebook + Instagram Client ID / Secret saved
   - Redirect URI field = `https://api.srsocialhub.in/api/v1/oauth/callback`
   - Platforms **enabled**

### After Meta is Live

Retry from the client portal **Social accounts → Instagram → Connect**.  
You should land back on the client social page with `?connected=INSTAGRAM` (not a raw JSON 500).

---

## 2) YouTube (Google Cloud OAuth)

### Symptom you saw

`Error 400: redirect_uri_mismatch` — the redirect URI Google received is **not** listed on the OAuth client.

### Fix checklist (Google Cloud Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials**.
2. Open the **OAuth 2.0 Client ID** of type **Web application** (same Client ID as in Admin → Integrations → YouTube).
3. **Authorized redirect URIs** — add **exactly**:
   ```
   https://api.srsocialhub.in/api/v1/oauth/callback
   ```
   - Do **not** add a trailing slash.
   - Do **not** use `http://` or `www`.
4. **Authorized JavaScript origins** (optional but useful):
   ```
   https://srsocialhub.in
   https://api.srsocialhub.in
   ```
5. Enable APIs for the project:
   - **YouTube Data API v3**
6. OAuth consent screen:
   - Add test users while the app is in **Testing**.
   - Publish the app when you need any Google account (not only testers).
7. Scopes used by the product (must be allowed on the consent screen):
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
8. In **SR Social Hub → Admin → Social Integrations → YouTube**:
   - Client ID + Secret saved
   - Redirect URI = `https://api.srsocialhub.in/api/v1/oauth/callback`
   - Platform enabled

### After Google redirect URI matches

Retry **Connect** for YouTube. A mismatch will stop on Google’s error page before our API; a successful exchange redirects to the client social page with `?connected=YOUTUBE`.

---

## Quick verify

| Check | Expected |
| --- | --- |
| Admin Integrations redirect URI | `https://api.srsocialhub.in/api/v1/oauth/callback` |
| Meta Valid OAuth Redirect URIs | Same URL |
| Google Authorized redirect URIs | Same URL |
| Meta app Live (or you are a tester) | No “App not active” |
| Google consent Testing | Your Google account listed as test user |

Local / staging must use a **different** OAuth client or additional redirect URIs (`http://localhost:4000/api/v1/oauth/callback`) — never mix local URIs into the live client only used by production.
