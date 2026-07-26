# Apply Progress — Stage 20.11 Seguimiento Filter Corrections

**Status**: complete (all 20 tasks done, 5 commits)
**Mode**: Strict TDD
**Size**: size:exception (single PR, ~480 LOC estimated, cohesive bug fix)
**Branch**: `feat/stage-20-11-seguimiento-filter-corrections`

---

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| T-3/T-4/T-5 (business-tz helper) | business-tz.spec.ts written first, 6 tests RED | Helper body implemented, 13 tests GREEN | Algorithm corrected after initial offset bug |
| T-6/T-11 (use case date fix) | S-1..S-3 added RED (T-6) | parseBusinessDayStart wired (T-11), GREEN | Use case comments added |
| T-7/T-8 (repository types) | TypeScript errors would fail on misuse | Types additive, compile clean | N/A |
| T-9/T-10 (Prisma WHERE) | T-13 assertions written as design spec | AND-clause logic implemented, GREEN | Documents builder refactored for clarity |
| T-12 (analytics use-case tests) | S-4, S-5, S-7 RED before use case fix | All GREEN after T-11 | Existing `createdByUserId` assertions updated |
| T-13 (R-D1 tests) | Written as spec for dual EXISTS | Verified against actual Prisma WHERE builder | N/A |
| T-14 (DTO validation) | Added as part of T-12 | GREEN — class-validator accepts YYYY-MM-DD | N/A |
| T-16 (E2E S-4, S-5, S-6) | Written as RED intent tests | GREEN against real Postgres | N/A |
| T-20 (smoke S-8) | Written after seed fixture | 25/25 passed | N/A |

---

## Phase 1: Pre-implementation Audit — COMPLETE

- [x] **T-1**: `date-fns` is in `apps/app-new/package.json` only. API package has zero date libraries. Confirmed. Design decision to use native `Intl` is correct.
- [x] **T-2**: Only `list-activity-feed.use-case.ts` passes `createdByUserId`/`requestedByUserId` in the production Responsable filter path. `get-dashboard-summary.use-case.ts` passes only `from`/`to` — unaffected.

---

## Phase 2: Date Helper — Commit A — COMPLETE

- [x] **T-3**: Created `viewpro-app/apps/api/src/common/date/business-tz.ts`
  - Exports: `BUSINESS_TIMEZONE`, `parseBusinessDayStart`, `parseBusinessDayExclusiveEnd`
  - Algorithm: Intl.DateTimeFormat to find wall-clock components, subtract wall-time offset from UTC midnight to get candidate, add 24h if candidate landed on previous day
  - The initial algorithm had a bug (used UTC midnight date as reference, computing offset for wrong day). Fixed by subtracting wall-clock hour/minute/second and adding 24h when local day doesn't match requested day.
- [x] **T-4 (RED)**: Created `business-tz.spec.ts` with 13 RED tests before implementing body
- [x] **T-5 (GREEN)**: 645 tests passed after implementation

**Commit**: `chore(api): add business-tz helper for canonical timezone date parsing (20.11 phase 2)`

---

## Phase 3: Repository Signatures + Prisma WHERE + Use Case Fix — Commit B — COMPLETE

- [x] **T-6 (RED)**: Added S-1..S-7 failing tests to `analytics.use-cases.spec.ts`
- [x] **T-7**: Added `assignedAgentUserId?: string` to `ListTenantMovementsInput`, kept `createdByUserId` intact
- [x] **T-8**: Added `assignedAgentUserId?: string` to `ListActivityDocumentRequestsInput`, kept `requestedByUserId` intact
- [x] **T-9**: Updated `buildTenantActivityMovementWhere`:
  - `createdAt.lte` → `createdAt.lt` (R2, exclusive end)
  - AND-clause pattern: `{ ...baseEngagementWhere, AND: [...existingAND, { agents: { some: { tenantId, agentUserId: assignedAgentUserId } } }] }`
- [x] **T-10**: Updated `buildActivityRequestWhere` in documents:
  - Same AND-clause pattern
  - Same `lt` fix
  - Refactored to resolve `propertyEngagement` base first, then merge assigned clause
- [x] **T-11**: Wired use case:
  - `new Date(query.dateFrom)` → `parseBusinessDayStart(query.dateFrom)`
  - `new Date(query.dateTo)` → `parseBusinessDayExclusiveEnd(query.dateTo)`
  - `createdByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId`
  - `requestedByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId`

---

## Phase 4: Tests — Commit B (continued) — COMPLETE

- [x] **T-12 (RED→GREEN)**: S-1..S-7 all GREEN in `analytics.use-cases.spec.ts`
  - Updated existing `createdByUserId` → `assignedAgentUserId` assertions
  - Updated existing full ISO timestamps to date-only strings (consistent with UI)
  - R4 test: `@IsISO8601()` accepts `'2026-06-15'` — confirmed GREEN
- [x] **T-13 (R-D1 tests)**: Added dual-EXISTS verification in both `movements.repository.spec.ts` and `documents.repository.spec.ts`
  - Verified AND clause contains independent `agents.some` entries
  - Verified `lt` is used for `createdAt.to`
