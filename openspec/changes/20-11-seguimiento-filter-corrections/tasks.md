# Tasks: Stage 20.11 Seguimiento Daily Workflow Corrections

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~480 (helper 60 + use-case 20 + repo types+WHERE 80 + tests 250 + DTO test 20 + seed+count fixes 50) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single-pr-with-size-exception |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

> **Note**: Estimated 480 lines is ~20% over budget. Design explicitly recommends single-PR because the change is a cohesive bug fix with no independently deployable slice. Apply phase proceeds with `size:exception` after explicit maintainer acknowledgment.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All fixes, tests, seed, smoke | PR 1 (single) | size:exception — cohesive bug fix; no independent slice boundary |

---

## Phase 1: Pre-implementation Audit

- [ ] **T-1** — Run `rg "date-fns|dayjs|luxon" viewpro-app/apps/api/package.json viewpro-app/apps/api/package-lock.json 2>/dev/null` to confirm the API package has zero date-lib dependency. Done when: output is empty or confirms absence. If a lib is found, surface the delta before proceeding.
- [ ] **T-2** — Run `rg "findManyByTenant|listActivityRequests" viewpro-app/apps/api/src --include="*.ts" -l` to enumerate all callers. Done when: confirmed `list-activity-feed.use-case.ts` is the only production caller that passes `createdByUserId`/`requestedByUserId` to the filter path, and `get-dashboard-summary.use-case.ts` does NOT.

---

## Phase 2: Date Helper — Commit A

- [ ] **T-3** — Create `viewpro-app/apps/api/src/common/date/business-tz.ts`. Exports: `BUSINESS_TIMEZONE`, `parseBusinessDayStart(input, timezone?)`, `parseBusinessDayExclusiveEnd(input, timezone?)`. Uses native `Intl.DateTimeFormat` only (no new dependency). JSDoc on `parseBusinessDayExclusiveEnd` must state: "exclusive end — paired with Prisma `lt`. Do NOT change to `lte`." Done when: file exists with exported symbols.
- [ ] **T-4 (RED)** — Create `viewpro-app/apps/api/src/common/date/business-tz.spec.ts` with failing tests BEFORE implementing the body:
  - `parseBusinessDayStart('2026-06-15', 'America/Argentina/Buenos_Aires')` → `new Date('2026-06-15T03:00:00.000Z')` (covers FR-1, FR-3)
  - `parseBusinessDayExclusiveEnd('2026-06-15', 'America/Argentina/Buenos_Aires')` → `new Date('2026-06-16T03:00:00.000Z')` (covers FR-2, FR-3)
  - invalid input (no `T` suffix required — date-only `'2026-06-15'` is valid; non-date string throws or returns null) (covers NFR-1)
  Done when: `pnpm --filter @viewpro/api test` shows these 3 cases RED.
- [ ] **T-5 (GREEN)** — Implement `business-tz.ts` body using the R3 algorithm. Done when: `pnpm --filter @viewpro/api test` shows `business-tz.spec.ts` GREEN and full suite stays GREEN (R-D5 baseline confirmed).

---

## Phase 3: Repository Signatures + Prisma WHERE — Commit B

- [ ] **T-6 (RED)** — In `viewpro-app/apps/api/test/analytics.use-cases.spec.ts`, add failing test for S-1: call `useCase.execute(...)` with `{ dateFrom: '2026-06-15' }`, assert spy on `movementsRepository.findManyByTenant` received `from: new Date('2026-06-15T03:00:00.000Z')`. Done when: test is RED (current code passes a raw `Date('2026-06-15')` which is wrong).
- [ ] **T-7** — In `viewpro-app/apps/api/src/movements/movements.repository.ts`, add `assignedAgentUserId?: string` to `ListTenantMovementsInput`. Keep `createdByUserId?: string` intact. Done when: TypeScript compiles with no new errors.
- [ ] **T-8** — In `viewpro-app/apps/api/src/documents/documents.repository.ts`, add `assignedAgentUserId?: string` to `ListActivityDocumentRequestsInput`. Keep `requestedByUserId?: string` intact. Done when: TypeScript compiles with no new errors.
- [ ] **T-9** — In `viewpro-app/apps/api/src/movements/prisma-movements.repository.ts` (`buildTenantActivityMovementWhere`): when `assignedAgentUserId` is set, merge via `AND: [...existingAND, { agents: { some: { tenantId, agentUserId: assignedAgentUserId } } }]` (R-D1 pattern from design AD-3). Change `createdAt.lte` → `createdAt.lt` for `dateTo` (R2). Done when: no compilation errors and T-12 passes.
- [ ] **T-10** — In `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts` (`buildActivityRequestWhere`): same `AND` merge pattern for `assignedAgentUserId`. Change `createdAt.lte` → `createdAt.lt` for `dateTo`. Done when: no compilation errors and T-12 documents equivalent passes.
- [ ] **T-11** — In `viewpro-app/apps/api/src/analytics/use-cases/list-activity-feed.use-case.ts`: replace `new Date(query.dateFrom)` / `new Date(query.dateTo)` with `parseBusinessDayStart` / `parseBusinessDayExclusiveEnd`. Replace `createdByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId` and `requestedByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId`. Done when: T-6 goes GREEN and existing tests still compile.

