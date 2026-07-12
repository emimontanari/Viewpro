# Design — Stage 20.11 Seguimiento Daily Workflow Corrections

## Quick path

1. Add `viewpro-app/apps/api/src/common/date/business-tz.ts` with `BUSINESS_TIMEZONE`, `parseBusinessDayStart`, `parseBusinessDayExclusiveEnd`. Native `Intl.DateTimeFormat` only — no new dependency.
2. In `list-activity-feed.use-case.ts:47-48`, replace `new Date(query.dateFrom)` / `new Date(query.dateTo)` with the helper calls.
3. Add `assignedAgentUserId?: string` to both `ListTenantMovementsInput` (`movements.repository.ts`) and `ListActivityDocumentRequestsInput` (`documents.repository.ts`). Keep the old `createdByUserId` / `requestedByUserId` fields available (still used by `get-dashboard-summary.use-case.ts` semantics + DB inserts) but stop wiring `query.sellerId` to them in the analytics use case.
4. In both Prisma WHERE builders, add a composable `propertyEngagement.agents.some({ tenantId, agentUserId })` clause when `assignedAgentUserId` is present, merged with the existing visibility/active engagement clauses on `propertyEngagement`.
5. Tests RED first per S-1..S-8.

## Architecture decisions

### AD-1 — New tiny helper module, native `Intl` only

| Topic | Decision |
|-------|----------|
| Location | `viewpro-app/apps/api/src/common/date/business-tz.ts` |
| Dependency | None new. `date-fns` lives only in `apps/app-new/package.json`; the API package has zero date libraries. Adding `date-fns-tz` to the API would expand the dep tree for one helper. |
| Mechanism | `Intl.DateTimeFormat('en-US', { timeZone, ... }).formatToParts(...)` to resolve the wall-clock offset for a given `YYYY-MM-DD` in `America/Argentina/Buenos_Aires`, then construct the equivalent UTC `Date`. |
| Naming | `BUSINESS_TIMEZONE`, `parseBusinessDayStart(input, timezone?)`, `parseBusinessDayExclusiveEnd(input, timezone?)`. `timezone` defaults to `BUSINESS_TIMEZONE` so tests can override explicitly. |
| Exclusive end | `parseBusinessDayExclusiveEnd('2026-06-15')` returns `parseBusinessDayStart('2026-06-16')`. JSDoc explains why. |

```ts
// business-tz.ts (signatures only — apply phase writes the body)
export const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires'

/**
 * Parse a YYYY-MM-DD string as the UTC instant of 00:00:00 (start of day)
 * in the given timezone. Defaults to BUSINESS_TIMEZONE.
 */
export function parseBusinessDayStart(input: string, timezone?: string): Date

/**
 * Parse a YYYY-MM-DD string as the EXCLUSIVE end-of-day in the given timezone:
 * the UTC instant of 00:00:00 of (input + 1 day). Used with Prisma `lt`, not `lte`.
 * Rationale: exclusive-end avoids millisecond edge cases and produces correct
 * full-day ranges without timestamp-of-final-tick games.
 */
export function parseBusinessDayExclusiveEnd(input: string, timezone?: string): Date
```

### AD-2 — Use case fix (single file)

| Site | Change |
|------|--------|
| `list-activity-feed.use-case.ts:47` | `const from = query.dateFrom ? parseBusinessDayStart(query.dateFrom) : undefined` |
| `list-activity-feed.use-case.ts:48` | `const to = query.dateTo ? parseBusinessDayExclusiveEnd(query.dateTo) : undefined` |
| `list-activity-feed.use-case.ts:68` | Rename param: `createdByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId` |
| `list-activity-feed.use-case.ts:80` | Rename param: `requestedByUserId: query.sellerId` → `assignedAgentUserId: query.sellerId` |

Diff sketch (before/after):

```diff
-    const from = query.dateFrom ? new Date(query.dateFrom) : undefined
-    const to = query.dateTo ? new Date(query.dateTo) : undefined
+    const from = query.dateFrom ? parseBusinessDayStart(query.dateFrom) : undefined
+    const to = query.dateTo ? parseBusinessDayExclusiveEnd(query.dateTo) : undefined
```

