# Spec — Stage 20.11 Seguimiento Daily Workflow Corrections

## Slice contract (inherited verbatim from proposal)

```txt
Stage: 20
Slice: 20.11 — Seguimiento daily workflow corrections
Objective: fix the confirmed Seguimiento filter bugs the audit identified, without turning the feature into advanced BI.
Evidence needed: API and UI tests proving the date filter respects user timezone, the Responsable filter matches user expectation (assigned seller, not row creator), and previously failing scenarios pass.
Do not touch: advanced reporting, exports, archived analytics, KPI dashboards, restructuring of the activity feed data model, or new filter dimensions.
Done: every confirmed bug below has a RED test, then GREEN fix, and the seeded Playwright smoke gains a small filter exercise.
Next slice: 20.9 — Seguimiento document activity proof.
```

## Bug → FR mapping

| Bug | FR | Assertion | Trace |
|-----|----|-----------|-------|
| Bug 1 | FR-1 | When `dateFrom` is a date-only string (`YYYY-MM-DD`), the system MUST parse it as the start of that calendar day in `America/Argentina/Buenos_Aires` (UTC-3), producing a UTC timestamp of `T03:00:00Z` for dates with no DST offset. | use-case.ts:47 |
| Bug 1 | FR-2 | When `dateTo` is a date-only string (`YYYY-MM-DD`), the system MUST parse it as the exclusive end boundary — start of the **next** calendar day in `America/Argentina/Buenos_Aires` — producing UTC `T03:00:00Z` of day+1. The Prisma filter MUST use `lt`, not `lte`. | use-case.ts:48, prisma-movements.repository.ts:275 |
| Bug 1 | FR-3 | A helper function MUST encapsulate date-only → UTC conversion for the canonical timezone. It MUST accept a `YYYY-MM-DD` string and return a `Date`. The use case MUST call this helper instead of `new Date(string)` for `dateFrom` and `dateTo`. The same helper MUST be applied to both the movements call (use-case.ts:68 area) and the documents call (use-case.ts:80 area). | use-case.ts:47-48 |
| Bug 2 | FR-4 | The movements repository `ListTenantMovementsInput` MUST replace the `createdByUserId` field with `assignedAgentUserId` (or equivalent name chosen at design time). The use case MUST pass `query.sellerId` to this new field. The `WHERE` clause MUST become `propertyEngagement.agents.some({ agentUserId: X })` instead of `createdByUserId = X`. | movements.repository.ts:68, prisma-movements.repository.ts:281-283 |
| Bug 2 | FR-5 | The documents repository `ListActivityDocumentRequestsInput` MUST replace `requestedByUserId` as the Responsable filter with an equivalent assigned-agent filter: `propertyEngagement.agents.some({ agentUserId: X })`. The use case MUST pass `query.sellerId` to this new field. | documents.repository.ts:86-96, use-case.ts:80 |
| Bug 2 | FR-6 | The `createdByUserId` / `requestedByUserId` parameters MUST be removed from the public Responsable filter path. Any internal usage for non-filter purposes (e.g., audit or creator attribution) MUST NOT be changed. | use-case.ts:68, 80 |
| Bug 3 | FR-7 | The unit test suite (`analytics.use-cases.spec.ts`) MUST include at least one test that passes a date-only string (`'2026-06-15'`, no `T` suffix) for `dateFrom` and/or `dateTo` and asserts the resulting repository call receives the correct UTC-offset boundary. | analytics.use-cases.spec.ts:161-162 |
| Bug 3 | FR-8 | All tests that assert date-filter behavior MUST explicitly control timezone. Either the test process MUST be launched with `TZ=America/Argentina/Buenos_Aires`, or the date helper MUST accept an explicit timezone argument and tests MUST pass the canonical timezone string. Tests MUST NOT rely on the host's local timezone. | analytics.use-cases.spec.ts |

## Behavior contract

### Date filter semantics

Canonical business timezone: `America/Argentina/Buenos_Aires` (UTC-3, no DST).

