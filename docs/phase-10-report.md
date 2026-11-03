# Phase 10 completion report — Billing & subscriptions

## Delivered

- Schema: `Subscription`, `SubscriptionAddon`, `Invoice`, `Payment`, `BillingEvent`
- Entitlements service with backend quota enforcement (clients, accounts, storage, publishing)
- Company billing APIs: plans, checkout, change-plan, cancel, add-ons, entitlements
- Idempotent `/billing/webhooks` (mock provider settles checkout locally)
- Admin billing overview (MRR, subscriptions, invoices)
- Company Billing UI + Admin Billing Overview UI
- Trial subscriptions created on company create + demo seed

## Behaviour

- Mock billing never charges a real card (`BILLING_MODE` defaults to mock)
- Trial expiry / cancelled / past-due (after grace) blocks new publishing
- Billing pages remain reachable for plan changes and invoices
- Extra client seats via `EXTRA_CLIENT` add-on (₹299)

## Verification

- Migration `phase10_billing` applied; seed creates TRIALING subscription for demo agency
- Unit tests: entitlements publishing rules passing
- Smoke: checkout AGENCY_PRO → PAID invoice + SUCCEEDED payment; EXTRA_CLIENT add-on; webhook idempotency; admin MRR
- Smoke: expired trial blocks publishing; mock checkout restores ACTIVE publishing
