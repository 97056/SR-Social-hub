# Phase 9 completion report — Remaining social integrations

## Delivered

- Catalog-driven OAuth adapters for:
  - Instagram
  - LinkedIn
  - X
  - YouTube
  - TikTok
  - Pinterest
  - Threads
  - Google Business Profile
- Official authorize URL builders per provider docs
- Mock connect/disconnect for all eight
- Mock publishers for architecture-confirmed publishing
- Live auto-publish remains Facebook-first; other live publishes return `ASSISTED_REQUIRED` until provider certification

## Integration status

| Platform | Connection | Mock publish | Live publish |
| --- | --- | --- | --- |
| Facebook | Adapter + mock/live OAuth | Verified | Graph path ready |
| Instagram | Catalog adapter | Verified | Assisted until Meta app review |
| LinkedIn | Catalog adapter | Verified | Assisted until Marketing API approval |
| X | Catalog adapter | Verified | Assisted until write-tier access |
| YouTube | Catalog adapter | Verified | Assisted until upload certification |
| TikTok | Catalog adapter | Verified | Assisted until Content Posting approval |
| Pinterest | Catalog adapter | Verified | Assisted until production access |
| Threads | Catalog adapter | Verified | Assisted until Threads API eligibility |
| Google Business Profile | Catalog adapter | Verified | Assisted until GBP API enablement |

Mock results are never described as real social media publications.

## Verification

- Unit tests: catalog adapters (8), mock publishers, Facebook adapter/publisher, platform rules — passing
- Admin enable: all 9 platforms toggled on
- Mock connect: Instagram, LinkedIn, X, Threads (302 callback → connected accounts)
- Mock publish: LinkedIn target → approve → `/posts/:id/publish` → worker tick → `PUBLISHED` with `mock_li_post_*`