```diff
       this.movementsRepository.findManyByTenant({
         tenantId: tenant.tenantId,
         ...
         type: query.type,
-        createdByUserId: query.sellerId,
+        assignedAgentUserId: query.sellerId,
         from,
         to,
       })
```

```diff
       this.documentsRepository.listActivityRequests({
         tenantId: tenant.tenantId,
         ...
-        requestedByUserId: query.sellerId,
+        assignedAgentUserId: query.sellerId,
         from,
         to,
       })
```

### AD-3 — Repository signature changes (additive, backward-compatible)

```ts
// movements.repository.ts — add field, keep createdByUserId
export type ListTenantMovementsInput = {
  tenantId: string
  userId: string
  canViewAll: boolean
  page: number
  pageSize: number
  type?: Movement["type"]
  createdByUserId?: string        // unchanged: still available for non-analytics callers
  assignedAgentUserId?: string    // NEW: scopes to engagements where this user is an assigned PropertyAgent
  from?: Date
  to?: Date
}
```

```ts
// documents.repository.ts — add field, keep requestedByUserId
export type ListActivityDocumentRequestsInput = {
  tenantId: string
  viewerUserId: string
  canViewAll: boolean
  page: number
  pageSize: number
  requestedByUserId?: string        // unchanged: still available for non-analytics callers
  assignedAgentUserId?: string      // NEW
  from?: Date
  to?: Date
  activeEngagementsOnly?: boolean
}
```

Prisma WHERE addition for movements (in `buildTenantActivityMovementWhere`):

```ts
const engagementWhere = this.buildActivityEngagementWhere(input)
const engagementWhereWithAssignedAgent = input.assignedAgentUserId
  ? {
      ...engagementWhere,
      agents: {
        some: {
          tenantId: input.tenantId,
          agentUserId: input.assignedAgentUserId,
        },
      },
    }
  : engagementWhere
```

The merge is safe: when `canViewAll = false`, the visibility clause already attaches an `agents.some({ agentUserId: input.userId })` constraint scoped to the viewer. The new `agents.some({ agentUserId: input.assignedAgentUserId })` is a SEPARATE `agents.some(...)` — Prisma resolves them as independent `EXISTS` subqueries on `PropertyAgent`. Both can hold simultaneously. We OVERRIDE `agents` in the merged object only when no viewer-scoping clause is present (`canViewAll = true`); otherwise we must combine via `AND`:

```ts
// When canViewAll = false AND assignedAgentUserId is set, use Prisma AND:
const engagementWhereWithAssignedAgent: Prisma.PropertyEngagementWhereInput = input.assignedAgentUserId
  ? {
      ...engagementWhere,
      AND: [
        ...(Array.isArray(engagementWhere.AND) ? engagementWhere.AND : engagementWhere.AND ? [engagementWhere.AND] : []),
        { agents: { some: { tenantId: input.tenantId, agentUserId: input.assignedAgentUserId } } },
      ],
    }
  : engagementWhere
```

This preserves both the viewer-scoping `agents.some(...)` on the engagement and the responsable-scoping `agents.some(...)` as a second EXISTS subquery, independent rows on `PropertyAgent`. Apply phase implements this exact shape.

Documents WHERE addition (in `buildActivityRequestWhere`): same pattern. The current code conditionally sets `propertyEngagement` on `canViewAll = false` or `activeEngagementsOnly = true`. The new clause is merged into the same `propertyEngagement` block using `AND` when assignedAgentUserId is set.

The Prisma `lt`/`lte` change for `dateTo` (FR-2): change `createdAt.lte = input.to` to `createdAt.lt = input.to` in BOTH `buildTenantActivityMovementWhere` and `buildActivityRequestWhere`. JSDoc above the helper documents the rationale.

### AD-4 — Test environment isolation

| Topic | Decision |
|-------|----------|
| Mechanism | The helper takes an explicit `timezone` arg (defaults to `BUSINESS_TIMEZONE`). Tests pass `'America/Argentina/Buenos_Aires'` explicitly when asserting boundary values. No `TZ=...` injection. |
| Vitest config | Unchanged. No `env: { TZ: ... }` block needed. |
| Justification | Process-wide `TZ` injection couples every test in the suite to the canonical timezone. Other tests reading `new Date()` would silently shift. Explicit-arg helper is testable in isolation, immune to host TZ. |

