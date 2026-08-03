# Proposal: Platform D4 — Internal Operator Roles Authorization Seam

**Change id**: `platform-operator-roles-seam`
**Store**: `openspec/changes/platform-operator-roles-seam/proposal.md` (+ Engram `sdd/platform-operator-roles-seam/proposal`)
**Vision**: D4 (internal platform roles), re-interpreted for the post-split architecture (`apps/viewpro-api` owns its `Operator` model). A4 (operator management) is a separate future slice.
**Grounded in**: explore #5921; code read of `viewpro-api` auth guard + platform-control/metrics/audit/registry controllers, seed, guardrail test, and the InmoView `apps/api/src/permissions` pattern.

---

## 1. Why

Today operator access is **binary**. `AuthGuard` verifies a stateless JWT (`{sub,email,sessionExp}`, no DB read, no `role` claim) and every protected `operators/*` route is guarded by `AuthGuard` alone (+ `StepUpGuard` on the two destructive PATCHes). Any authenticated operator can therefore read metrics, list tenants, read audit, **and** suspend/cancel/re-limit tenants — there is no way to grant a read-only or ops-only operator.

D4's intent (vision doc) is to **route authorization through a platform-permission layer now**, mirroring InmoView's tenant `PermissionGuard`, so that adding a real second role later is a **data change** (extend a static role→permission map + set a column) rather than a controller rewrite. This is the "design the seams now, build the roles when there are people to fill them" principle. We build the seam now while there is exactly one operator; enforcement is real but **permissive today because every operator is OWNER**.

**Success.** Every protected `operators/*` route **declares** its required platform permission via a decorator; a `PlatformPermissionGuard` resolves the operator's role → permissions and enforces the declaration (403 on mismatch). The single existing OWNER operator keeps full access with zero behavior change; a hypothetical ANALYST/OPERATIONS would be correctly scoped without touching any controller.

---

## 2. What Changes

### In scope (single backend slice, `viewpro-api` only)
1. **Migration — `Operator.role`.** Add enum `PlatformOperatorRole { OWNER, OPERATIONS, ANALYST }` and column `role PlatformOperatorRole @default(OWNER)`. The default backfills the existing seeded row (and any current row) to OWNER — no data loss, no behavior change. This is the **only** schema change.
2. **Seed update** (`prisma/seed.ts`) — set `role: 'OWNER'` explicitly on the seeded operator's `create`.
3. **Guardrail-test update** (`src/database/__tests__/operator-schema.spec.ts`) — add `role` to the expected-fields set and drop the `expect(fields).not.toContain('role')` assertion (this constraint is intentionally lifted; `refreshToken`/`invitedBy` guardrails stay).
4. **Role→permission map** — static `Record<PlatformOperatorRole, PlatformPermission[]>` + `getPermissionsForRole()`, mirroring InmoView's `role-permissions.ts`. Permissions: `PLATFORM_METRICS_READ`, `PLATFORM_TENANTS_READ`, `PLATFORM_AUDIT_READ`, `PLATFORM_TENANT_STATUS_WRITE`, `PLATFORM_TENANT_LIMITS_WRITE`, and a **future-only** `PLATFORM_OPERATORS_MANAGE`. Mapping: ANALYST = the 3 READs; OPERATIONS = ANALYST + the 2 WRITEs; OWNER = OPERATIONS + `PLATFORM_OPERATORS_MANAGE` (everything).
5. **`@RequirePlatformPermission(...)` decorator** — `SetMetadata` + Reflector key, mirroring `require-permissions.decorator.ts`.
6. **`PlatformPermissionGuard`** — reads the route's declared permission (Reflector), resolves the operator's role → permissions, throws `ForbiddenException` on mismatch. Runs **after** `AuthGuard` (so `request.user` is guaranteed).
7. **Per-route permission declarations** (annotate every protected route):
   - `GET /operators/metrics/summary` → `PLATFORM_METRICS_READ`
   - `GET /operators/tenants` → `PLATFORM_TENANTS_READ`
   - `GET /operators/audit` → `PLATFORM_AUDIT_READ`
   - `PATCH /operators/tenants/:id/status` → `PLATFORM_TENANT_STATUS_WRITE` (keep `AuthGuard` + `StepUpGuard`; permission guard is additive)
   - `PATCH /operators/tenants/:id/limits` → `PLATFORM_TENANT_LIMITS_WRITE` (keep `StepUpGuard`)

### Guard ordering (additive & orthogonal to step-up)
NestJS runs controller-level guards before method-level guards. Declaring the permission guard at the class level (`@UseGuards(AuthGuard, PlatformPermissionGuard)`) and keeping `StepUpGuard` at the method level yields **AuthGuard → PlatformPermissionGuard → StepUpGuard** on the destructive routes: authenticate, then authorize (403 if role lacks the permission), then prove freshness (step-up). The permission guard neither authenticates nor weakens step-up. Exact wiring (class-level vs. per-route) is finalized in design.

## Capabilities

### New Capabilities
- `platform-operator-authorization`: the `PlatformOperatorRole` enum + `Operator.role` column, the static role→permission map, the `@RequirePlatformPermission` decorator, the `PlatformPermissionGuard`, the per-route permission declarations, the seed/guardrail-test updates, and the role-resolution mechanism (design-decided).

### Modified Capabilities
- None. Existing operator-auth and platform-control behavior is extended additively (one column defaulting to OWNER, one guard). No existing requirement changes; OWNER holds every permission, so current behavior is preserved.

## 3. Key open design question — role-resolution mechanism (DEFER to design)

`AuthGuard` is 100% JWT-self-contained today (no per-request DB read). `PlatformPermissionGuard` must learn the operator's role. **Present both, decide in design:**

