# Seeded Playwright suite — pilot audit trace

All tests run serially (`fullyParallel: false, workers: 1`). Each test uses a fresh page context.
Run with: `pnpm --filter next-shadcn-dashboard-starter test:seeded`

## In CI

The `Seeded E2E` job in `.github/workflows/ci.yml` runs this suite on every pull
request, against its own `viewpro_seeded` database. It is a separate job from
`Test` on purpose: it boots the real API and web server, so it neither shares the
per-worker test databases nor competes with the unit gate for the runner.

- **Budget**: ~2 minutes of journeys plus server boot; the job caps at 20 minutes
  as a backstop against a web server that never comes up, not as a target.
- **`forbidOnly`** is on under CI. A committed `.only` fails the job instead of
  running one journey and reporting the suite green.
- **One retry** under CI, and exactly one — a second would start hiding real
  failures rather than absorbing noise.
- **On failure**, traces, screenshots and video are retained and uploaded as the
  `seeded-e2e-report` artifact. `retain-on-failure`, not `on-first-retry`: a
  journey that fails both attempts is the one worth a trace.

This suite had not started since 2026-07-20 — `PLATFORM_CONTROL_SECRET` became
required by the API env schema and the Playwright config was never updated. It
was invisible because nothing ran it. Keeping it in CI is what stops that
recurring; if you add an env var the API requires, add it here too.

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

| `isolation: seller direct deep-link to unassigned property is denied` | Seller unassigned (UI denial) | S-5, B-2 | FB-1 / Coverage matrix — Seller unassigned | FR-3 (UI) | demo-smoke.spec.ts |
| `isolation: owner direct deep-link to unowned property is denied`      | Owner unauthorised (UI denial) | S-7, B-3 | JD-2 / Coverage matrix — Owner unauthorised | FR-6 (UI) | demo-smoke.spec.ts |

## Notes

- Baseline tests (rows marked `(baseline)`) existed before Stage 26.3.
- Test 8 (`demo owner sees seeded notifications...`) was extended in Stage 26.3 to also assert the WhatsApp anchor href (FR-17, FR-18).
- T13 (engagement creation) runs after Test 1's `'20 gestiones'` assertion — serial order is required.
- T20 (tenant limit) must be last — it has an `afterEach` that restores `maxActivePropertyEngagements = 25`.
- If T20's `afterEach` fails (e.g. hard process kill), run `pnpm demo:seed` to restore the tenant limit.
- Stage 26.4 (isolation block): U-1 must use `signInSellerWithTenantContext` (not the plain `signIn`) to ensure the active tenant context is established before navigating to a deep link — otherwise `MissingTenantState` renders instead of the denial surface.
- U-2 requires the isolation tenant seed fixture (slug: `viewpro-isolation-tenant`). Run `pnpm demo:seed` to ensure both tenants are seeded before running the isolation block.
