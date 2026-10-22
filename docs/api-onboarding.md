# Provider onboarding

Create each app in the provider’s own console. Approval is not automatic. Leave the connector disabled, or enabled but unverified, until an authorized account has connected, published, and reconnected through this product. The admin health action does not call the provider and cannot mark a connector verified.

Official starting points:

| Provider | Console | Documentation | Check before enabling |
| --- | --- | --- | --- |
| Facebook Pages | https://developers.facebook.com/ | https://developers.facebook.com/docs/graph-api/ | App mode, Facebook Login, Page permissions, app review |
| Instagram | https://developers.facebook.com/ | https://developers.facebook.com/docs/instagram-platform/ | Professional account eligibility and the current publishing path |
| X | https://developer.x.com/ | https://docs.x.com/ | OAuth setup and current API pricing |
| LinkedIn | https://www.linkedin.com/developers/ | https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api | Product access and organization posting roles |
| YouTube | https://console.cloud.google.com/ | https://developers.google.com/youtube/v3 | OAuth consent, Data API quota, upload eligibility |
| Pinterest | https://developers.pinterest.com/ | https://developers.pinterest.com/docs/ | Redirect URI and boards/pins scopes |
| Threads | https://developers.facebook.com/ | https://developers.facebook.com/docs/threads/ | Current onboarding and supported publish features |
| Razorpay | https://dashboard.razorpay.com/ | https://razorpay.com/docs/payments/subscriptions/ | Test and live keys, plan ids, webhook secret |
| Cloudflare R2 | https://dash.cloudflare.com/ | https://developers.cloudflare.com/r2/ | Bucket and restricted credentials, signed URLs |
| reCAPTCHA | https://www.google.com/recaptcha/admin/ | https://developers.google.com/recaptcha/docs/v3 | Optional, for registration and the public quote form |

## Rules for every connector

- Store the client id and secret in the admin integration screen or in the environment variables from `.env.example`. The secret is encrypted and the API returns only `secretSet`.
- Use the exact redirect URI registered with the provider.
- Request the smallest scope set the current docs require. Record that set in the admin screen after you have confirmed it, not before.
- Keep a separate test app and test credentials for staging.
- A successful sandbox publish is not evidence of provider access.

## Razorpay

Create a plan in Razorpay, then store its id on the SR Social hub plan as `providerPlanId`. Webhooks must send `X-Razorpay-Signature` and `X-Razorpay-Event-Id`. Subscription notes need `workspace_id` and `plan_code`. Checkout stays unavailable until those ids exist and a duplicate signed webhook has been shown not to double-charge.