---

## Phase 4: Use-Case + Repository Tests — Commit B (continued)

- [ ] **T-12 (RED→GREEN)** — In `viewpro-app/apps/api/test/analytics.use-cases.spec.ts`, add/extend tests for S-1..S-7:
  - S-1: `dateFrom` date-only → spy receives `from: new Date('2026-06-15T03:00:00.000Z')` (covers FR-1, FR-3)
  - S-2: `dateTo` date-only → spy receives `to: new Date('2026-06-16T03:00:00.000Z')` (covers FR-2, FR-3)
  - S-3: `dateFrom = dateTo = '2026-06-15'` → non-empty range, no collapsed filter (covers FR-1, FR-2)
  - S-4: `sellerId='seller-a'` → spy receives `assignedAgentUserId: 'seller-a'`, NOT `createdByUserId: 'seller-a'` (covers FR-4, FR-6)
  - S-5: `sellerId='seller-a'` → documents spy receives `assignedAgentUserId: 'seller-a'`, NOT `requestedByUserId: 'seller-a'` (covers FR-5, FR-6)
  - S-6: isolation — mocked payloads show seller-a filter excludes seller-b items (covers FR-4, FR-5)
  - S-7: date-only spy records `from = new Date('2026-06-15T03:00:00.000Z')`, not `T00:00:00.000Z` (covers FR-7, FR-8)
  - Update existing `createdByUserId` / `requestedByUserId` assertions to `assignedAgentUserId` (test refactor noted in design backward-compat audit).
  Done when: all S-1..S-7 GREEN.
- [ ] **T-13 (R-D1 test)** — In `viewpro-app/apps/api/test/movements.repository.spec.ts`, add test: `findManyByTenant` with `{ canViewAll: false, assignedAgentUserId: 'seller-a' }` → assert the Prisma `findMany` call receives `propertyEngagement: { AND: [{ agents: { some: { agentUserId: currentUserId } } }, { agents: { some: { agentUserId: 'seller-a' } } }] }`. Done when: verifies two independent EXISTS subqueries, not a single collapsed `some({ agentUserId: both })`. Also add equivalent test in `viewpro-app/apps/api/test/documents.repository.spec.ts`.
- [ ] **T-14 (DTO test)** — Add test in `viewpro-app/apps/api/src/analytics/dto/list-activity-feed.query.spec.ts` (create if absent): `validate(Object.assign(new ListActivityFeedQuery(), { dateFrom: '2026-06-15', dateTo: '2026-06-15' }))` → errors array does not contain `dateFrom` or `dateTo` (covers R4, FR-7). Done when: GREEN confirms `@IsISO8601()` accepts date-only strings.
- [ ] **T-15 (R-D5 check)** — Run `cd viewpro-app && pnpm --filter @viewpro/api test` after T-7..T-11 land. Confirm `getDashboardSummaryUseCase` suite is GREEN (dashboard uses `from`/`to` as `Date` instants, not date-only strings — not affected by the helper or signature change). Done when: suite output shows zero failures in dashboard-related describes.
- [ ] **T-16 (integration test RED→GREEN)** — Extend `viewpro-app/apps/api/test/analytics.e2e-spec.ts`:
  - S-4 variant: real Postgres, seed a manager-created movement on a seller-assigned engagement, filter by `sellerId`, assert movement appears in response.
  - S-5 variant: same for a manager-requested document.
  - S-6 variant: assert other-seller items excluded.
  Done when: three new e2e cases GREEN against `viewpro_test` DB.

---

## Phase 5: Seed + Smoke — Commit C