## R1 — `agentUserId` field name correction

The schema field is `agentUserId` (confirmed at `schema.prisma:454` and `:463`). The same name is used in the existing viewer-scoping clause `agents.some({ tenantId, agentUserId: input.userId })` in both `buildActivityEngagementWhere` (movements) and `buildAssignedDocumentEngagementWhere` (documents). Reuse the same path:

```ts
agents: {
  some: {
    tenantId: input.tenantId,
    agentUserId: input.assignedAgentUserId,
  },
}
```

The `@@unique([propertyEngagementId, agentUserId])` constraint and `@@index([tenantId, agentUserId])` cover the subquery. No new migration.

## R2 — Exclusive-end `lt`

The helper produces start-of-(input+1)-day in UTC; the Prisma WHERE uses `lt`, not `lte`. JSDoc on `parseBusinessDayExclusiveEnd` and a comment in the use case at line 48 explicitly say: "exclusive end — paired with Prisma `lt`. Do NOT change to `lte`: it would re-introduce the millisecond-boundary edge case."

The repository change is one line: `createdAt.lte = input.to` → `createdAt.lt = input.to` (one site in movements, one in documents).

## R3 — Native `Intl` chosen (no new dependency)

`date-fns` is a UI app dependency only (`apps/app-new/package.json:66`). `apps/api/package.json` has zero date libraries. Choosing native `Intl.DateTimeFormat`:

- Zero added dependency.
- Argentina has no DST (UTC-3 year-round) but the algorithm works for any zone, including DST zones, so the helper generalizes when a future slice adds per-tenant tz.
- Testable in isolation.

Algorithm pseudocode (apply phase implements):

```txt
function parseBusinessDayStart(input, timezone = BUSINESS_TIMEZONE):
  # 1. validate input matches /^\d{4}-\d{2}-\d{2}$/
  # 2. construct a naive UTC midnight: utcGuess = new Date(input + 'T00:00:00Z')
  # 3. find the offset of that instant in `timezone` using Intl.DateTimeFormat:
  #      parts = new Intl.DateTimeFormat('en-US', {
  #        timeZone: timezone,
  #        year, month, day, hour, minute, second, hour12: false
  #      }).formatToParts(utcGuess)
  #    -> parts shows the WALL-CLOCK time at utcGuess in `timezone`
  # 4. Compute the millisecond delta between wall-clock and UTC midnight; that's the offset.
  # 5. return new Date(utcGuess.getTime() + offsetMs)
  #    (i.e., the UTC instant whose wall-clock in `timezone` is exactly input + ' 00:00:00')

function parseBusinessDayExclusiveEnd(input, timezone = BUSINESS_TIMEZONE):
  next = input.replace(...) # add 1 day to the YYYY-MM-DD string
  return parseBusinessDayStart(next, timezone)
```

Note: for fixed-offset zones (Argentina), this resolves to `T03:00:00Z`. For DST zones the algorithm correctly resolves the local offset for that calendar day.

## R4 — `@IsISO8601()` accepts date-only strings

`class-validator` v0.15.1 (this repo) uses `validator.isISO8601()` under the hood. `validator`'s `isISO8601` DOES accept `YYYY-MM-DD` without a time component by default (ISO 8601 calendar date form). No DTO change required for FR-7. The spec already records this.

Apply phase MUST add a focused DTO unit test that asserts the existing `dateFrom`/`dateTo` validators accept `'2026-06-15'`. If the assertion fails (validator behavior changed), the apply phase falls back to `@IsISO8601({ strict: false })` and the test stays.

```ts
it('accepts date-only YYYY-MM-DD for dateFrom and dateTo', async () => {
  const query = Object.assign(new ListActivityFeedQuery(), {
    dateFrom: '2026-06-15',
    dateTo: '2026-06-15',
  })
  const errors = await validate(query)
  expect(errors.map((e) => e.property)).not.toContain('dateFrom')
  expect(errors.map((e) => e.property)).not.toContain('dateTo')
})
```