| Input param | User intent | Expected Prisma filter |
|-------------|-------------|----------------------|
| `dateFrom='2026-06-15'` | Events from the start of June 15 (local) | `createdAt >= 2026-06-15T03:00:00.000Z` |
| `dateTo='2026-06-15'` | Events up to end of June 15 (local), exclusive-end | `createdAt < 2026-06-16T03:00:00.000Z` |
| `dateFrom='2026-06-15'` + `dateTo='2026-06-15'` | All events on June 15 (local) | `createdAt >= 2026-06-15T03:00:00Z AND createdAt < 2026-06-16T03:00:00Z` |
| `dateFrom` absent | No lower bound | No `gte` clause |
| `dateTo` absent | No upper bound | No `lt` clause |

The `dateTo` boundary is **exclusive-end (start of next day)**. This produces correct full-day ranges and avoids edge cases at second/millisecond boundaries. The design phase MUST implement `lt`, not `lte`, for `dateTo`.

The DTO's `@IsISO8601()` validator already accepts date-only strings (`YYYY-MM-DD` is valid ISO 8601). No DTO change is needed.

### Responsable filter semantics

| Path | Before (broken) | After (correct) |
|------|-----------------|-----------------|
| Movements | `WHERE createdByUserId = X` | `WHERE propertyEngagement.agents.some({ agentUserId: X })` |
| Documents | `WHERE requestedByUserId = X` | `WHERE propertyEngagement.agents.some({ agentUserId: X })` |

The `PropertyAgent` model (schema.prisma:450) uses the field `agentUserId`. The unique constraint is `@@unique([propertyEngagementId, agentUserId])` and index is `@@index([tenantId, agentUserId])`. The design phase MUST use `agentUserId` in the `some()` filter to align with the existing index.

The existing permission-scoping filter in `buildActivityEngagementWhere` already uses `agents.some({ agentUserId: input.userId })` — the new Responsable filter MUST follow the same pattern and be composable alongside it.

### Out of scope reaffirmed

The `kind` and `type` filters are NOT modified. Their code paths were inspected and no failing scenario was reproduced.

## Acceptance scenarios

### S-1 — Date filter: start-of-day lower bound (Bug 1)

- GIVEN a manager calls `GET /activity/feed` with `dateFrom=2026-06-15`
- WHEN the use case converts the parameter
- THEN the movements repository is called with `from = new Date('2026-06-15T03:00:00.000Z')`
- AND events created at `2026-06-15T02:59:59Z` are excluded
- AND events created at `2026-06-15T03:00:00Z` are included

### S-2 — Date filter: exclusive-end upper bound (Bug 1)

- GIVEN a manager calls `GET /activity/feed` with `dateTo=2026-06-15`
- WHEN the use case converts the parameter
- THEN the movements repository is called with `to = new Date('2026-06-16T03:00:00.000Z')` and Prisma uses `lt`
- AND events created at `2026-06-16T02:59:59Z` are included
- AND events created at `2026-06-16T03:00:00Z` are excluded

### S-3 — Date filter: same-day range produces non-empty result (Bug 1)

- GIVEN a manager calls `GET /activity/feed` with `dateFrom=2026-06-15` and `dateTo=2026-06-15`
- AND there is a movement created at `2026-06-15T12:00:00-03:00` (UTC: `2026-06-15T15:00:00Z`)
- WHEN the use case executes
- THEN the response includes that movement
- AND the filter does NOT produce an empty range

### S-4 — Responsable filter: manager-created movement on assigned property (Bug 2)

- GIVEN Seller A (`agentUserId=seller-a`) is assigned to PropertyEngagement PE-1
- AND a manager (not Seller A) created a Movement M-1 on PE-1 (`createdByUserId=manager-id`)
- WHEN a manager calls `GET /activity/feed` with `sellerId=seller-a`
- THEN M-1 is included in the response
- AND M-1 would have been excluded under the old `createdByUserId` filter

### S-5 — Responsable filter: manager-requested document on assigned property (Bug 2)

- GIVEN Seller A (`agentUserId=seller-a`) is assigned to PropertyEngagement PE-1
- AND a manager created DocumentRequest DR-1 on PE-1 (`requestedByUserId=manager-id`)
- WHEN a manager calls `GET /activity/feed` with `sellerId=seller-a`
- THEN DR-1 is included in the response

### S-6 — Responsable filter: cross-seller isolation (Bug 2)

- GIVEN Seller A is assigned to PE-1 and Seller B is assigned to PE-2
- AND there is a Movement M-B created on PE-2 by Seller B
- WHEN filtering by `sellerId=seller-a`
- THEN M-B is NOT included in the response

### S-7 — Unit test uses date-only input to expose timezone bug (Bug 3)