- **Option A — `role` claim in the access token.** Add `role` to the JWT at login; the guard reads it with no per-request DB hit. **Tradeoff:** a role change is **stale** until the token re-issues. Note the rolling idle token re-issues within ≤10 min (D5 threshold), so staleness is bounded but real — **and the claim must be carried/refreshed on every re-issue** (`reissueAccessToken`) or the role would silently drop.
- **Option B — per-request DB lookup** (`operatorRepository.findById(sub).role`, like InmoView's `TenantMembershipGuard`). **Tradeoff:** role changes take effect immediately, but it **breaks `AuthGuard`'s DB-free property** and adds a round-trip per request (cheap today — Operator table is ~1 row).

Design picks one and records the rationale (staleness vs. per-request DB cost). The decorator/guard/map shape is identical either way — only the resolution source differs.

## 4. Impact / Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `viewpro-api/prisma/schema.prisma` | Modified | Add `PlatformOperatorRole` enum + `Operator.role @default(OWNER)` |
| `viewpro-api/prisma/migrations/*` | New | The single role migration (backfills existing rows to OWNER) |
| `viewpro-api/prisma/seed.ts` | Modified | Set `role: 'OWNER'` explicitly |
| `viewpro-api/src/database/__tests__/operator-schema.spec.ts` | Modified | Add `role` to expected set; drop `not.toContain('role')` |
| `viewpro-api/src/.../permissions/` (new module) | New | permission constants, role→permission map, decorator, guard |
| `viewpro-api/.../platform-control.controller.ts` | Modified | Add permission guard + `@RequirePlatformPermission` on 2 PATCHes |
| `viewpro-api/.../metrics|audit|tenant-registry controllers` | Modified | Add permission guard + declaration on the 3 GETs |
| `packages/platform-contract` | **None** | Zero contract change — D4 is internal to viewpro-api |
| `apps/api` (InmoView), `viewpro-web` | **None** | Zero change |

## 5. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **R1** — reopening the explicit `not.toContain('role')` guardrail (was a deliberate Phase-4 constraint) | High (intended) | The constraint is intentionally lifted; update the test to assert `role` present + still forbid `refreshToken`/`invitedBy`. Documented as a deliberate scope change. |
| **R2** — role-resolution mechanism choice (staleness vs. per-request DB cost) | Med | Present both (§3); defer to design with an explicit tradeoff record. Seam shape is identical either way, so a later switch is low-cost. |
| **R3** — migration on an already-seeded table must backfill existing rows | Med | `@default(OWNER)` backfills every existing row to OWNER at migrate time; verify the seeded operator reads back OWNER post-migration. |
| **R4** — guard-ordering regression (a 401 becoming a 403 or vice-versa; step-up weakened) | Med | Order **AuthGuard → PlatformPermissionGuard → StepUpGuard**; permission guard runs only after `request.user` is set and never authenticates. Assert unauth → 401, authed-but-unauthorized → 403, step-up still enforced. |
| **R5** — an un-annotated route is unprotected-by-permission | Med | Prefer a **secure-by-default** stance (guard denies when no permission is declared) **or** explicitly document that every protected route is annotated and add a coverage test. Design decides. |
| **R6** — Option A (`role` claim) interacting with rolling-token re-issue | Med (only if A chosen) | If A is chosen, `reissueAccessToken` must carry/refresh the `role` claim; add a test that a re-issued token retains the correct role. |

## 6. Acceptance criteria

1. Every protected `operators/*` route enforces its declared permission via `PlatformPermissionGuard`.
2. An **OWNER** (the only role today) passes **all** routes — read and write — with no behavior change; every existing login-then-hit-route test stays green.
3. A hypothetical **ANALYST** is **allowed** the 3 READ routes and **denied (403)** both WRITE routes.
4. A hypothetical **OPERATIONS** is **allowed** both WRITE routes and **denied (403)** anything requiring `PLATFORM_OPERATORS_MANAGE`.
5. `PLATFORM_OPERATORS_MANAGE` is declared for OWNER in the map but **no route uses it** (future A4 seam only).
6. Guard order holds: unauthenticated → **401** (AuthGuard), authenticated-but-unauthorized → **403** (permission guard), and step-up is still required on destructive routes.
7. Post-migration, the existing seeded operator reads back `role = OWNER`; seed sets OWNER explicitly.
8. Diff invariants: **exactly one** schema change (`Operator.role`), **zero** platform-contract change, **zero** `apps/api` change, **zero** `viewpro-web` change.

## 7. Out of scope

- **Operator management (A4)** — create/invite/suspend other operators. This change only **declares** `PLATFORM_OPERATORS_MANAGE` for OWNER so it's ready; it builds **no** operator-management route.
- **Any FE change** — a permissive seam needs no console UI change; hiding actions by role is a later slice.
- **MFA / TOTP** and any change to the just-shipped step-up + idle-timeout behavior.
- **Any platform-contract change**, any `apps/api` (InmoView) change, any `viewpro-web` change.
- **Enforced multi-role RBAC as a product feature** — no second operator exists to test against; that is deferred until A4 populates real roles.

## 8. Delivery & rollback

- **WU/PR split.** One backend work unit / **one PR**: migration + seed + guardrail-test update + permission constants/map + decorator + guard + the 5 route annotations + tests. Single app, well under the 400-line budget; no cross-app dependency.
- **Rollback.** Revert the migration (drop `role` + enum), remove the permission guard/decorator/map and the route annotations, restore the seed and guardrail test. Because every operator was OWNER (all permissions), removing the seam restores exactly today's binary-access behavior with no data reinterpretation.

## 9. Next recommended

`sdd-spec` and `sdd-design` can run in parallel. Design must resolve §3 (role-resolution mechanism) and §2 guard-wiring/secure-by-default (R5).
