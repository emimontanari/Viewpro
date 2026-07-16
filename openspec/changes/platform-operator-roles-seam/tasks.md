# Tasks: Platform D4 — Internal Operator Roles Authorization Seam

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions D1–D9 (design.md) are LOCKED — do not reopen.

---

## Canonical Capability Name Reconciliation

The proposal's Capabilities section (§2) named the new capability
`platform-operator-authorization`. The spec phase was directed to (and did)
use `operator-platform-roles` instead — matching the sibling
`operator-step-up-auth` naming convention (`operator-<topic>`, not
`<topic>-operator-*`). **`operator-platform-roles` is the canonical name**
for this change from this point forward:

- The spec lives at `specs/operator-platform-roles/spec.md` (already correct).
- Every task below cites `operator-platform-roles` as the spec capability.
- `sdd-archive` MUST reconcile the proposal's stated capability name to
  `operator-platform-roles` when archiving (either by treating the proposal's
  §2 text as informally superseded by the spec, or by patching the proposal
  before archive) — flagged here so archive is unambiguous and does not
  create two capability directories.

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380–450 (1 app: 5 files created in new `permissions/` module + 2 new test files there; 4 controllers + 2 modules modified with guard/decorator wiring; migration + schema + seed + 2 guardrail/seed test files; 4 integration-test files extended with role-fixture scenarios) |
| 400-line budget risk | Borderline (proposal §8 asserts "well under"; treat as Medium on line count alone) |
| **Hot-path override** | **YES** — this diff touches an authorization boundary (new guard gating 5 routes) and a schema migration on the `Operator` table. Per the orchestrator's risk table, auth/authz + migration is a **Hot Path** regardless of line count → run the **full 4R lens sweep** (`review-risk`, `review-resilience`, `review-readability`, `review-reliability`) at `review/start(target)`, not a single dominant-risk lens. Flag explicitly for heightened (Judgment-Day-caliber) scrutiny given the security sensitivity (new deny-by-default authorization gate + `status !== 'ACTIVE'` lockout hardening). |
| Chained PRs recommended | No |
| Suggested split | None — one backend work unit / one PR (proposal §8) |
| Delivery strategy | single-pr |
| Chain strategy | n/a |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Medium (line count) / **High (hot-path override — always run full 4R)**

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | `viewpro-api`: `Operator.role` migration + seed, `permissions/` module (constants, map, decorator, guard, module), guard+annotation wiring on all 4 operator controllers, guardrail/seed test updates, unit + integration test coverage for every spec scenario | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/platform-api test` | `supertest` against `viewpro_platform_test` (`postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test`, already up); role fixtures seeded directly via `prisma.operator.update({ where: { email }, data: { role } })` | Revert the migration (`DROP COLUMN "role"` + `DROP TYPE "PlatformOperatorRole"`); remove `permissions/` module + the 4 controllers' `PlatformPermissionGuard`/`@RequirePlatformPermission` wiring + the 2 modules' `PermissionsModule` import; restore `seed.ts` and both guardrail tests. OWNER-only data today means removing the seam is bit-identical to pre-change behavior (proposal §8) |

---

## Dependency Graph

```
T-01 (RED: operator-schema.spec.ts + seed.spec.ts — role column + OWNER backfill/seed)
  └── T-02 (GREEN: schema.prisma enum+column, prisma migrate dev --name add_operator_role, seed.ts role:'OWNER')
        └── T-03 (RED: role-permissions.spec.ts — exact per-role map, hierarchy, OWNER-only OPERATORS_MANAGE)
              └── T-04 (GREEN: platform-permissions.constants.ts + role-permissions.ts)
                    └── T-05 (RED: platform-permission.guard.spec.ts — undeclared/fail-closed, missing user, missing/SUSPENDED operator, role×permission matrix)
                          └── T-06 (GREEN: require-platform-permission.decorator.ts + platform-permission.guard.ts + permissions.module.ts)
                                └── T-07 (RED: platform-control.controller.spec.ts — WRITE routes: ANALYST 403/no-mutation, OPERATIONS 200, guard order, role-change mid-session, SUSPENDED lockout)
                                      └── T-08 (GREEN: wire AuthGuard+PlatformPermissionGuard+@RequirePlatformPermission on platform-control.controller.ts + PermissionsModule import in platform-control.module.ts)
                                            └── T-09 (RED: metrics/tenant-registry/audit controller specs — READ routes: ANALYST/OPERATIONS/OWNER all 200)
                                                  └── T-10 (GREEN: wire guard+annotations on the 3 read controllers + PermissionsModule import in platform-data.module.ts)
                                                        └── T-11 (Final verification — full suite, typecheck, zero-diff invariants, review-workload flag)
