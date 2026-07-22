# Design: Platform D4 — Internal Operator Roles Authorization Seam

Add `Operator.role` (`PlatformOperatorRole { OWNER, OPERATIONS, ANALYST }`, `@default(OWNER)`) and a new self-contained `permissions/` module in viewpro-api: a static role→permission map, a `@RequirePlatformPermission(...)` decorator, and a `PlatformPermissionGuard` that resolves the operator's role via a **per-request DB lookup** (locked — no JWT claim; `AuthGuard` stays DB-free and the token keeps `{sub,email,sessionExp}`). The guard is wired class-level after `AuthGuard` on all 4 operator controllers, so the order on destructive routes is AuthGuard(401) → PlatformPermissionGuard(403 `PERMISSION_DENIED`) → StepUpGuard(403 `STEP_UP_REQUIRED`). OWNER holds every permission, so behavior today is unchanged. Paths below are under `viewpro-app/`.

## Technical Approach

Mirror InmoView's `apps/api/src/permissions/*` + `TenantMembershipGuard` DB-lookup pattern, adapted to the operator lane. The guard reuses the **already-existing** `IOperatorRepository.findById` (added by the step-up slice) — zero repository change; after `prisma generate`, the generated `Operator` type carries `role` automatically. Enforcement is real but permissive today (single operator = OWNER).

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Role resolution (LOCKED) | Per-request DB lookup inside `PlatformPermissionGuard` via `OPERATOR_REPOSITORY.findById(request.user.id)` | `role` JWT claim | Immediate revocation (no staleness window, no coupling to the rolling-token re-issue in `reissueAccessToken`); mirrors InmoView's `TenantMembershipGuard`; `AuthGuard` keeps its DB-free property. Cost: one indexed PK `findUnique` per protected request — negligible for a ~1-row control-plane table (D8) |
| D2 | Schema + migration | `enum PlatformOperatorRole { OWNER OPERATIONS ANALYST }`; `role PlatformOperatorRole @default(OWNER)` on `Operator`. New migration `add_operator_role`: `CREATE TYPE "PlatformOperatorRole" AS ENUM ('OWNER','OPERATIONS','ANALYST'); ALTER TABLE "Operator" ADD COLUMN "role" "PlatformOperatorRole" NOT NULL DEFAULT 'OWNER';` | Nullable column + backfill script; string column | `ADD COLUMN ... NOT NULL DEFAULT` backfills every existing row atomically (Postgres) — the seeded operator reads back OWNER with no data script (R3). Native enum mirrors the existing `OperatorStatus` migration style. Generate with `prisma migrate dev`; test/prod DBs apply via root `db:platform:migrate` (`prisma migrate deploy`). **Never hand-edit an applied migration** — checksum drift breaks `migrate deploy` on DBs that already recorded it (prior-slice gotcha) |
| D3 | Permission shape | `PLATFORM_PERMISSIONS` const object + `PlatformPermission` union in `platform-permissions.constants.ts`: `PLATFORM_METRICS_READ`, `PLATFORM_TENANTS_READ`, `PLATFORM_AUDIT_READ`, `PLATFORM_TENANT_STATUS_WRITE`, `PLATFORM_TENANT_LIMITS_WRITE`, `PLATFORM_OPERATORS_MANAGE` (future-only). Map: `ROLE_PERMISSIONS: Record<PlatformOperatorRole, readonly PlatformPermission[]>` built compositionally (OPERATIONS = ANALYST + writes; OWNER = OPERATIONS + `PLATFORM_OPERATORS_MANAGE`) + `getPermissionsForRole()` with `?? []` fallback | DB permission table; TS enum | Exact structural mirror of InmoView `role-permissions.ts` / `permissions.constants.ts`. Composition makes the subset relation self-evident and testable. Static map = adding a role later is a data change (D4 vision) |
| D4 | Decorator | `@RequirePlatformPermission(permission)` — **single** permission, `SetMetadata(REQUIRED_PLATFORM_PERMISSION_KEY, permission)` | Variadic all/any pair like InmoView's `RequirePermissions`/`RequireAnyPermission` | All 5 routes need exactly one permission; any/all machinery is dead code here. Single-arg also makes the secure-by-default check unambiguous (`undefined` = undeclared). Widening to variadic later is additive and non-breaking |
| D5 | Secure-by-default | If the guard runs and **no** permission metadata is found (handler + class via `getAllAndOverride`) → throw 403 `PERMISSION_DENIED` (deny) | InmoView's permissive `return true` when undeclared; lint/test-only coverage guarantee | Fail closed (R5): a future route added to a guarded controller without an annotation 403s for everyone and is caught by its very first test, instead of shipping silently unrestricted. Deviation from the InmoView guard is deliberate and documented — that guard is permissive because it's applied broadly; ours is scoped to controllers where every route MUST declare |
| D6 | Guard flow + 403 contract | `canActivate`: (1) `request.user` absent → 401 `{ statusCode:401, code: AUTH_REQUIRED_CODE, message }` (fail closed; unreachable behind AuthGuard); (2) no metadata → deny (D5); (3) `findById(user.id)`; operator missing or `status !== 'ACTIVE'` → deny; (4) `getPermissionsForRole(operator.role).includes(required)` or deny. Deny body: `{ statusCode: 403, code: 'PERMISSION_DENIED', message: 'Insufficient permissions' }` (`PERMISSION_DENIED_CODE` exported constant) | Codes `FORBIDDEN_PERMISSION`/`INSUFFICIENT_ROLE`; reusing plain `ForbiddenException('Insufficient permissions')`; distinct code per deny reason | A stable machine-readable `code` follows the established `AUTH_REQUIRED`/`STEP_UP_REQUIRED` convention. `PERMISSION_DENIED` (not `*_REQUIRED`) signals "not user-retryable" — the FE step-up gate keys on `code === 'STEP_UP_REQUIRED'` and MUST NOT open for it; the session-expiry flow keys on **401** `AUTH_REQUIRED` and is untouched (403 never reaches it). One code for all deny reasons avoids leaking account state (missing vs suspended vs role) |
| D7 | Wiring & order | Class-level `@UseGuards(AuthGuard, PlatformPermissionGuard)` on all 4 controllers (`PlatformControlController`, `MetricsController`, `TenantRegistryController`, `AuditController`); `StepUpGuard` stays **method-level** on the 2 PATCHes; `@RequirePlatformPermission(...)` per route | Method-level permission guard everywhere; global guard | Nest runs class-level guards in array order, before method-level guards → AuthGuard → PlatformPermissionGuard → StepUpGuard structurally. Unauth → 401 first; an ANALYST hitting a write 403s on permission **before** any step-up logic (no `STEP_UP_REQUIRED`, no modal); step-up freshness stays the last gate. `request.user` is guaranteed when the permission guard runs |
| D8 | Module wiring | New `PermissionsModule` (viewpro-api): providers `[PlatformPermissionGuard, { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository }]`, exports `[PlatformPermissionGuard]`. `PlatformControlModule` and `PlatformDataModule` add it to `imports` | Export `OPERATOR_REPOSITORY` from `AuthModule` and import that; declare guard inside `AuthModule` | Exported providers resolve deps in their **host** module, so the guard's repository binding lives beside it — self-contained like InmoView's `PermissionsModule`, no new `AuthModule` export surface. `PrismaService` comes from the global `DatabaseModule`; a second stateless repository instance is harmless |
| D9 | Seed + guardrail test | `seed.ts` `create` gains `role: 'OWNER'` (upsert `update: {}` untouched). `operator-schema.spec.ts`: add `role` to the expected-fields set, **drop** `not.toContain('role')` (deliberately lifted), keep `refreshToken`/`invitedBy` guardrails, and assert via DMMF that `role`'s default is `OWNER` | Relying on the column default only | Explicit seed value documents intent; the DMMF default assertion locks the backfill-by-default contract (R3) in CI |