- GIVEN the unit test suite for `ListActivityFeedUseCase`
- WHEN a test is added with `dateFrom: '2026-06-15'` (no `T` suffix, date-only)
- THEN the spy on `movementsRepository.findManyByTenant` records `from = new Date('2026-06-15T03:00:00.000Z')`
- AND the test MUST NOT pass a full ISO timestamp (`T00:00:00.000Z`) for this assertion

### S-8 — Seeded Playwright smoke: date + Responsable filter round-trip (Bug 3)

- GIVEN the demo seed data is loaded and the manager is signed in
- AND the seed clock day is the date on which at least one movement for Martín's assigned property was created
- WHEN the manager navigates to Seguimiento, applies `dateFrom = <seed-clock-day>` and `dateTo = <seed-clock-day>`, and selects Responsable = `Martín`
- THEN the feed displays at least one item belonging to Martín's assigned property
- AND no items from properties not assigned to Martín are shown

## Acceptance map

| Scenario | Test file | Function/describe | FR(s) proven |
|----------|-----------|-------------------|--------------|
| S-1 | `apps/api/test/analytics.use-cases.spec.ts` | `date filter lower bound` | FR-1, FR-3 |
| S-2 | `apps/api/test/analytics.use-cases.spec.ts` | `date filter exclusive upper bound` | FR-2, FR-3 |
| S-3 | `apps/api/test/analytics.use-cases.spec.ts` | `same-day range is non-empty` | FR-1, FR-2, FR-3 |
| S-4 | `apps/api/test/analytics.use-cases.spec.ts` + `apps/api/test/analytics.e2e-spec.ts` | `Responsable filter includes manager-created movements` | FR-4, FR-6 |
| S-5 | `apps/api/test/analytics.use-cases.spec.ts` + `apps/api/test/analytics.e2e-spec.ts` | `Responsable filter includes manager-requested documents` | FR-5, FR-6 |
| S-6 | `apps/api/test/analytics.use-cases.spec.ts` | `Responsable filter excludes other sellers` | FR-4, FR-5 |
| S-7 | `apps/api/test/analytics.use-cases.spec.ts` | `date-only input triggers timezone conversion` | FR-7, FR-8 |
| S-8 | `apps/app-new/tests/seeded/demo-smoke.spec.ts` | `Seguimiento filter smoke` | FR-1, FR-2, FR-4 |

## Non-functional requirements

**NFR-1 — Timezone explicitness (load-bearing):** Tests asserting date-boundary behavior MUST use an explicit timezone. Either the Vitest process for the API test suite MUST be started with `TZ=America/Argentina/Buenos_Aires` (via vitest config or test script), or the date helper MUST accept a `timezone` string argument and tests MUST pass `'America/Argentina/Buenos_Aires'` directly. Using the host TZ implicitly is a defect. Design phase MUST pick one approach and document it.

**NFR-2 — Index alignment (load-bearing):** The new `agents.some({ agentUserId: X })` clause in both movement and document WHERE builders MUST be composable with the existing Prisma `PropertyEngagement.agents` subquery path. The `@@unique([propertyEngagementId, agentUserId])` constraint and `@@index([tenantId, agentUserId])` on `PropertyAgent` MUST cover the lookup. Design phase MUST verify the query plan does not introduce a full scan on `PropertyAgent`.

## Spec deltas required

None. The proposal scope is correct and complete as reproduced.

## Open questions

None.

## Trace

| FR | Proposal scope item |
|----|---------------------|
| FR-1 | "Backend fix for Bug 1: parse `dateFrom` as start of day in canonical timezone" |
| FR-2 | "Backend fix for Bug 1: parse `dateTo` as end of day (start of next day, exclusive)" |
| FR-3 | "Use a small helper, not ad-hoc logic. Update both movements and documents call sites." |
| FR-4 | "Backend fix for Bug 2: introduce a new repository filter scoping movements to engagements where chosen user is an assigned PropertyAgent." |
| FR-5 | "Backend fix for Bug 2: similarly for the documents path." |
| FR-6 | "The existing `createdByUserId` semantic is removed from the public Responsable filter." |
| FR-7 | "Unit test: date-only `dateFrom`/`dateTo` produce a filter that includes events from start-of-day in canonical timezone." |
| FR-8 | "Tests must use the canonical Argentina timezone explicitly, not the host's local timezone." |