## Backward-compat audit

`rg`'d the callers of `findManyByTenant` and `listActivityRequests`:

| Caller | Uses `createdByUserId` / `requestedByUserId`? | Affected? |
|--------|------------------------------------------------|-----------|
| `list-activity-feed.use-case.ts:68, 80` | YES (the bug) | YES — fixed by this slice |
| `get-dashboard-summary.use-case.ts:79-99` | NO — passes only `from`/`to` and visibility flags | NOT affected |
| `analytics.use-cases.spec.ts:202-212, 298-307, 346-356, 431-440, 621-629` | YES — asserts `createdByUserId: undefined` or `'seller-1'` | MUST update assertions to `assignedAgentUserId: ...` |
| `movements.repository.spec.ts:262-302` | YES — passes `createdByUserId: 'seller-1'` and asserts it in the Prisma WHERE | MUST add an `assignedAgentUserId` scenario; existing `createdByUserId` test stays as a non-public-filter coverage |
| `documents.repository.spec.ts:81-131` | YES — passes `requestedByUserId: 'agent-2'`, asserts in WHERE | Same: keep + add `assignedAgentUserId` scenario |

Callers audit summary: **zero production breakage outside the analytics use case**. Dashboard summary does NOT pass `createdByUserId` or `requestedByUserId`. The repository contracts stay backward-compatible because the new field is additive and optional.

External API consumers: the public `GET /activity/feed` query param `sellerId` has NOT changed shape. The semantic change is **server-side only**; the proposal already flags this as an acceptable internal-consumer break.

## Test plan

| File | Test name (describe / it) | FR(s) | Scenario |
|------|---------------------------|-------|----------|
| `apps/api/src/common/date/business-tz.spec.ts` (NEW) | `parseBusinessDayStart returns 03:00Z for Buenos Aires` | FR-1, FR-3 | unit |
| `apps/api/src/common/date/business-tz.spec.ts` | `parseBusinessDayExclusiveEnd returns next-day 03:00Z` | FR-2, FR-3 | unit |
| `apps/api/src/common/date/business-tz.spec.ts` | `helper accepts explicit timezone arg distinct from host TZ` | NFR-1, FR-8 | unit |
| `apps/api/test/analytics.use-cases.spec.ts` | `date filter lower bound: date-only dateFrom maps to 03:00Z` | FR-1, FR-3 | S-1 |
| `apps/api/test/analytics.use-cases.spec.ts` | `date filter exclusive upper bound: date-only dateTo maps to next-day 03:00Z` | FR-2, FR-3 | S-2 |
| `apps/api/test/analytics.use-cases.spec.ts` | `same-day range is non-empty: dateFrom = dateTo` | FR-1, FR-2, FR-3 | S-3 |
| `apps/api/test/analytics.use-cases.spec.ts` | `Responsable filter wires sellerId to assignedAgentUserId on movements repo` | FR-4, FR-6 | S-4 |
| `apps/api/test/analytics.use-cases.spec.ts` | `Responsable filter wires sellerId to assignedAgentUserId on documents repo` | FR-5, FR-6 | S-5 |
| `apps/api/test/analytics.use-cases.spec.ts` | `date-only input recorded in spy uses helper conversion` | FR-7, FR-8 | S-7 |
| `apps/api/test/analytics.use-cases.spec.ts` | UPDATE existing `findManyByTenant` assertions: `createdByUserId` → `assignedAgentUserId` | FR-4, FR-6 | (test refactor) |
| `apps/api/test/analytics.use-cases.spec.ts` | UPDATE existing `listActivityRequests` assertions: `requestedByUserId` → `assignedAgentUserId` | FR-5, FR-6 | (test refactor) |
| `apps/api/test/movements.repository.spec.ts` | `findManyByTenant uses agents.some({ agentUserId }) when assignedAgentUserId is set, lt for dateTo` | FR-2, FR-4 | unit on Prisma WHERE shape |
| `apps/api/test/documents.repository.spec.ts` | `listActivityRequests uses agents.some({ agentUserId }) when assignedAgentUserId is set, lt for dateTo` | FR-2, FR-5 | unit on Prisma WHERE shape |
| `apps/api/test/analytics.e2e-spec.ts` | `feed returns manager-created movement on Seller A's assigned property when filtering by sellerId=A` | FR-4, FR-6 | S-4 e2e |
| `apps/api/test/analytics.e2e-spec.ts` | `feed returns manager-requested document on Seller A's assigned property when filtering by sellerId=A` | FR-5, FR-6 | S-5 e2e |
| `apps/api/test/analytics.e2e-spec.ts` | `feed excludes other-seller items when filtering by sellerId=A` | FR-4, FR-5 | S-6 |
| `apps/api/src/analytics/dto/list-activity-feed.query.spec.ts` (NEW small spec OR colocated in `analytics.use-cases.spec.ts`) | `@IsISO8601 accepts date-only YYYY-MM-DD` | FR-7 | R4 verification |
| `apps/app-new/tests/seeded/demo-smoke.spec.ts` | `Seguimiento filter smoke: dateFrom + dateTo + Responsable=Martín returns only Martin's properties` | FR-1, FR-2, FR-4 | S-8 |

