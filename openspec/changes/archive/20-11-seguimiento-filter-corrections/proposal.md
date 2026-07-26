# Proposal — Stage 20.11 Seguimiento Daily Workflow Corrections

**Status:** proposed, ready to enter SDD `sdd-spec` after acceptance.
**Origin:** `docs/plans/2026-06-08-stage-26-0-mvp-evidence-audit.md`, FB-4 (Seguimiento filters do not return expected results). Reproduction completed on 2026-06-16 with concrete bug evidence below.
**Plan reference:** `docs/plans/2026-06-14-mvp-execution-plan-revision.md`, Phase B, slice B7. Now slice 2 in the development-mode-reframed handoff after 26.6a closed.

## Slice contract

```txt
Stage: 20
Slice: 20.11 — Seguimiento daily workflow corrections
Objective: fix the confirmed Seguimiento filter bugs the audit identified, without turning the feature into advanced BI.
Evidence needed: API and UI tests proving the date filter respects user timezone, the Responsable filter matches user expectation (assigned seller, not row creator), and previously failing scenarios pass.
Do not touch: advanced reporting, exports, archived analytics, KPI dashboards, restructuring of the activity feed data model, or new filter dimensions.
Done: every confirmed bug below has a RED test, then GREEN fix, and the seeded Playwright smoke gains a small filter exercise.
Next slice: 20.9 — Seguimiento document activity proof.
```

## Reproduction summary (2026-06-16)

The audit said the filters "do not return expected results". I walked the code path from `ActivityFilters` → `getActivityFeed` service → BFF `/api/activity/feed` route → backend `ListActivityFeedUseCase` → repository queries to identify what's actually broken. Three bugs confirmed; one tests coverage gap.

### Bug 1 — Date filter timezone offset

`viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts:47-48`:

```ts
const from = query.dateFrom ? new Date(query.dateFrom) : undefined
const to = query.dateTo ? new Date(query.dateTo) : undefined
```

The UI sends `dateFrom='2026-06-15'` (HTML `<input type="date">` value, date-only, no time). `new Date('2026-06-15')` parses as UTC midnight, which in Argentina (UTC-3) is `2026-06-14T21:00:00`.

