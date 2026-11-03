# Phase 8 completion report — Publishing engine

## Delivered

- `PublishingJob` + `PublishingEvent` durable queue (DB-backed)
- Interval worker (no Redis required locally; Redis/BullMQ can replace later)
- Per-target jobs with idempotency keys
- Approval verification before each attempt
- Facebook publisher: mock confirmed + live Graph API path
- Other platforms (pre–Phase 9): `ASSISTED_REQUIRED`; Phase 9 adds mock publishers per network
- Retry with exponential backoff, cancel, publish-now/enqueue APIs
- Publishing Queue UI

## Statuses

Queued, Scheduled, Publishing, Published, Failed, Retry Pending, Cancelled, Requires Reauth, Assisted Required

## Notes

- Mock Facebook publishes return `mock_fb_post_*` IDs and are never described as live publications
- Worker polls every 5s (`PUBLISHING_POLL_MS`)
- Set `PUBLISHING_WORKER_ENABLED=false` to disable background processing
- Approval UI enqueues `/posts/:id/publish` after final approval (avoids Nest circular DI)
- Verified: approve → publish → worker tick → `PUBLISHED` with `mock_fb_post_*`