- [ ] **T-17 (pre-seed audit)** — Run `rg -n "count\|length\|toHaveLength\|toEqual.*\d+" viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts viewpro-app/apps/api/test/*.e2e-spec.ts` to list all literal count assertions that could shift when the new manager-authored movement on Boulevares is added. List affected lines in `apply-progress.md` before touching the seed. Done when: list is complete.
- [ ] **T-18** — Update `viewpro-app/apps/api/scripts/seed-demo.mjs`:
  - Add ONE manager-created movement on Boulevares in `createStatusChangeRequestFixtures` (type: `GENERAL_UPDATE`, `createdByUserId: manager.id`, `daysAgo()` within seed-clock window).
  - Flip the ONE document request on Boulevares (`requestedByUserId: martin.id` at line ~1810) to `requestedByUserId: manager.id`.
  - In the same commit, update any count assertions identified in T-17 to their new expected values.
  Done when: seed file saved, count assertions updated, no assertion is stale.
- [ ] **T-19** — Run `cd viewpro-app && pnpm --filter @viewpro/api demo:seed` and confirm exit 0 with no Prisma errors. Done when: clean seed run confirmed.
- [ ] **T-20 (smoke test)** — Add test in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` covering S-8:
  - Sign in as manager.
  - Navigate to `/dashboard/seguimiento`.
  - Apply `dateFrom = <seed-clock-day>` and `dateTo = <seed-clock-day>` in both date pickers.
  - Select Responsable = Martín from the dropdown.
  - Assert: feed contains at least one item from Martín's Boulevares property (the new manager-authored movement).
  - Assert: feed contains no item from properties assigned only to Sofía or Lucía.
  Done when: Playwright test passes under `test:seeded`.

---

## Phase 6: Verification Pass

- [ ] **T-N1** — `cd viewpro-app && pnpm --filter @viewpro/api db:validate && pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api test` — all GREEN. Done when: zero failures, zero type errors.
- [ ] **T-N2** — `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter test` — GREEN at 403 baseline. Done when: no new failures.
- [ ] **T-N3** — `cd viewpro-app && APP_PUBLIC_URL=... pnpm --filter next-shadcn-dashboard-starter test:seeded` — GREEN with ≥ 25 tests (24 baseline + 1 new S-8 smoke). Done when: count ≥ 25.
- [ ] **T-N4 (sanity inversion)** — Temporarily revert `parseBusinessDayStart` call in `list-activity-feed.use-case.ts` (reintroduce `new Date(query.dateFrom)`). Confirm at least one of T-12 S-1/S-2/S-3 FAILs. Restore. Confirm GREEN. Document which test caught the regression in `apply-progress.md`. Done when: inversion confirmed and reverted.

---

## Acceptance Map

| Scenario | Task(s) that prove it | FR(s) |
|----------|-----------------------|-------|
| S-1 — date lower bound | T-4, T-6, T-12 | FR-1, FR-3 |
| S-2 — exclusive upper bound | T-4, T-6, T-12 | FR-2, FR-3 |
| S-3 — same-day non-empty range | T-12 | FR-1, FR-2, FR-3 |
| S-4 — manager-created movement via assigned seller | T-12, T-13, T-16 | FR-4, FR-6 |
| S-5 — manager-requested doc via assigned seller | T-12, T-13, T-16 | FR-5, FR-6 |
| S-6 — cross-seller isolation | T-12, T-16 | FR-4, FR-5 |
| S-7 — date-only input in unit test | T-12 | FR-7, FR-8 |
| S-8 — seeded smoke round-trip | T-20 | FR-1, FR-2, FR-4 |
| No spec drift | T-N1 typecheck | — |
| No kind/type filter change | T-2 (audit), T-N1 | — |
| No new dependency | T-1 | R3 |

---

## Task Dependency Order

```
T-1, T-2 (parallel, pre-flight)
  └─ T-3 → T-4 (RED) → T-5 (GREEN) [Commit A]
       └─ T-6 (RED) → T-7, T-8 (parallel) → T-9, T-10 (parallel) → T-11 (GREEN use-case)
            └─ T-12, T-13, T-14 (parallel unit tests)
            └─ T-15 (dashboard regression check, depends on T-11)
            └─ T-16 (e2e, depends on T-11) [Commit B closes here]
  └─ T-17 (pre-seed audit) → T-18 → T-19 → T-20 [Commit C]
  └─ T-N1, T-N2, T-N3, T-N4 (parallel verification, all depend on Commits A+B+C)
```