Effects:
- User picks "from 2026-06-15, to 2026-06-15" expecting all events on that day → backend filter becomes `gte 2026-06-15T00:00:00Z` AND `lte 2026-06-15T00:00:00Z`, an empty range (only events at exact UTC midnight).
- User picks `dateFrom='2026-06-15'` alone → filter starts 3h before midnight local → includes Saturday evening events the user did NOT intend to see.
- User picks `dateTo='2026-06-15'` alone → filter ends at midnight UTC of that day → excludes anything on June 15 after 21:00 UTC (most of the user's June 15).

Same logic applies to the documents path (`requestedByUserId` filter receives the same `from`/`to`).

### Bug 2 — Responsable filter semantic mismatch

The dropdown is labelled `Responsable` in `ActivityFilters` and populated with `assignableAgents`. Users expect "show me activity on this responsable's assigned properties".

The backend maps `query.sellerId` to:
- `createdByUserId` on the movements query (line 68 of the use case)
- `requestedByUserId` on the documents query (line 80)

That filters by **who created the row**, not by **who is the assigned seller of the property**.

Effects:
- A manager creates a movement on Seller A's property → `createdByUserId = manager.id` → filtering by `sellerId = sellerA.id` HIDES that movement even though it concerns Seller A's property.
- Filtering documents the same way: a manager-requested document for Seller A's property disappears when filtering by Seller A.
- The seller's daily feed shows their own creations, but the manager's "responsable view" misses anything not authored by the chosen person.

### Bug 3 — Test coverage gap

`viewpro-app/apps/api/test/analytics.use-cases.spec.ts:161-162` passes `dateFrom: "2026-05-20T00:00:00.000Z"` — a fully-qualified UTC ISO timestamp. The unit test never reproduces the date-only input the UI sends, so the timezone bug is invisible to CI. Similarly, no test asserts the intended Responsable semantics — only that the parameter reaches the repository under the wrong column name.

## Scope

- **Backend fix for Bug 1**: in the use case, parse `dateFrom` as the start of day in the canonical tenant/business timezone (America/Argentina/Buenos_Aires for MVP) and `dateTo` as the end of day (start of next day, exclusive — or end-of-day inclusive). Use a small helper, not ad-hoc logic. Update both the movements and documents call sites.
- **Backend fix for Bug 2**: introduce a new repository filter that scopes movements to engagements where the chosen user is an assigned PropertyAgent. Similarly for the documents path: scope document requests to engagements where the chosen user is an assigned PropertyAgent. The existing `createdByUserId` semantic is removed from the public Responsable filter; if any future feature needs the "who created" semantic, it can introduce its own parameter.
- **Tests** (RED first, then GREEN):
  - Unit test: date-only `dateFrom`/`dateTo` produce a filter that includes events from start-of-day in the canonical timezone to end-of-day, not midnight UTC.
  - Unit test: filtering by Responsable=X returns movements/documents on properties where X is assigned, regardless of who created the row.
  - Integration test: same as above against a real Postgres with seeded data including a manager-created movement on a seller-assigned property and a seller-created movement on a different property.
  - Component test: the existing `ActivityFilters` RTL test stays green; add one new test that confirms the date input round-trips correctly.
  - Seeded Playwright smoke: extend `demo-smoke.spec.ts` with one short test that applies a date filter and a Responsable filter, and asserts the visible feed matches expectation against the seeded data.
- **No new feature flags**, **no new UI strings**, and **no new column** beyond the test additions.

## Out of scope

- Per-tenant timezone configuration. MVP locks Argentina; a future slice can introduce a tenant-level setting.
- Advanced reporting, exports, archived analytics, BI dashboards, or KPI work.
- Re-design of the filter UX or new filter dimensions.
- Changes to the activity feed data model, response shape, or sorting.
- The `kind` and `type` filters: the code path looks correct on inspection; no failing scenario was reproduced. The slice does NOT touch them.
- Any change to the API 403 guard or to the 26.2 deterministic seed contract.

## Preserve unchanged

- Pagination, sorting, response shape, and permission scoping (`canViewAll` vs `canViewAssigned`).
- The existing 22/22 seeded smoke baseline + 13 API negative tests added by 26.4.
- The 26.2 seed contract.
- The existing `ActivityFilters` component layout and accessibility.

## Affected areas

- `viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts` — date parsing fix, sellerId → assigned-PropertyAgent semantics fix.
- `viewpro-app/apps/api/src/movements/movements.repository.ts` + `prisma-movements.repository.ts` — new input parameter for the assigned-agent filter; update the `WHERE` builder.
- `viewpro-app/apps/api/src/documents/documents.repository.ts` + `prisma-documents.repository.ts` — same.
- `viewpro-app/apps/api/src/common/date/` (likely new file) or wherever date helpers live — small helper for "start of day in canonical tz" and "end of day".
- `viewpro-app/apps/api/test/analytics.use-cases.spec.ts` and `viewpro-app/apps/api/test/analytics.e2e-spec.ts` — extend with the new RED→GREEN cases.
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — extend with the small filter exercise.
- This OpenSpec change folder.

## Safety and integrity constraints

- The Responsable semantic change is a **breaking behavior change for the API contract** if any external consumer relied on `sellerId=createdByUserId`. The audit covers internal-only consumers, so this is acceptable, but the change must be documented in the apply-progress.
- New unit tests assert the date filter behaviour against fixed clock inputs (no `new Date()` without injected dependency).
- Tests must use the canonical Argentina timezone explicitly, not the host's local timezone — set `TZ=America/Argentina/Buenos_Aires` in the test environment or use a date library that takes an explicit timezone.
- No `--no-verify` on commits.

## Risks

- **Date library choice**: native `Intl.DateTimeFormat` + manual offset math vs `date-fns` or `dayjs`. Mitigation: the design phase picks one. Recommend whatever is already in the project to avoid a new dependency.
- **Performance of the assigned-PropertyAgent filter**: a new `WHERE` clause on the engagement subquery. Mitigation: the existing index on `(propertyEngagementId, userId)` on `PropertyAgent` should cover it; design verifies.
- **Backwards compatibility**: if any caller of the analytics API used `sellerId` expecting the old creator semantic, they break silently. Mitigation: search the codebase for callers; document; flag any external dependency in apply-progress.
- **Test environment timezone leakage**: tests on a CI runner in UTC must still pass. Mitigation: explicitly set `TZ` for the affected suite or use a tz-explicit date library.

## Rollback

Revert the use case fix, the repository signature change, the date helper, the new tests, and this OpenSpec change folder. Pre-existing tests stay green; the pre-existing bugs return.

## Success criteria

- Bug 1: a unit test that picks `dateFrom='2026-06-15'` and `dateTo='2026-06-15'` returns events from start-of-day to end-of-day in Argentina, not an empty range.
- Bug 2: a unit test that filters by Responsable=Seller A returns manager-created movements on Seller A's assigned property AND seller-A-created movements on the same property.
- Bug 3: the seeded Playwright smoke gains one focused scenario that exercises date + Responsable filters and asserts the visible feed matches expectation.
- No regression: full `pnpm --filter @viewpro/api test`, `pnpm --filter next-shadcn-dashboard-starter test`, `pnpm --filter next-shadcn-dashboard-starter test:seeded` stay green.

## Next phases

Move to SDD `sdd-spec` once this proposal is accepted. The spec phase converts Bug 1, Bug 2, Bug 3, and the seeded smoke extension into testable FRs and scenarios with explicit timezone fixtures.