### RED test sketches

S-1 (use case unit):

```ts
it('parses date-only dateFrom as start-of-day in BUSINESS_TIMEZONE', async () => {
  // ... build use case with spies ...
  await useCase.execute(managerTenant, currentUser, { dateFrom: '2026-06-15' })
  expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
    expect.objectContaining({ from: new Date('2026-06-15T03:00:00.000Z'), to: undefined }),
  )
})
```

S-2 (use case unit):

```ts
it('parses date-only dateTo as exclusive next-day 03:00Z', async () => {
  await useCase.execute(managerTenant, currentUser, { dateTo: '2026-06-15' })
  expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
    expect.objectContaining({ to: new Date('2026-06-16T03:00:00.000Z') }),
  )
})
```

S-4 (use case unit, Responsable semantic):

```ts
it('wires sellerId to assignedAgentUserId on movements repo', async () => {
  await useCase.execute(managerTenant, currentUser, { sellerId: 'seller-a' })
  expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
    expect.objectContaining({ assignedAgentUserId: 'seller-a' }),
  )
  expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
    expect.not.objectContaining({ createdByUserId: 'seller-a' }),
  )
})
```

Movements repo unit (Prisma WHERE shape):

```ts
it('uses agents.some({ agentUserId }) and lt for assignedAgentUserId + dateTo', async () => {
  // ... new PrismaMovementsRepository with mocked findMany/count ...
  await repository.findManyByTenant({
    tenantId: 'tenant-1', userId: 'manager-1', canViewAll: true,
    page: 1, pageSize: 10,
    assignedAgentUserId: 'seller-a',
    from: new Date('2026-06-15T03:00:00.000Z'),
    to: new Date('2026-06-16T03:00:00.000Z'),
  })
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({
      createdAt: { gte: new Date('2026-06-15T03:00:00.000Z'), lt: new Date('2026-06-16T03:00:00.000Z') },
      propertyEngagement: expect.objectContaining({
        AND: expect.arrayContaining([
          { agents: { some: { tenantId: 'tenant-1', agentUserId: 'seller-a' } } },
        ]),
      }),
    }),
  }))
})
```

## Seeded smoke design (S-8)

The current seed (`scripts/seed-demo.mjs`) has martin assigned to Boulevares (engagement index 6) AND there is a movement on Boulevares — but that movement is `createdByUserId: martin.id` (line 1843), NOT manager-created. To make the Responsable-filter smoke meaningful for Bug 2 evidence, the apply phase MUST either:

- (preferred) Add ONE manager-created movement on Boulevares in `seed-demo.mjs`'s `createStatusChangeRequestFixtures` block, dated within the seeded clock window. Title/observation: `"Manager note on Boulevares"`, type `GENERAL_UPDATE`, `createdByUserId: manager.id`. This proves Bug 2 deterministically: under the old code, filtering by `Responsable = Martín` would HIDE this movement; under the fix, it appears.
- OR rely on the existing martin-authored movement on Boulevares plus an existing martin-authored movement on Casa Funes; the smoke asserts only "only martin's assigned properties appear, no cross-seller leak", which is S-6, not the manager-creator case.

