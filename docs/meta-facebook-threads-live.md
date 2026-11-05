# Facebook + Threads — Live mode only

Use this so **any customer** can connect (not testers).

**Callback (exact):**  
`https://api.srsocialhub.in/api/v1/oauth/callback`

---

## 1) Facebook (also unlocks Instagram Login)

1. Open [developers.facebook.com](https://developers.facebook.com) → your app (same App ID as Admin → Integrations → Facebook).
2. Top bar → switch app to **Live**.
3. Finish any red **Alerts / Required actions**.
4. Add **Facebook Login** → Settings:
   - Valid OAuth Redirect URIs = `https://api.srsocialhub.in/api/v1/oauth/callback`
   - Client OAuth Login **ON**
   - Web OAuth Login **ON**
5. App settings → Basic:
   - App domains: `srsocialhub.in`, `api.srsocialhub.in`
   - Privacy: `https://srsocialhub.in/privacy`
   - Terms: `https://srsocialhub.in/terms`
6. **App Review** → request and get approved the permissions you use (e.g. `pages_show_list`, `pages_manage_posts`, Instagram publish scopes).
7. In SR Social Hub Admin → Integrations: save Facebook (and Instagram) Client ID/Secret, same redirect URI, enable platforms.

**Done when:** Connect Facebook shows the normal permission screen — not “App not active”.

---

## 2) Threads

1. Same or dedicated Meta app used for Threads (Admin → Integrations → Threads Client ID).
2. Switch that app to **Live**.
3. Use case **Access the Threads API** with:
   - `threads_basic`
   - `threads_content_publish`
4. Redirect URI / OAuth settings include:  
   `https://api.srsocialhub.in/api/v1/oauth/callback`
5. **App Review** → get Threads permissions approved for Live use.
6. In SR Social Hub Admin → Integrations: save Threads Client ID/Secret, same redirect URI, enable Threads.

**Done when:** Connect Threads opens the Threads authorize screen for any customer — not error `1349245` (tester invite).

---

## Rule

| Mode | Who can connect |
| --- | --- |
| Development / testers | Only invited people |
| **Live + App Review** | **Any customer** |

Do not rely on testers for production customers.
