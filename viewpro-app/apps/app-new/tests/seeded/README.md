# Seeded Playwright suite — pilot audit trace

All tests run serially (`fullyParallel: false, workers: 1`). Each test uses a fresh page context.
Run with: `pnpm --filter next-shadcn-dashboard-starter test:seeded`

## Audit-row trace table

| Test name (substring)                                        | Audit row (2026-06-13)                              | FR(s)         | File                   |
|--------------------------------------------------------------|-----------------------------------------------------|---------------|------------------------|
| `demo user can navigate the seeded operational`              | Manager dashboard / property list / property detail | (baseline)    | demo-smoke.spec.ts     |
| `martin.demo@viewpro.local sees a distinct assigned`         | Seller assigned-only visibility                     | (baseline)    | demo-smoke.spec.ts     |
| `lucia.demo@viewpro.local sees a distinct assigned`          | Seller assigned-only visibility                     | (baseline)    | demo-smoke.spec.ts     |
| `demo owner can read the owner portal follow-up`             | Owner portal read-only follow-up                    | (baseline)    | demo-smoke.spec.ts     |
| `demo owner can upload a requested document`                 | Owner document upload                               | (baseline)    | demo-smoke.spec.ts     |
| `existing demo owner can accept another property invitation` | Existing-owner invitation acceptance                | (baseline)    | demo-smoke.spec.ts     |
| `demo manager sees seeded internal notifications`            | Manager internal notifications                      | (baseline)    | demo-smoke.spec.ts     |
| `demo owner sees seeded notifications, images and contacts`  | Owner notifications + images + contacts + WhatsApp href | (baseline) + FR-17, FR-18 | demo-smoke.spec.ts |
| `viewpro admin can inspect seeded tenant limits`             | ViewPro admin tenant-limits browser flow            | (baseline)    | demo-smoke.spec.ts     |
| `seller can create movements with outcomes`                  | Movement outcomes + FR-11 status-invariant gate     | (baseline)    | demo-smoke.spec.ts     |
| `demo manager can review a submitted document request`       | Manager reviewing submitted document request        | (baseline)    | demo-smoke.spec.ts     |
| `manager can reject a pending status change request`         | Status change request reject path (manager)         | (baseline)    | demo-smoke.spec.ts     |
| `manager can approve a new status change request`            | Status change request approve path (manager)        | (baseline)    | demo-smoke.spec.ts     |
| `manager can create a new property engagement through the UI` | Manager creates property engagement                | FR-1..FR-4    | demo-smoke.spec.ts     |
| `manager can assign martin to the new engagement`            | Manager assigns seller                              | FR-5..FR-6    | demo-smoke.spec.ts     |
| `manager can remove martin's assignment`                     | Manager assigns seller (unassign path)              | FR-7          | demo-smoke.spec.ts     |
| `manager can create a plain movement without an outcome`     | Manager creates movement/status update              | FR-8..FR-10   | demo-smoke.spec.ts     |
| `manager can create a document request through the UI`       | Manager requests document                           | FR-11..FR-13  | demo-smoke.spec.ts     |
| `manager can reject an uploaded document request with a reason` | Manager approves/rejects document (reject path)  | FR-14..FR-15  | demo-smoke.spec.ts     |
| `owner sees rejection reason and re-upload action`           | Manager approves/rejects document (owner side)      | FR-16         | demo-smoke.spec.ts     |
| `owner WhatsApp click POSTs a tracking event`                | WhatsApp contact link priority + tracking           | FR-17..FR-19  | demo-smoke.spec.ts     |
| `tenant engagement limit blocks creation with a clear UI error` | Tenant suspended/limit behavior                 | FR-20..FR-22  | demo-smoke.spec.ts     |

## Notes

- Baseline tests (rows marked `(baseline)`) existed before Stage 26.3.
- Test 8 (`demo owner sees seeded notifications...`) was extended in Stage 26.3 to also assert the WhatsApp anchor href (FR-17, FR-18).
- T13 (engagement creation) runs after Test 1's `'20 gestiones'` assertion — serial order is required.
- T20 (tenant limit) must be last — it has an `afterEach` that restores `maxActivePropertyEngagements = 25`.
- If T20's `afterEach` fails (e.g. hard process kill), run `pnpm demo:seed` to restore the tenant limit.