- [x] **T-14 (DTO test)**: Part of T-12 (R4 test verifies date-only acceptance)
- [x] **T-15 (R-D5 check)**: Dashboard use case tests remain GREEN (57 tests including dashboard)
- [x] **T-16 (E2E S-4, S-5, S-6)**: Added 3 integration tests in `analytics.e2e-spec.ts`

**Commit**: `feat(api): fix Seguimiento date timezone and Responsable filter semantics (20.11 phase 3)`

---

## Phase 5: Seed + Smoke — Commit C — COMPLETE

### T-17 pre-seed audit findings

Count literals that COULD shift with new Boulevares movement:
- `demo-smoke.spec.ts:69` — `'20 gestiones inmobiliarias en total'` — counts ENGAGEMENTS, not movements → NOT affected by adding a movement
- `demo-smoke.spec.ts:44` — `expectedTotal: 8` for Martín — counts ASSIGNED ENGAGEMENTS → NOT affected (Martin already assigned to Boulevares)
- `demo-smoke.spec.ts:50` — `expectedTotal: 6` for Lucía — same → NOT affected
- `analytics.e2e-spec.ts:133,187` — per-test isolated counts, not seeded → NOT affected

**No count assertions need updating.**

- [x] **T-18**: Added S-8 fixture to `createDemoStatusChangeRequests` in `seed-demo.mjs`:
  - Manager-authored `GENERAL_UPDATE` movement on Boulevares, `createdAt: daysAgo(0)` (seed clock = 2026-06-01)
  - `createdByUserId: manager.id` — proves Bug 2: filtering by assignedAgentUserId=Martín returns manager-created movements
- [x] **T-19**: `pnpm demo:seed` exits 0. Summary: Movements: 57, Properties: 20, 20 engagements, Isolation: 1 engagement
- [x] **T-20**: Added S-8 smoke test to `demo-smoke.spec.ts`
  - Signs in as manager, navigates to `/dashboard/seguimiento`
  - Sets `#activity-date-from` and `#activity-date-to` to `2026-06-01` (seed-clock day)
  - Selects Responsable = Martín
  - Asserts Boulevares property title is visible
  - Asserts Lucía-only property (`Casa con jardín en Villa Catalina`) is NOT visible

**Commit**: `test(api+app-new): seed S-8 fixture + seeded smoke for 20.11 (phase 5)`

---

## Phase 6: Verification — COMPLETE

- [x] **T-N1**: `db:validate` PASS, `typecheck` PASS, `test` 659/659 PASS
- [x] **T-N2**: `pnpm --filter next-shadcn-dashboard-starter test` 403/403 PASS
- [x] **T-N3**: `test:seeded` 25/25 PASS (24 baseline + 1 new S-8)
- [x] **T-N4 (sanity inversion)**: Temporarily replaced `parseBusinessDayStart` with `new Date()` in use case → S-1, S-3, S-7 FAIL. Restored → 659 PASS. **Chosen target: S-1 (`parses date-only dateFrom as start-of-day in BUSINESS_TIMEZONE`)**.

---

## Breaking Behavior Change Documentation

The public `GET /api/analytics/activity-feed?sellerId=X` endpoint now scopes results by **assigned PropertyAgent** instead of **row creator**. Any external consumer relying on `sellerId = createdByUserId` semantics will see different results. Per the audit, the only consumer is the internal analytics UI — no external breakage.

---

## Key Implementation Findings (Learned)

### Intl offset algorithm
The naive approach (use UTC midnight as reference, read wall-clock, subtract) fails when UTC midnight corresponds to a different local day (e.g. UTC midnight on June 15 = June 14 21:00 in Buenos Aires). The fix: subtract the wall-clock hours/minutes/seconds from UTC midnight, check if the resulting candidate's local day matches the requested date, and add 24h if not. Works correctly for all UTC-offset zones including DST.

### AND-of-two-EXISTS (R-D1)
Prisma generates a separate `EXISTS` subquery per `agents.some({ agentUserId: X })` clause. When the viewer-scoping clause (`buildActivityEngagementWhere`) already puts an `agents` key on the WHERE, the new Responsable-scoping clause must be added via `AND: [...]` to avoid clobbering the first clause. Overwriting `agents` would collapse two independent filters into one.

### Documents builder needed refactor
The original `buildActivityRequestWhere` spread multiple conditional `propertyEngagement` keys — the last spread won (activeEngagementsOnly overwrote canViewAll). The refactored version resolves `propertyEngagementBase` once, then composes the `assignedAgentUserId` clause via AND.

### Seed clock and smoke date
`DEMO_NOW = 2026-06-01T12:00:00.000Z`. The S-8 manager movement uses `daysAgo(0)` = exactly this instant. The smoke test uses `SEED_CLOCK_DATE = '2026-06-01'` for both dateFrom/dateTo. Argentina midnight for June 1 = `2026-06-01T03:00:00Z`, and the movement at `2026-06-01T12:00:00Z` falls within the day's range — correctly included.