## Data Flow

    PATCH /operators/tenants/:id/status  (ANALYST session)
      AuthGuard (class, 1st): access cookie → verify → request.user = {id, email}
        fail → 401 { code: 'AUTH_REQUIRED' }            (FE session flow, unchanged)
      PlatformPermissionGuard (class, 2nd):
        required = Reflector(handler→class) → 'PLATFORM_TENANT_STATUS_WRITE'
        undeclared → 403 PERMISSION_DENIED (D5, fail closed)
        operator = OPERATOR_REPOSITORY.findById(user.id)   ← one PK lookup (D1)
        !operator || status !== 'ACTIVE' || !perms(role).includes(required)
          → 403 { code: 'PERMISSION_DENIED' }            (StepUpGuard NEVER runs;
                                                          no outbox/control-lane call;
                                                          FE step-up modal never opens)
      StepUpGuard (method, 3rd): unchanged — 403 { code: 'STEP_UP_REQUIRED' } / pass
      handler → PlatformControlClient → InmoView (unchanged)

    Role change: UPDATE "Operator" SET role='ANALYST' → very next request re-reads
    the row → writes now 403. No re-login, no token staleness (D1).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-api/prisma/schema.prisma` | Modify | `PlatformOperatorRole` enum + `Operator.role @default(OWNER)` (only schema change) |
| `apps/viewpro-api/prisma/migrations/{ts}_add_operator_role/migration.sql` | Create | `CREATE TYPE` + `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT 'OWNER'` (D2) |
| `apps/viewpro-api/prisma/seed.ts` | Modify | `role: 'OWNER'` in `create` (D9) |
| `apps/viewpro-api/src/permissions/platform-permissions.constants.ts` | Create | `PLATFORM_PERMISSIONS`, `PlatformPermission`, `PERMISSION_DENIED_CODE` (D3/D6) |
| `apps/viewpro-api/src/permissions/role-permissions.ts` | Create | `ROLE_PERMISSIONS` + `getPermissionsForRole()` (D3) |
| `apps/viewpro-api/src/permissions/require-platform-permission.decorator.ts` | Create | `@RequirePlatformPermission` + metadata key (D4) |
| `apps/viewpro-api/src/permissions/platform-permission.guard.ts` | Create | `PlatformPermissionGuard` (D5/D6) |
| `apps/viewpro-api/src/permissions/permissions.module.ts` | Create | Guard + `OPERATOR_REPOSITORY` binding; exports guard (D8) |
| `apps/viewpro-api/src/platform-control/platform-control.controller.ts` | Modify | Class `@UseGuards(AuthGuard, PlatformPermissionGuard)`; `@RequirePlatformPermission` on both PATCHes (STATUS_WRITE / LIMITS_WRITE); StepUpGuard untouched |
| `apps/viewpro-api/src/platform-control/platform-control.module.ts` | Modify | imports += `PermissionsModule` |
| `apps/viewpro-api/src/platform-data/metrics.controller.ts` | Modify | Guard + `PLATFORM_METRICS_READ` on `GET summary` |
| `apps/viewpro-api/src/platform-data/tenant-registry.controller.ts` | Modify | Guard + `PLATFORM_TENANTS_READ` on `GET` |
| `apps/viewpro-api/src/platform-data/audit.controller.ts` | Modify | Guard + `PLATFORM_AUDIT_READ` on `GET` |
| `apps/viewpro-api/src/platform-data/platform-data.module.ts` | Modify | imports += `PermissionsModule` |
| `apps/viewpro-api/src/database/__tests__/operator-schema.spec.ts` | Modify | `role` expected + default-OWNER assertion; drop `not.toContain('role')` (D9) |
| `apps/viewpro-api/src/permissions/__tests__/role-permissions.spec.ts` | Create | Exact map assertions incl. OWNER-only `PLATFORM_OPERATORS_MANAGE` |
| `apps/viewpro-api/src/permissions/__tests__/platform-permission.guard.spec.ts` | Create | Unit guard matrix (mocked context + repo) |
| `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts` | Modify | Role-based 403 / guard-order / role-change integration tests |
| `apps/viewpro-api/src/platform-data/__tests__/{metrics,tenant-registry,audit}.controller.spec.ts` | Modify | ANALYST allowed / undeclared-deny stays covered by existing 200-path + new role tests |

No changes: `packages/platform-contract`, `apps/api` (InmoView), `apps/viewpro-web`, `operator.repository.ts` / `prisma-operator.repository.ts` (`findById` already exists and returns the full Prisma `Operator`, which gains `role` at generate time), `auth.guard.ts`, `step-up.guard.ts`, `/auth/*` routes (auth infrastructure — intentionally not permission-guarded).

## Interfaces / Contracts

    enum PlatformOperatorRole { OWNER OPERATIONS ANALYST }        // prisma
    type PlatformPermission = 'PLATFORM_METRICS_READ' | 'PLATFORM_TENANTS_READ'
      | 'PLATFORM_AUDIT_READ' | 'PLATFORM_TENANT_STATUS_WRITE'
      | 'PLATFORM_TENANT_LIMITS_WRITE' | 'PLATFORM_OPERATORS_MANAGE'

    ROLE_PERMISSIONS: ANALYST = [3 READs]
                      OPERATIONS = ANALYST + [STATUS_WRITE, LIMITS_WRITE]
                      OWNER = OPERATIONS + [PLATFORM_OPERATORS_MANAGE]   // no route uses it (A4 seam)

    @RequirePlatformPermission(p: PlatformPermission)             // SetMetadata, single

    // PlatformPermissionGuard deny (all reasons — undeclared route, unknown/
    // non-ACTIVE operator, role lacks permission):
    403 { statusCode: 403, code: 'PERMISSION_DENIED', message: 'Insufficient permissions' }
    // Distinct from 401 AUTH_REQUIRED and 403 STEP_UP_REQUIRED — no FE collision.

## Step-up / idle-timeout interaction (explicit)

Additive and orthogonal. The permission guard never reads or clears cookies and never authenticates. FE: `isStepUpRequiredError` requires `code === 'STEP_UP_REQUIRED'` → a `PERMISSION_DENIED` 403 does **not** open the step-up modal; the session-expiry interceptor keys on **401** + `AUTH_REQUIRED` → never sweeps a 403. A `PERMISSION_DENIED` today surfaces as a generic API error (acceptable — no FE change in scope; role-aware UI is a later slice).

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Map: exact per-role arrays; OPERATIONS ⊇ ANALYST; only OWNER has `PLATFORM_OPERATORS_MANAGE` (AC5 — asserted on the map since no route uses it) | vitest |
| Unit | Guard: undeclared metadata → 403 `PERMISSION_DENIED` (D5); missing `request.user` → 401; operator not found / SUSPENDED → 403; role×permission matrix; body `code` asserted | vitest, mocked `ExecutionContext` + repo |
| Unit | Schema guardrail: `role` present, default `OWNER`, `refreshToken`/`invitedBy` still absent | DMMF (existing spec) |
| Integration | Role fixtures: seed via `pnpm db:seed` (OWNER), then `prisma.operator.update({ where: { email }, data: { role: 'ANALYST' \| 'OPERATIONS' } })` through `PrismaService` — production seed stays OWNER-only | supertest + platform test DB (`migrate deploy` applied) |
| Integration | ANALYST: 200 on the 3 GETs; 403 `PERMISSION_DENIED` on both PATCHes **without a step-up cookie**, asserting mock `PlatformControlClient` uncalled and `code !== 'STEP_UP_REQUIRED'` (proves permission runs before step-up; no mutation/control-lane call) | extend `platform-control.controller.spec.ts` |
| Integration | OPERATIONS: PATCH without step-up cookie → 403 `STEP_UP_REQUIRED` (permission passed, step-up intact); with step-up cookie → 200 | same |
| Integration | OWNER: all routes pass — every existing login-then-hit-route test stays green unmodified (AC2) | existing suites |
| Integration | Guard order: no cookie → 401 `AUTH_REQUIRED` (never `PERMISSION_DENIED`); revocation: OWNER logs in → 200, DB role → ANALYST → same cookie now 403 on write, no re-login (D1) | same |

## Threat Matrix

New authorization boundary on existing HTTP routes; no shell/subprocess/VCS/routing-config surface (those rows N/A).

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Un-annotated route under guard | Applicable | Deny by default (D5); RED: route without metadata → 403 |
| 401/403 order regression | Applicable | Class-array order (D7); RED: unauth → 401, ANALYST write → permission 403 before step-up |
| Step-up weakening | Applicable | Guard additive, never touches step-up cookie; RED: OPERATIONS write w/o step-up → `STEP_UP_REQUIRED` |
| Stale role after revocation | Applicable | DB lookup per request (D1); RED: role-flip test |
| FE code collision (modal/logout misfire) | Applicable | Distinct `PERMISSION_DENIED`; RED: body-code assertions |
| Account-state enumeration via deny body | Applicable | Single generic code/message for all deny reasons (D6) |

## Migration / Rollout

Single PR (proposal §8), well under the 400-line budget. Migration is additive with a default → applied by the existing `db:platform:migrate` (`prisma migrate deploy`) before app start; guard code and migration ship together (the generated client's `Operator.role` requires the column — do not deploy code without the migration). No env, contract, or FE change. Rollback: revert migration (drop column + type), remove `permissions/` module and the annotations, restore seed + guardrail test — OWNER-only data means behavior is bit-identical either side.

## Open Questions

- [ ] D6 includes `status !== 'ACTIVE'` → deny (free hardening from the DB lookup: a SUSPENDED operator with a live ≤15-min session loses access to all permission-guarded routes immediately). Zero behavior change today (sole operator is ACTIVE), but it is a small scope addition beyond the proposal's literal text — orchestrator may veto; dropping it is a one-line change.
- [ ] None else — role resolution, enum, map, ordering, and deny stance are settled above.
