# Phase 7 completion report — Approval engine

## Delivered

- `PostApproval` model with revision, step, decision, comments, approver
- Workflows A–D via client `approvalWorkflow`
- Start flow on submit-for-approval
- Invalidate pending approvals when content is edited
- Company + client approval inboxes
- Approve / Reject / Request changes
- Multi-step CLIENT → COMPANY advancement
- `verifyApprovalsValid` for publishing gate (Phase 8)

## Verification notes

- Decisions are revision-scoped
- Stale approvals for older revisions cannot be decided
- Auto-schedule workflow marks post `SCHEDULED` after final client approval when `scheduledAt` is set