Design decision: **add ONE manager-created movement on Boulevares** in the seed. This single addition serves S-4, S-5 (mirror for documents: a manager-requested document already exists per line 1810, which has `requestedByUserId: martin.id` — apply phase will FLIP that one fixture to `requestedByUserId: manager.id`, since "requested by martin's manager on martin's assigned property" is exactly the Bug 2 reproduction). The 22/22 baseline must still pass; the seed change is additive (extra movement + flip of ONE requestedBy field).

Smoke assertion shape (in `demo-smoke.spec.ts`):

```ts
test('Seguimiento filter smoke: Responsable + date range', async ({ page }) => {
  await signIn(page, DEMO_EMAIL) // manager
  await page.goto('/dashboard/seguimiento') // confirm exact route in apply
  // Apply seed-clock-day for both date pickers (use a stable date derived from the seed clock)
  // Select Responsable = Martín from the dropdown
  // Assert: visible feed contains the new manager-authored movement on Boulevares
  // Assert: visible feed does NOT contain any item whose property is assigned only to Sofía or Lucía
})
```

Fixture stability: the seed already uses deterministic ids (Stage 26.2 contract). The new manager movement uses the same `daysAgo()` helper, so the smoke's date picker derives from the same seed clock anchor.

## Non-goals (inherited + clarified)

- Per-tenant timezone setting.
- DTO-level extra validators or `@IsISO8601({ strict: true })` toggles (the existing config is sufficient per R4).
- `kind` / `type` filter changes.
- Removing `createdByUserId` from `ListTenantMovementsInput`: keep it; the field is no longer wired from `sellerId`, but the type stays for other potential callers and tests.
- Tenant-level `agents` index changes or migrations.

## Rollout & rollback

| Topic | Decision |
|-------|----------|
| Rollout | Single PR. Net diff ≈ helper (≤80 lines) + use case (4 lines) + 2 repository types (4 lines) + 2 Prisma WHERE builders (≤30 lines each) + tests (≤250 lines) + seed (≤20 lines) + Playwright (≤60 lines). Comfortably under the 400-line review budget. |
| Feature flag | None. The semantic change is a bug fix. |
| Rollback | Revert PR. Helper is isolated; use case + repos return to previous param names; tests + seed revert. No DB migration to undo. |

## Risks

- **R-D1**: Combining the viewer-scoping `agents.some(...)` and Responsable-scoping `agents.some(...)` on the same `PropertyEngagement.agents` relation. Mitigation: use `AND: [...]` so Prisma generates two independent `EXISTS` subqueries on `PropertyAgent`. Verify in `pnpm --filter @viewpro/api test` that the `e2e` returns the right row count.
- **R-D2**: Vitest does not parallelize files (`fileParallelism: false`), so no concurrency risk for date assertions; but any test that does `new Date()` without an injected clock could drift. Mitigation: helper is explicit-arg, no host-TZ dependency.
- **R-D3**: The seed change for S-8 (one manager-authored movement on Boulevares + flipping one document request to manager-authored). It WILL change the visible count in the existing 22/22 smoke if any test asserts a specific movement total on Boulevares. Mitigation: apply phase greps the smoke + counter assertions in `analytics.e2e-spec.ts` BEFORE editing the seed, and adjusts expected totals atomically in the same PR. R-D3 is the highest-risk item for review.
- **R-D4**: `class-validator`'s `isISO8601` is supplied by `validator` v13.x. The library's behavior on bare `YYYY-MM-DD` is stable per its tests, but if a future bump rejects it, the DTO test in this slice catches it immediately. Acceptable risk.
- **R-D5**: `getDashboardSummaryUseCase` uses `findManyByTenant` with `from`/`to` derived from the dashboard window (`window.from`, `window.to`). Those are already full `Date` instants computed in UTC and are NOT user-facing date-only strings — they do NOT go through the helper. Confirm no regression in dashboard tests after the repository change.

## Spec deltas required

None. The spec accurately captures FR-1..FR-8 and S-1..S-8 and explicitly records the `agentUserId` correction and the `lt` exclusive-end decision.

## Next step

Proceed to `sdd-tasks` to break this design into RED→GREEN checkboxes.
