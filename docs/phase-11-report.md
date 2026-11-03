# Phase 11 completion report — AI, notifications, analytics

## Delivered

- `Notification` + `AiUsageRecord` schema
- In-app notification center APIs (list, unread count, mark read / read-all) with dedupe keys
- Approval + publishing events emit notifications
- Mock AI provider abstraction (`caption`, `hashtags`, `cta`, `ideas`, `rewrite`, …) with monthly quota via entitlements
- AI generate endpoint + Create Post studio assist buttons
- Company/client analytics from internal publishing data only; provider impressions marked unavailable

## Notes

- AI drafts are editable and never claimed to guarantee engagement
- Email delivery remains skipped unless `EMAIL_NOTIFICATIONS=true`
- Live LLM providers can replace `MockAiProvider` without UI changes

## Verification

- Migration `phase11_ai_notifications_analytics` applied; lint clean; AI provider unit tests passing
- Smoke: AI caption generate increments usage; analytics returns internal rates with impressions unavailable; approval submit creates in-app notification