```

---

## WU-1 — viewpro-api: migration + permissions seam + guard wiring + tests

### [ ] T-01 — RED: `operator-schema.spec.ts` + `seed.spec.ts` — role column + OWNER backfill/seed
**Type**: test (RED)
**Spec**: operator-platform-roles — Every Operator Has a Platform Role; Existing Operators Default to OWNER; Migration Backfills Existing Operators and Seed Sets OWNER Explicitly
**WU**: WU-1, commit 1
**Depends on**: nothing

- `apps/viewpro-api/src/database/__tests__/operator-schema.spec.ts`:
  - Add `role` to the `expected` fields array
  - **Drop** `expect(fields).not.toContain('role')` (constraint intentionally lifted — R1)
  - Keep `refreshToken`/`invitedBy` guardrails unchanged
  - Add: `Prisma.dmmf.datamodel.models.find(m => m.name === 'Operator')?.fields.find(f => f.name === 'role')?.default` equals `'OWNER'` (locks the backfill-by-default contract, D9/R3)
- `apps/viewpro-api/src/database/__tests__/seed.spec.ts` — add: after seeding, `prisma.operator.findFirst()` resolves `role === 'OWNER'` (proxy for "seeded operator reads back OWNER post-migration" — the seed always runs post-migration in this test DB, so this is the closest CI-observable signal for the migration-backfill scenario; note in T-11 that true pre-existing-row backfill is additionally verified manually/by migration-history inspection, since the test DB has no pre-slice data to backfill)

All RED until T-02 (client not yet regenerated with `role`; column doesn't exist).
**Exit**: both spec files compile; new assertions fail.
**Commit**: `test(platform-api): RED — Operator.role column + OWNER default/seed (D2/D9)`

---

### [ ] T-02 — GREEN: `schema.prisma` enum+column, migration, `seed.ts` explicit OWNER
**Type**: impl
**Spec**: operator-platform-roles — Every Operator Has a Platform Role; Migration Backfills Existing Operators and Seed Sets OWNER Explicitly
**WU**: WU-1, commit 2
**Depends on**: T-01

- `apps/viewpro-api/prisma/schema.prisma`: add `enum PlatformOperatorRole { OWNER OPERATIONS ANALYST }`; add `role PlatformOperatorRole @default(OWNER)` to `model Operator` (only schema change, D2)
- Generate the migration against the already-running test DB (mirrors the T-03/T-04 precedent in `platform-phase4-operator-identity/tasks.md`):
  `DATABASE_URL=postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test pnpm --filter @viewpro/platform-api exec prisma migrate dev --name add_operator_role`
  — produces `apps/viewpro-api/prisma/migrations/{ts}_add_operator_role/migration.sql`:
  ```sql
  CREATE TYPE "PlatformOperatorRole" AS ENUM ('OWNER', 'OPERATIONS', 'ANALYST');
  ALTER TABLE "Operator" ADD COLUMN "role" "PlatformOperatorRole" NOT NULL DEFAULT 'OWNER';
  ```
  Commit the generated `migration.sql` verbatim — **never hand-edit an already-applied migration** (known checksum-drift gotcha from prior slices; if drift is ever detected, fix only the `_prisma_migrations` checksum row, never reset the DB)
- `apps/viewpro-api/prisma/seed.ts` — add `role: 'OWNER'` to the `create` payload (the `update: {}` branch stays untouched, D9)
- Confirm T-01 GREEN; confirm the full existing suite is unaffected (regression)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-01 GREEN; all prior tests GREEN.
**Commit**: `feat(platform-api): PlatformOperatorRole enum + Operator.role @default(OWNER) migration + explicit seed (D2/D9)`

---

### [ ] T-03 — RED: `role-permissions.spec.ts` — exact per-role map, hierarchy, OWNER-only `OPERATORS_MANAGE`
**Type**: test (RED)
**Spec**: operator-platform-roles — Role Hierarchy — OPERATIONS Excludes PLATFORM_OPERATORS_MANAGE
**WU**: WU-1, commit 3
**Depends on**: T-02

- Create `apps/viewpro-api/src/permissions/__tests__/role-permissions.spec.ts`:
  - `getPermissionsForRole('ANALYST')` returns exactly `[PLATFORM_METRICS_READ, PLATFORM_TENANTS_READ, PLATFORM_AUDIT_READ]` (order-insensitive) and does NOT include either WRITE or `PLATFORM_OPERATORS_MANAGE`
  - `getPermissionsForRole('OPERATIONS')` returns the 3 READs + `PLATFORM_TENANT_STATUS_WRITE` + `PLATFORM_TENANT_LIMITS_WRITE`, and does NOT include `PLATFORM_OPERATORS_MANAGE`
  - `getPermissionsForRole('OWNER')` returns everything OPERATIONS has, plus `PLATFORM_OPERATORS_MANAGE` — assert as a strict superset of OPERATIONS' set (`OWNER.length === OPERATIONS.length + 1`)
  - `ROLE_PERMISSIONS.OWNER` includes `PLATFORM_OPERATORS_MANAGE` even though no route requires it (AC5 — asserted here since no route exercises it)

All RED until T-04.
**Exit**: new spec file compiles; assertions fail (`role-permissions.ts` doesn't exist).
**Commit**: `test(platform-api): RED — ROLE_PERMISSIONS map (ANALYST/OPERATIONS/OWNER hierarchy) (D3)`

---

### [ ] T-04 — GREEN: `platform-permissions.constants.ts` + `role-permissions.ts`
**Type**: impl
**Spec**: operator-platform-roles — Role Hierarchy — OPERATIONS Excludes PLATFORM_OPERATORS_MANAGE; OWNER role holds all defined platform permissions
**WU**: WU-1, commit 4
**Depends on**: T-03

- Create `apps/viewpro-api/src/permissions/platform-permissions.constants.ts`:
  ```ts
  export const PLATFORM_PERMISSIONS = {
    METRICS_READ: 'PLATFORM_METRICS_READ',
    TENANTS_READ: 'PLATFORM_TENANTS_READ',
    AUDIT_READ: 'PLATFORM_AUDIT_READ',
    TENANT_STATUS_WRITE: 'PLATFORM_TENANT_STATUS_WRITE',
    TENANT_LIMITS_WRITE: 'PLATFORM_TENANT_LIMITS_WRITE',
    OPERATORS_MANAGE: 'PLATFORM_OPERATORS_MANAGE',
  } as const
  export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS]
  export const PERMISSION_DENIED_CODE = 'PERMISSION_DENIED'
  ```
- Create `apps/viewpro-api/src/permissions/role-permissions.ts`:
  ```ts
  import type { PlatformOperatorRole } from '@prisma-platform/client'
  import { PLATFORM_PERMISSIONS, type PlatformPermission } from './platform-permissions.constants'

  const ANALYST_PERMISSIONS: readonly PlatformPermission[] = [
    PLATFORM_PERMISSIONS.METRICS_READ,
    PLATFORM_PERMISSIONS.TENANTS_READ,
    PLATFORM_PERMISSIONS.AUDIT_READ,
  ]
  const OPERATIONS_PERMISSIONS: readonly PlatformPermission[] = [
    ...ANALYST_PERMISSIONS,
    PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE,
    PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE,
  ]
  const OWNER_PERMISSIONS: readonly PlatformPermission[] = [
    ...OPERATIONS_PERMISSIONS,
    PLATFORM_PERMISSIONS.OPERATORS_MANAGE,
  ]

  export const ROLE_PERMISSIONS: Record<PlatformOperatorRole, readonly PlatformPermission[]> = {
    ANALYST: ANALYST_PERMISSIONS,
    OPERATIONS: OPERATIONS_PERMISSIONS,
    OWNER: OWNER_PERMISSIONS,
  }

  export function getPermissionsForRole(role: PlatformOperatorRole): readonly PlatformPermission[] {
    return ROLE_PERMISSIONS[role] ?? []
  }
  ```
- Confirm T-03 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-03 GREEN.
**Commit**: `feat(platform-api): PLATFORM_PERMISSIONS + compositional ROLE_PERMISSIONS map (D3)`

---

### [ ] T-05 — RED: `platform-permission.guard.spec.ts` — fail-closed, missing user, missing/SUSPENDED operator, role×permission matrix
**Type**: test (RED)
**Spec**: operator-platform-roles — Protected Routes Fail Closed When No Permission Is Declared; Read/Write Routes Require the Declared Permission; Guard Order Keeps 401/403 Distinct (unit-level 401 branch)
**WU**: WU-1, commit 5
**Depends on**: T-04

- Create `apps/viewpro-api/src/permissions/__tests__/platform-permission.guard.spec.ts` (mocked `ExecutionContext`, mocked `Reflector`, mocked `IOperatorRepository`):
  - `reflector.getAllAndOverride` returns `undefined` (no `@RequirePlatformPermission` metadata) → `ForbiddenException` with body `{ statusCode: 403, code: 'PERMISSION_DENIED', message: 'Insufficient permissions' }` — **fail-closed** (D5, spec scenario "A route without a declared permission denies access")
  - Metadata present but `request.user` absent → `UnauthorizedException` (defensive; unreachable behind `AuthGuard` in practice, D6 branch 1)
  - Metadata present, `request.user` set, `operatorRepository.findById` resolves `null` → 403 `PERMISSION_DENIED`
  - Operator found but `status !== 'ACTIVE'` (e.g. `SUSPENDED`) → 403 `PERMISSION_DENIED` even though the role would otherwise grant the permission (status-hardening, D6 — intentional immediate-lockout addition)
  - Operator `ACTIVE`, role's permission set (via `getPermissionsForRole`) does NOT include the required permission → 403 `PERMISSION_DENIED`
  - Operator `ACTIVE`, role's permission set DOES include the required permission → `canActivate` resolves `true`

All RED until T-06.
**Exit**: new spec file compiles; assertions fail (`PlatformPermissionGuard` doesn't exist).
**Commit**: `test(platform-api): RED — PlatformPermissionGuard (fail-closed, SUSPENDED lockout, role×permission) (D5/D6)`

---

### [ ] T-06 — GREEN: `require-platform-permission.decorator.ts` + `platform-permission.guard.ts` + `permissions.module.ts`
**Type**: impl
**Spec**: operator-platform-roles — Protected Routes Fail Closed When No Permission Is Declared; Read/Write Routes Require the Declared Permission
**WU**: WU-1, commit 6
**Depends on**: T-05

- Create `apps/viewpro-api/src/permissions/require-platform-permission.decorator.ts`:
  ```ts
  export const REQUIRED_PLATFORM_PERMISSION_KEY = 'requiredPlatformPermission'
  export const RequirePlatformPermission = (permission: PlatformPermission) =>
    SetMetadata(REQUIRED_PLATFORM_PERMISSION_KEY, permission)
  ```
- Create `apps/viewpro-api/src/permissions/platform-permission.guard.ts`:
  ```ts
  @Injectable()
  export class PlatformPermissionGuard implements CanActivate {
    constructor(
      @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
      private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const required = this.reflector.getAllAndOverride<PlatformPermission | undefined>(
        REQUIRED_PLATFORM_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      )
      if (!required) throw new ForbiddenException(PERMISSION_DENIED_RESPONSE) // D5 fail-closed

      const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
      if (!request.user) throw new UnauthorizedException(AUTH_REQUIRED_RESPONSE)

      const operator = await this.operatorRepository.findById(request.user.id)
      if (!operator || operator.status !== 'ACTIVE') throw new ForbiddenException(PERMISSION_DENIED_RESPONSE)

      if (!getPermissionsForRole(operator.role).includes(required)) {
        throw new ForbiddenException(PERMISSION_DENIED_RESPONSE)
      }
      return true
    }
  }
  ```
  where `PERMISSION_DENIED_RESPONSE = { statusCode: 403, code: PERMISSION_DENIED_CODE, message: 'Insufficient permissions' }` (single generic body for every deny reason — D6, avoids account-state enumeration)
- Create `apps/viewpro-api/src/permissions/permissions.module.ts`:
  ```ts
  @Module({
    providers: [
      PlatformPermissionGuard,
      { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
    ],
    exports: [PlatformPermissionGuard],
  })
  export class PermissionsModule {}
  ```
  — self-contained: binds its own `OPERATOR_REPOSITORY` (reusing the existing `PrismaOperatorRepository` class from `auth/repositories/`), no new `AuthModule` export surface (D8)
- Confirm T-05 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-05 GREEN.
**Commit**: `feat(platform-api): @RequirePlatformPermission decorator + PlatformPermissionGuard + PermissionsModule (D5/D6/D8)`

---

### [ ] T-07 — RED: `platform-control.controller.spec.ts` — WRITE routes: role×permission, guard order, role-change mid-session, SUSPENDED lockout
**Type**: test (RED)
**Spec**: operator-platform-roles — Write Routes Require the Declared WRITE Permission; ANALYST Is Denied and Nothing Mutates; Guard Order Keeps 401, Permission-403, and Step-up-403 Distinct; A Role Change Takes Effect on the Operator's Very Next Request
**WU**: WU-1, commit 7
**Depends on**: T-06

- Extend `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts`. Import `PermissionsModule` into the test's `Test.createTestingModule({ imports: [...] })`. Seed an ANALYST and an OPERATIONS operator fixture directly via `prisma.operator.update({ where: { email }, data: { role: 'ANALYST' | 'OPERATIONS' } })` after the existing `pnpm db:seed` calls (production seed stays OWNER-only):
  - ANALYST, no step-up cookie needed: `PATCH .../status {status:SUSPENDED}` → 403, `res.body.code === 'PERMISSION_DENIED'` (not `STEP_UP_REQUIRED`); `mockClient.postTenantStatus` NOT called (b — WRITE half)
  - ANALYST: `PATCH .../limits` → 403 `PERMISSION_DENIED`; `mockClient.postTenantLimits` NOT called
  - OPERATIONS, WITH a fresh step-up cookie: `PATCH .../status {status:SUSPENDED}` → 200, `mockClient.postTenantStatus` called once (c)
  - OPERATIONS, WITH a fresh step-up cookie: `PATCH .../limits` → 200, `mockClient.postTenantLimits` called once
  - OPERATIONS, WITHOUT a step-up cookie: `PATCH .../limits` → 403 `STEP_UP_REQUIRED` (permission passed, step-up still gates — proves the guard doesn't weaken step-up)
  - Guard order: ANALYST, no step-up cookie: `PATCH .../status {status:SUSPENDED}` → 403 with `code !== 'STEP_UP_REQUIRED'` — proves `PlatformPermissionGuard` stops the request BEFORE `StepUpGuard` ever evaluates the cookie (e)
  - Guard order: OWNER (default role), no step-up cookie: `PATCH .../status {status:SUSPENDED}` → still 403 `STEP_UP_REQUIRED` — permission passes (OWNER has the permission) but step-up still gates (e)
  - Role change mid-session: OPERATIONS operator logs in → `PATCH .../limits` WITH step-up → 200; then `prisma.operator.update({ where: { id }, data: { role: 'ANALYST' } })` on the SAME operator row; the SAME still-valid access+step-up cookies → `PATCH .../status {status:SUSPENDED}` → 403 `PERMISSION_DENIED`, with NO re-login and NO new `/auth/login` or `/auth/step-up` call in between (f, D1 — proves per-request DB lookup, no staleness)
  - SUSPENDED lockout: an OWNER operator (has the permission) logs in, THEN `prisma.operator.update({ where: { id }, data: { status: 'SUSPENDED' } })` on that same operator; the SAME still-valid access cookie → `PATCH .../limits` → 403 `PERMISSION_DENIED` (g — status hardening, D6)

All RED until T-08.
**Exit**: existing suite compiles; new assertions fail (no permission guard on the routes yet, so ANALYST currently gets past to `StepUpGuard`/handler).
**Commit**: `test(platform-api): RED — write routes gated by PlatformPermissionGuard (role×perm, guard order, role-change, SUSPENDED) (AC3/AC4/AC6, D1/D6/D7)`

---

### [ ] T-08 — GREEN: wire `AuthGuard`+`PlatformPermissionGuard`+`@RequirePlatformPermission` on `platform-control.controller.ts`
**Type**: impl
**Spec**: operator-platform-roles — Write Routes Require the Declared WRITE Permission; Guard Order Keeps 401, Permission-403, and Step-up-403 Distinct
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/viewpro-api/src/platform-control/platform-control.controller.ts`:
  - Class-level: `@UseGuards(AuthGuard, PlatformPermissionGuard)` (replaces the current `@UseGuards(AuthGuard)`)
  - `updateTenantStatus`: add `@RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE)` (keep existing method-level `@UseGuards(StepUpGuard) @StepUpStatusTargets(...)` — additive, unchanged order)
  - `updateTenantLimits`: add `@RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE)` (keep existing method-level `@UseGuards(StepUpGuard)`)
- `apps/viewpro-api/src/platform-control/platform-control.module.ts`: add `PermissionsModule` to `imports` (alongside `AuthModule`)
- Confirm T-07 GREEN; confirm every pre-existing assertion in the file (401-without-session, 200-with-OWNER-session, terminality relay, step-up-gating from the prior slice) stays GREEN unmodified — proves AC2 (OWNER, the only role in the production seed, keeps full unchanged access)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-07 GREEN; full `platform-control` suite GREEN (zero regression).
**Commit**: `feat(platform-api): gate PATCH status/limits with PlatformPermissionGuard (AuthGuard→Permission→StepUp order) (D7)`

---

### [ ] T-09 — RED: metrics/tenant-registry/audit controller specs — READ routes: ANALYST/OPERATIONS/OWNER all 200
**Type**: test (RED)
**Spec**: operator-platform-roles — Read Routes Require the Declared READ Permission
**WU**: WU-1, commit 9
**Depends on**: T-08

- Extend all three files, each importing `PermissionsModule` into their `Test.createTestingModule({ imports: [...] })` and seeding role fixtures the same way as T-07 (`prisma.operator.update` after `pnpm db:seed`):
  - `apps/viewpro-api/src/platform-data/__tests__/metrics.controller.spec.ts` — ANALYST session → `GET /operators/metrics/summary` → 200; OPERATIONS session → 200 (b — READ half, c)
  - `apps/viewpro-api/src/platform-data/__tests__/tenant-registry.controller.spec.ts` — ANALYST session → `GET /operators/tenants` → 200; OPERATIONS session → 200
  - `apps/viewpro-api/src/platform-data/__tests__/audit.controller.spec.ts` — ANALYST session → `GET /operators/audit` → 200; OPERATIONS session → 200
  - In each file, confirm the pre-existing OWNER-session 200 assertions are untouched (AC2 regression)

Note: the spec's "operator lacking a READ permission is denied" scenario has no real-role fixture today (ANALYST is the minimal role and already holds all 3 READs) — that generic deny-path is exhaustively covered at the unit level in T-05 (role's permission set lacking the required permission → 403), so no throwaway controller is introduced here (h is fully covered by T-05's fail-closed + role-mismatch assertions).

All RED until T-10.
**Exit**: all three files compile; new assertions fail (no permission guard on the routes yet — they'll currently 200 regardless of role, since PlatformPermissionGuard isn't wired, but the NEW assertions specifically check the ANALYST/OPERATIONS session flow works at all, which requires PermissionsModule wiring for DI to resolve; RED because the module isn't imported into these test fixtures yet).
**Commit**: `test(platform-api): RED — read routes (metrics/tenants/audit) allow ANALYST + OPERATIONS (AC3 READ half)`

---

### [ ] T-10 — GREEN: wire guard+annotations on the 3 read controllers + `PermissionsModule` import in `platform-data.module.ts`
**Type**: impl
**Spec**: operator-platform-roles — Read Routes Require the Declared READ Permission
**WU**: WU-1, commit 10
**Depends on**: T-09

- `apps/viewpro-api/src/platform-data/metrics.controller.ts`: class-level `@UseGuards(AuthGuard, PlatformPermissionGuard)`; `@RequirePlatformPermission(PLATFORM_PERMISSIONS.METRICS_READ)` on `getSummary`
- `apps/viewpro-api/src/platform-data/tenant-registry.controller.ts`: class-level `@UseGuards(AuthGuard, PlatformPermissionGuard)`; `@RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANTS_READ)` on `list`
- `apps/viewpro-api/src/platform-data/audit.controller.ts`: class-level `@UseGuards(AuthGuard, PlatformPermissionGuard)`; `@RequirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_READ)` on `list`
- `apps/viewpro-api/src/platform-data/platform-data.module.ts`: add `PermissionsModule` to `imports` (alongside `AuthModule`)
- Confirm T-09 GREEN; confirm every pre-existing assertion across all three spec files stays GREEN unmodified (AC2); confirm the full `apps/viewpro-api` suite is GREEN (closes WU-1's implementation)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-09 GREEN; full `apps/viewpro-api` suite GREEN; `pnpm --filter @viewpro/platform-api typecheck` passes.
**Commit**: `feat(platform-api): gate metrics/tenants/audit GET routes with PlatformPermissionGuard (D7)`

---

## T-11 — Final verification

**Type**: verify
**Spec**: All invariants; proposal acceptance criteria 1–8; operator-platform-roles all 9 requirements
**WU**: closes WU-1
**Depends on**: T-10

**Spec-scenario regression checklist (all MUST be green from prior tasks):**
1. Existing seeded (OWNER) operator passes every route unchanged — every pre-existing test in `platform-control`, `metrics`, `tenant-registry`, `audit` specs stays GREEN, unmodified (T-08, T-10 — a)
2. ANALYST: 200 on all 3 READs, 403 `PERMISSION_DENIED` on both WRITEs, no mutation/outbox/control-lane call on denial (T-07, T-09 — b)
3. OPERATIONS: 200 on both WRITEs (with step-up), 200 on all 3 READs (T-07, T-09 — c)
4. Role hierarchy: OPERATIONS excludes `PLATFORM_OPERATORS_MANAGE`; ANALYST has only READs; OWNER is a strict superset (T-03 — d)
5. Guard order: unauthenticated → 401 always (T-08 regression); ANALYST on a destructive route → 403 `PERMISSION_DENIED` before step-up is ever evaluated; OWNER without step-up → still 403 `STEP_UP_REQUIRED` (T-07 — e)
6. Role change mid-session (OPERATIONS→ANALYST) denies the very next request on the same still-valid cookie, no re-login (T-07 — f)
7. SUSPENDED operator with a valid access cookie → 403 `PERMISSION_DENIED` on a guarded route (T-07 — g)
8. Fail-closed: a route under `PlatformPermissionGuard` with no `@RequirePlatformPermission` declaration → 403, verified at the unit level (T-05 — h)
9. Migration backfill: fresh seed reads back `role === 'OWNER'`; DMMF confirms the column default is `'OWNER'` (T-01/T-02 — i). **Manual note**: this test DB has no pre-slice row to backfill; the `ADD COLUMN ... NOT NULL DEFAULT 'OWNER'` semantics (verified via the committed `migration.sql`) is the authoritative guarantee that any real pre-existing row backfills atomically — call this out explicitly in the PR description for reviewer awareness.
10. `operator-schema.spec.ts` updated: `role` present, `not.toContain('role')` dropped, `refreshToken`/`invitedBy` guardrails intact (T-01 — j)

**Final verification checklist**:
1. `pnpm --filter @viewpro/platform-api test` — all GREEN (auth, step-up, idle-timeout, platform-control, metrics, tenant-registry, audit, database, permissions suites)
2. `pnpm --filter @viewpro/platform-api typecheck` — passes
3. Step-up regression: every `step-up.controller.spec.ts` / `step-up.guard.spec.ts` / step-up-gating assertion in `platform-control.controller.spec.ts` from `platform-step-up-reauth` stays GREEN (guard order: Auth → Permission → StepUp is additive, never removes a StepUp check)
4. Idle-timeout regression: `auth-idle-timeout.spec.ts` stays GREEN (permission guard never touches cookies or the idle-reissue path)
5. `git diff HEAD -- viewpro-app/packages/platform-contract` — empty (zero contract change, AC8)
6. `git diff HEAD -- viewpro-app/apps/api` — empty (zero InmoView change, AC8)
7. `git diff HEAD -- viewpro-app/apps/viewpro-web` — empty (zero viewpro-web change, AC8)
8. `git diff HEAD -- viewpro-app/apps/viewpro-api/prisma/schema.prisma` — exactly one model change (`Operator.role` + its enum), no other schema drift (AC8)
9. Confirm `PLATFORM_OPERATORS_MANAGE` appears in `ROLE_PERMISSIONS.OWNER` but is not referenced by any `@RequirePlatformPermission(...)` call across the 5 routes (AC5, grep `PLATFORM_OPERATORS_MANAGE` usage — only `role-permissions.ts` and its spec should match)
10. Review-workload note carried into the review step: this PR is a hot-path diff (new authorization guard + schema migration) — run the full 4R lens sweep at `review/start(target)` regardless of the ~380–450 line count, per the Review Workload Forecast above

**Exit**: all 10 spec-scenario checklist items + all 10 final-verification checklist items pass; no regressions in existing auth/step-up/idle-timeout/platform-control/platform-data suites.
**Commit**: `chore(platform-operator-roles-seam): final verification — full suite green, zero cross-app diff, only Operator.role schema change`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-01 RED: schema+seed guardrail tests | test | WU-1 | Every Operator Has a Platform Role; Migration Backfills | — |
| T-02 GREEN: schema.prisma+migration+seed.ts | impl | WU-1 | D2/D9 | T-01 |
| T-03 RED: role-permissions map tests | test | WU-1 | Role Hierarchy | T-02 |
| T-04 GREEN: constants + role-permissions.ts | impl | WU-1 | D3 | T-03 |
| T-05 RED: PlatformPermissionGuard unit tests | test | WU-1 | Fail-Closed; Read/Write Routes; guard-order 401 branch | T-04 |
| T-06 GREEN: decorator + guard + PermissionsModule | impl | WU-1 | D5/D6/D8 | T-05 |
| T-07 RED: platform-control WRITE-route integration tests | test | WU-1 | Write Routes; Guard Order; Role-Change; (SUSPENDED) | T-06 |
| T-08 GREEN: wire guard on platform-control.controller.ts | impl | WU-1 | D7 | T-07 |
| T-09 RED: metrics/tenants/audit READ-route integration tests | test | WU-1 | Read Routes | T-08 |
| T-10 GREEN: wire guard on 3 read controllers + platform-data.module.ts | impl | WU-1 | D7 | T-09 |
| T-11 Final verification | verify | WU-1 | All invariants + AC1-8 | T-10 |

---

## Success Checklist (maps to proposal acceptance criteria 1–8 + spec invariants)

- [ ] Every protected `operators/*` route enforces its declared permission via `PlatformPermissionGuard` (AC1) (T-08, T-10)
- [ ] OWNER (the only role today) passes all routes with zero behavior change; every pre-existing test stays green (AC2) (T-08, T-10)
- [ ] ANALYST is allowed the 3 READ routes and denied (403 `PERMISSION_DENIED`) both WRITE routes, with no mutation/outbox/control-lane call on denial (AC3) (T-07, T-09)
- [ ] OPERATIONS is allowed both WRITE routes and denied anything requiring `PLATFORM_OPERATORS_MANAGE` (AC4) (T-07, T-03)
- [ ] `PLATFORM_OPERATORS_MANAGE` is declared for OWNER but no route uses it (AC5) (T-03, T-11 checklist item 9)
- [ ] Guard order holds: unauthenticated → 401; authenticated-but-unauthorized → 403 `PERMISSION_DENIED`; step-up still required and distinct (403 `STEP_UP_REQUIRED`) on destructive routes (AC6) (T-07, T-08)
- [ ] Post-migration, the seeded operator reads back `role = OWNER`; seed sets OWNER explicitly (AC7) (T-01, T-02)
- [ ] Diff invariants: exactly one schema change (`Operator.role`), zero `platform-contract`/`apps/api`/`viewpro-web` change (AC8) (T-11 checklist items 5–8)
- [ ] A role change takes effect on the operator's very next request, no re-login, no token dependency (spec Requirement 6) (T-07)
- [ ] A route with no declared permission fails closed (deny), never silently authorizes (spec Requirement 7) (T-05)
- [ ] A SUSPENDED operator with a valid session is denied on every guarded route (status-hardening, D6) (T-07)
- [ ] Step-up and idle-timeout regressions from prior slices stay green (T-11 checklist items 3–4)
