# Tasks: Platform Phase 5 — /admin WRITE commands over the CONTROL lane

> Backend-only WRITE path (tenant status + limits) from `viewpro-api` to `apps/api`
> over a signed HS256 service-token seam. Strict TDD: RED precedes every GREEN.
> All source paths are under `viewpro-app/`.

---

## Open Questions — resolved inline (tasks phase)

| Question | Decision |
|----------|----------|
| `PLATFORM_CONTROL_SECRET` provisioning | Env var in both processes; note it in `.env.example` of each app. Provisioned as a Dokploy secret at deploy time (ops follow-up, not a code task). |
| `INMOVIEW_API_INTERNAL_URL` local dev default | `http://localhost:3001` — add to `apps/viewpro-api/.env.example` only; no default in schema (required). |
| `trust proxy` value | `1` (single proxy). Topology-dependent; note in `create-app.ts` comment. |
| `platform_command_log` TTL/cleanup | Deferred ops follow-up (no automated cleanup this slice). |
| Throttler key scope | Per-IP-only confirmed (JD follow-up). Remove email from tracker key. |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900–1 200 (new module × 2 apps, service widening, migration, tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → R1 migration + admin-service widening / PR 2 → apps/api PlatformControlModule / PR 3 → viewpro-api outbound + hardening |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (ask before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | R1 DB migration + service/repo actor widening + type-equality assertion | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/api test` (admin suite) | `PATCH /admin/tenants/:id/status` still works with existing user actor | Drop `platform_command_log`; drop `actorOperatorId` col; revert service/repo files |
| WU-2 | apps/api `PlatformControlModule` — guard, idempotency, controller | PR 2 (base: PR 1 branch) | `pnpm --filter @viewpro/api test` (platform-control spec files) | `POST /internal/platform/tenants/:id/status` with forged service JWT → 401; with valid JWT → 200 | Delete `apps/api/src/platform-control/`; remove module import from `app.module.ts` |
| WU-3 | viewpro-api outbound client + operator endpoints + auth hardening + proxy | PR 3 (base: PR 2 branch) | `pnpm --filter @viewpro/platform-api test` (platform-control spec) | `PATCH /operators/tenants/:id/status` as signed-in operator → 200 on InmoView test DB | Revert `apps/viewpro-api/src/platform-control/`; revert env schema; revert `create-app.ts`; revert `proxy.ts` |

---

## Dependency Graph

```
T-01 (platform-contract dep + type assertion — both apps)
  └── T-02 (RED: service-actor unit tests — status + limits)
        └── T-03 (GREEN: widen CommandActor union in repos + services)
              └── T-04 (admin.controller.ts passes {type:'user'})
                    └── T-05 (R1 migration — schema.prisma + migrate)     ← HIGHEST-RISK
                          └── T-06 (RED: migration additive invariant test)
                                └── T-07 (GREEN: confirm migration test passes)
                                      └── T-08 (RED: guard unit tests — PlatformControlGuard)
                                            └── T-09 (GREEN: service-token.verifier + PlatformControlGuard)
                                                  └── T-10 (RED: idempotency unit tests)
                                                        └── T-11 (GREEN: IdempotencyRepository + Prisma impl)
                                                              └── T-12 (RED: controller integration tests — inbound)
                                                                    └── T-13 (GREEN: PlatformControlController + module)
                                                                          ├── T-14 (RED: trust-isolation integration tests)
                                                                          │     └── T-15 (GREEN: trust-isolation confirmed)
                                                                          └── T-16 (RED: viewpro-api env + client unit tests)
                                                                                └── T-17 (GREEN: PlatformControlClient)
                                                                                      └── T-18 (RED: operator endpoint integration tests)
                                                                                            └── T-19 (GREEN: PlatformControlController viewpro-api + module)
                                                                                                  └── T-20 (auth hardening: throttler + trust proxy + cookie)
                                                                                                        └── T-21 (proxy.ts: /admin in isProtectedAppPath)
                                                                                                              └── T-22 (final verification)
```

T-08 and T-10 may begin in parallel once T-07 is done.
T-14 may begin in parallel with T-16 once T-13 is done.

---

## WU-1 — R1 Migration + Service Widening

### [x] T-01 — Add `@viewpro/platform-contract` dep + compile-time type assertion
**Type**: impl
**Spec**: admin-tenant-status-limits — Writable-Target Status Policy; proposal §Scope
**WU**: WU-1, commit 1
**Depends on**: nothing

- Add `"@viewpro/platform-contract": "workspace:*"` to `apps/api/package.json` dependencies
- Add `"@viewpro/platform-contract": "workspace:*"` to `apps/viewpro-api/package.json` dependencies
- In `apps/api/src/admin/admin-tenant-status.service.ts` (or a new `apps/api/src/platform-control/type-assertions.ts`), add:
  `type _AssertPlatformTenantStatusEqualsTenantStatus = [PlatformTenantStatus] extends [TenantStatus] ? [TenantStatus] extends [PlatformTenantStatus] ? true : never : never`; assert resolves to `true`
- Run `pnpm install` from workspace root

**Exit**: `pnpm --filter @viewpro/api typecheck` and `pnpm --filter @viewpro/platform-api typecheck` both pass.
**Commit**: `feat(platform-contract): wire @viewpro/platform-contract into api + platform-api`

---

### [x] T-02 — RED: unit tests for widened `CommandActor` union in status + limits services
**Type**: test (RED)
**Spec**: admin-tenant-status-limits — Dual-Actor Audit Attribution (both scenarios)
**WU**: WU-1, commit 2
**Depends on**: T-01

- `apps/api/src/admin/__tests__/admin-tenant-status.service.spec.ts`
  - Operator actor: mock repo receives `{ type:'operator', operatorId:'op-1' }`; result `AnalyticsEvent` has `actorOperatorId='op-1'`, `actorType=PLATFORM_OPERATOR`, `actorUserId=null`
  - User actor: mock repo receives `{ type:'user', userId:'u-1' }`; result still stamps `actorUserId='u-1'` (regression)
- `apps/api/src/admin/__tests__/admin-tenant-limits.service.spec.ts`
  - Same two actor scenarios for limits service

All RED until services/repos accept `CommandActor`.
**Exit**: test files exist; all assertions fail.
**Commit**: `test(api): RED — CommandActor dual-actor attribution in status + limits services`

---

### [x] T-03 — GREEN: widen `CommandActor` union in repos + services
**Type**: impl
**Spec**: admin-tenant-status-limits — Dual-Actor Audit Attribution
**WU**: WU-1, commit 3
**Depends on**: T-02

- Define `type CommandActor = { type:'user'; userId:string } | { type:'operator'; operatorId:string }` in `apps/api/src/admin/admin-actor.ts`
- Update `UpdateAdminTenantStatusInput` (remove `actorUserId:string`; add `actor: CommandActor`) in `apps/api/src/admin/admin-tenant-status.repository.ts`
- Update `PrismaAdminTenantStatusRepository.updateTenantStatus`: when `actor.type==='operator'`, stamp `actorOperatorId=actor.operatorId`, `actorType=PLATFORM_OPERATOR`, `actorUserId=null`; when `'user'`, preserve current path
- Mirror changes for `UpdateAdminTenantLimitsInput` + `PrismaAdminTenantLimitsRepository`
- Update `AdminTenantStatusService.updateTenantStatus` + `AdminTenantLimitsService.updateTenantLimits` input shapes to accept `actor: CommandActor`
- Confirm T-02 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-02 GREEN; existing admin e2e unaffected (T-04 comes next).
**Commit**: `feat(api): widen CommandActor union in admin-tenant services and repos`

---

### [x] T-04 — Pass `{type:'user'}` actor from `AdminController`
**Type**: impl
**Spec**: admin-tenant-status-limits — Scenario: Admin-route command stamps user actor (unchanged)
**WU**: WU-1, commit 4
**Depends on**: T-03

- In `apps/api/src/admin/admin.controller.ts`, update both `updateTenantStatus` and `updateTenantLimits` calls to pass `actor: { type: 'user', userId: request.user!.id }` instead of `actorUserId`
- `pnpm --filter @viewpro/api test` — full suite GREEN (includes existing admin e2e)

**Exit**: All existing tests GREEN; admin controller compiles.
**Commit**: `fix(api): pass {type:user} actor from AdminController after CommandActor widening`

---

### [x] T-05 — R1 LIVE-DB MIGRATION — additive schema changes (HIGHEST RISK)
**Type**: impl
**Spec**: platform-control-lane-inbound — Additive DB Schema; Operator Audit Attribution
**WU**: WU-1, commit 5
**Depends on**: T-04

**ORDER: deploy this migration BEFORE deploying app code that uses the new columns.**

- In `apps/api/prisma/schema.prisma`:
  - Add `PLATFORM_OPERATOR` to `enum AnalyticsActorType`
  - Add `actorOperatorId String?` to `model AnalyticsEvent` (no relation/FK — operator lives in another DB); add `@@index([actorOperatorId, occurredAt])`
  - Add new model `PlatformCommandLog`:
    ```
    model PlatformCommandLog {
      id             String   @id @default(uuid())
      idempotencyKey String   @unique
      tenantId       String
      commandType    String
      result         Json
      createdAt      DateTime @default(now())
      @@map("platform_command_log")
    }
    ```
- Run `pnpm --filter @viewpro/api exec prisma migrate dev --name add_platform_operator_actor_and_command_log` against test DB
- Commit the generated `apps/api/prisma/migrations/*/migration.sql`
- Run `pnpm --filter @viewpro/api exec prisma generate`

**Rollback**: `DROP TABLE platform_command_log; ALTER TABLE analytics_events DROP COLUMN "actorOperatorId"; remove PLATFORM_OPERATOR from enum (requires Prisma migration)`
**Exit**: `pnpm --filter @viewpro/api exec prisma validate` passes; `pnpm --filter @viewpro/api exec prisma migrate status` shows up-to-date.
**Commit**: `feat(api): R1 additive migration — actorOperatorId, PLATFORM_OPERATOR, platform_command_log`

---

### [x] T-06 — RED: migration additive-invariant test
**Type**: test (RED)
**Spec**: platform-control-lane-inbound — Scenario: Existing user-actor events are unaffected
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/api/src/platform-control/__tests__/migration-invariant.spec.ts`
  - After migration: existing `AnalyticsEvent` rows with `actorUserId` set still have their value; `actorOperatorId` is `null`
  - `AnalyticsActorType.PLATFORM_OPERATOR` exists as an enum value (Prisma DMMF check)
  - `PlatformCommandLog` model exists in Prisma DMMF

All RED until migration is applied and client generated.
**Exit**: test file exists; tests fail (expected — run in isolation before T-07).
**Commit**: `test(api): RED — migration additive invariant (existing rows unaffected, new fields present)`

---

### [x] T-07 — GREEN: confirm migration invariant test passes
**Type**: impl
**Spec**: platform-control-lane-inbound — Additive DB Schema
**WU**: WU-1, commit 7
**Depends on**: T-06

- Wire test environment to point at `viewpro_test` DB; run `pnpm --filter @viewpro/api test` — T-06 must go GREEN
- Confirm full admin suite still GREEN (T-02, T-04 regressions)

**Exit**: T-06 GREEN; full suite GREEN.
**Commit**: `test(api): GREEN — migration invariant confirmed on test DB`

---

## WU-2 — apps/api PlatformControlModule

### [ ] T-08 — RED: unit tests for `PlatformControlGuard`
**Type**: test (RED)
**Spec**: platform-control-lane-inbound — PlatformControlGuard, Trust Path Isolation (all scenarios)
**WU**: WU-2, commit 1
**Depends on**: T-07

- `apps/api/src/platform-control/__tests__/platform-control.guard.spec.ts` (vitest, forged JWTs)
  - **Missing token → 401**; `request.user` not set; `request.platformCaller` not set
  - **Expired token → 401** (past `exp`)
  - **Wrong secret → 401** (signed with different key)
  - **Wrong `aud` → 401** (user JWT lacking `aud=inmoview-control`)
  - **Valid token → passes**; `request.platformCaller = { kind:'service', callerId:operatorId, tokenId:jti }`; `request.user` not set
  - **Token confusion**: user JWT (no `aud`) sent to guard → 401

All RED until guard exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — PlatformControlGuard unit tests (all threat-matrix scenarios)`

---

### [ ] T-09 — GREEN: implement `service-token.verifier.ts` + `PlatformControlGuard`
**Type**: impl
**Spec**: platform-control-lane-inbound — PlatformControlGuard requirement
**WU**: WU-2, commit 2
**Depends on**: T-08

- `apps/api/src/platform-control/service-token.verifier.ts` — standalone `verifyServiceToken(token, secret)` using `@nestjs/jwt` `JwtService` (own instance, NOT the product's `JwtModule`; injected via `JwtModule.register({secret})` scoped to `PlatformControlModule`); validates `iss=viewpro-api`, `aud=inmoview-control`, `exp` (with 30s skew), returns `{ callerId, tokenId }`
- `apps/api/src/platform-control/platform-control.guard.ts` — `CanActivate`; extracts `Authorization: Bearer` header; calls verifier; sets `request.platformCaller`; never sets `request.user`; returns 401 on any failure
- Add `PLATFORM_CONTROL_SECRET` (required, `MinLength(16)`) to `apps/api/src/config/env.schema.ts`
- Confirm T-08 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-08 GREEN.
**Commit**: `feat(api): PlatformControlGuard + service-token verifier (HS256, own secret)`

---

### [ ] T-10 — RED: unit tests for `IdempotencyRepository`
**Type**: test (RED)
**Spec**: platform-control-lane-inbound — Idempotency Store (all scenarios)
**WU**: WU-2, commit 3
**Depends on**: T-07 (parallel with T-08)

- `apps/api/src/platform-control/__tests__/idempotency.repository.spec.ts` (vitest, mocked Prisma)
  - Insert new key → returns `{ found: false }`
  - Insert duplicate key → returns `{ found: true, result: <stored> }` (no second write)
  - Concurrent duplicate constraint → only one insert succeeds; other returns stored result

All RED until `IdempotencyRepository` exists.
**Exit**: test file exists; all assertions fail.
**Commit**: `test(api): RED — IdempotencyRepository unit tests (insert-first, duplicate short-circuit)`

---

### [ ] T-11 — GREEN: implement `IdempotencyRepository` + Prisma impl
**Type**: impl
**Spec**: platform-control-lane-inbound — Idempotency Store
**WU**: WU-2, commit 4
**Depends on**: T-10

- `apps/api/src/platform-control/idempotency.repository.ts` — interface `IIdempotencyRepository { insertOrFind(key, tenantId, commandType, result): Promise<{ found:boolean; result:Json }> }`
- `apps/api/src/platform-control/prisma-idempotency.repository.ts` — Prisma impl using `PlatformCommandLog`; `upsert`-style: try `create`; on unique violation, `findUnique` and return stored result
- Confirm T-10 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-10 GREEN.
**Commit**: `feat(api): PrismaIdempotencyRepository — insert-first with unique-conflict replay`

---

### [ ] T-12 — RED: integration tests for `PlatformControlController` (inbound)
**Type**: test (RED)
**Spec**: platform-control-lane-inbound — Internal Tenant Status Write, Internal Tenant Limits Write, Operator Audit Attribution, Idempotency Store (all integration scenarios)
**WU**: WU-2, commit 5
**Depends on**: T-09, T-11

- `apps/api/src/platform-control/__tests__/platform-control.controller.spec.ts` (supertest + test DB)
  - **Valid status command → 200, tenant SUSPENDED** (spec: Valid status command mutates tenant)
  - **Tenant not found → 404** (spec: Tenant not found)
  - **Invalid targetStatus → 400** (spec: Invalid target status)
  - **Valid limits command → 200, limits updated** (spec: Valid limits command)
  - **Duplicate idempotencyKey → 200 replay, tenant NOT mutated again** (spec: Duplicate key does not double-apply)
  - **Different key → applies normally** (spec: Different key applies)
  - **AnalyticsEvent has `actorOperatorId=op-1`, `actorType=PLATFORM_OPERATOR`, `actorUserId=null`** (spec: Audit event records operator actor)
  - **`actorUserId` null for control-lane events** (spec: actorUserId remains null)

All RED until controller + module exist.
**Exit**: test files exist; all assertions fail.
**Commit**: `test(api): RED — PlatformControlController integration tests (all inbound scenarios)`

---

### [ ] T-13 — GREEN: implement `PlatformControlController` + `PlatformControlModule`
**Type**: impl
**Spec**: platform-control-lane-inbound — Internal Tenant Status Write, Internal Tenant Limits Write
**WU**: WU-2, commit 6
**Depends on**: T-12

- `apps/api/src/platform-control/platform-control.controller.ts` — `@Controller('internal/platform')` with `@UseGuards(PlatformControlGuard)`:
  - `@Post('tenants/:tenantId/status')` — reads `SetTenantStatusCommand` + `idempotencyKey`; calls `IdempotencyRepository.insertOrFind`; on hit returns stored 200; on miss calls `AdminTenantStatusService.updateTenantStatus({ actor:{type:'operator',operatorId:platformCaller.callerId}, ... })`; stores result
  - `@Post('tenants/:tenantId/limits')` — same pattern for `SetTenantLimitsCommand`
- `apps/api/src/platform-control/platform-control.module.ts` — imports `JwtModule.register({ secret: PLATFORM_CONTROL_SECRET })` (own scoped instance), provides guard + verifier + controller + idempotency repo; imports `AdminModule` providers (or `AdminTenantStatusService`/`AdminTenantLimitsService` exported from `AdminModule`)
- Wire `PlatformControlModule` into `apps/api/src/app.module.ts`
- Confirm T-12 GREEN

**Exit**: `pnpm --filter @viewpro/api test` — T-12 GREEN; all prior tests GREEN.
**Commit**: `feat(api): PlatformControlModule — guard, idempotency, controller (inbound control lane)`

---

### [ ] T-14 — RED: trust-isolation integration tests
**Type**: test (RED)
**Spec**: platform-control-lane-inbound — Trust Path Isolation (both isolation scenarios)
**WU**: WU-2, commit 7
**Depends on**: T-13

- `apps/api/src/platform-control/__tests__/trust-isolation.spec.ts` (supertest + test DB)
  - **Service token rejected by `AuthGuard`**: POST to a product route (e.g. `/admin/access-check`) with only a valid service JWT → 401
  - **User JWT rejected by `PlatformControlGuard`**: POST to `/internal/platform/tenants/:id/status` with only a valid product user JWT → 401; `request.platformCaller` not populated

Both RED until asserted against live module wiring.
**Exit**: test files exist; both assertions fail.
**Commit**: `test(api): RED — trust-isolation: service token ≠ AuthGuard; user JWT ≠ PlatformControlGuard`

---

### [ ] T-15 — GREEN: confirm trust-isolation tests pass
**Type**: impl
**Spec**: platform-control-lane-inbound — Trust Path Isolation
**WU**: WU-2, commit 8
**Depends on**: T-14

- No code changes expected (isolation is structural); if any wiring gap is found, fix it
- `pnpm --filter @viewpro/api test` — T-14 GREEN; full suite GREEN

**Exit**: T-14 GREEN; full suite GREEN.
**Commit**: `test(api): GREEN — trust-isolation verified (cross-token confusion impossible)`

---

## WU-3 — viewpro-api Outbound + Hardening + Proxy

### [ ] T-16 — RED: unit tests for `PlatformControlClient` token minting
**Type**: test (RED)
**Spec**: platform-control-lane-outbound — Service Token Minting (both scenarios)
**WU**: WU-3, commit 1
**Depends on**: T-15

- `apps/viewpro-api/src/platform-control/__tests__/platform-control.client.spec.ts` (vitest)
  - **Token carries operator identity**: minted token decodes to `callerId=op-1`, signed with `PLATFORM_CONTROL_SECRET`
  - **Token uses distinct secret**: minted token verification fails with `ACCESS_TOKEN_SECRET` → verifyJwt throws

All RED until client exists.
**Exit**: test file exists; both assertions fail.
**Commit**: `test(platform-api): RED — PlatformControlClient token minting (identity + secret isolation)`

---

### [ ] T-17 — GREEN: implement `PlatformControlClient`
**Type**: impl
**Spec**: platform-control-lane-outbound — Service Token Minting, Operator Command requirements
**WU**: WU-3, commit 2
**Depends on**: T-16

- Add `INMOVIEW_API_INTERNAL_URL` (required `IsUrl`) and `PLATFORM_CONTROL_SECRET` (required `MinLength(16)`) to `apps/viewpro-api/src/config/env.schema.ts`
- Update `apps/viewpro-api/src/config/app.config.ts` to expose both values
- `apps/viewpro-api/src/platform-control/platform-control.client.ts`:
  - `mintServiceToken(operatorId): string` — HS256 JWT with `iss=viewpro-api`, `aud=inmoview-control`, `sub=operatorId`, `jti=uuid()`, `exp=now+120s`, signed with `PLATFORM_CONTROL_SECRET`
  - `postTenantStatus(tenantId, command, idempotencyKey, operatorId)` — `POST INMOVIEW_API_INTERNAL_URL/internal/platform/tenants/:id/status` with `Authorization: Bearer <jwt>`; never logs the JWT
  - `postTenantLimits(tenantId, command, idempotencyKey, operatorId)` — same for limits
- Confirm T-16 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-16 GREEN; env validation test GREEN.
**Commit**: `feat(platform-api): PlatformControlClient — mint HS256 service token + forward to InmoView`

---

### [ ] T-18 — RED: integration tests for viewpro-api operator endpoints
**Type**: test (RED)
**Spec**: platform-control-lane-outbound — Operator Endpoint Authentication, Operator Command Status, Operator Command Limits, Downstream failure (all scenarios)
**WU**: WU-3, commit 3
**Depends on**: T-17

- `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts` (supertest + mocked HTTP client or test DB)
  - **Valid operator session → forwards to InmoView, returns 200** (mock client returns 200)
  - **Missing session → 401** (no cookie)
  - **Expired/invalid session → 401**
  - **Downstream non-2xx → surfaced as 4xx/5xx** (mock client returns 404)
  - **Happy path limits → 200** (mock client returns 200)

All RED until controller + module exist.
**Exit**: test files exist; all assertions fail.
**Commit**: `test(platform-api): RED — operator endpoint integration tests (auth + forwarding + downstream error)`

---

### [ ] T-19 — GREEN: implement `PlatformControlController` (viewpro-api) + `PlatformControlModule`
**Type**: impl
**Spec**: platform-control-lane-outbound — Operator Command Status, Operator Command Limits
**WU**: WU-3, commit 4
**Depends on**: T-18

- `apps/viewpro-api/src/platform-control/platform-control.controller.ts`:
  - `@Post('operators/tenants/:tenantId/status')` with `@UseGuards(AuthGuard)` — generates `idempotencyKey=uuid()`; delegates to `PlatformControlClient.postTenantStatus`; relays response
  - `@Post('operators/tenants/:tenantId/limits')` — same for limits
- `apps/viewpro-api/src/platform-control/platform-control.module.ts` — imports `AuthModule`, `HttpModule`; provides client + controller
- Wire into `apps/viewpro-api/src/app.module.ts`
- Confirm T-18 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-18 GREEN; full suite GREEN.
**Commit**: `feat(platform-api): operator control-lane endpoints — forward status + limits to InmoView`

---

### [ ] T-20 — Auth hardening: throttler tracker + trust proxy + prod cookie
**Type**: impl
**Spec**: platform-control-lane-outbound — Auth Hardening — Login Throttler (both scenarios)
**WU**: WU-3, commit 5
**Depends on**: T-19

- `apps/viewpro-api/src/auth/guards/auth-throttler.guard.ts` — remove `email` from tracker key; return `[ip, path].join(':')` only (per-IP-only confirmed)
- `apps/viewpro-api/src/bootstrap/create-app.ts` — add `app.set('trust proxy', 1)` (single proxy; see deploy note); force cookie `secure:true` when `NODE_ENV==='production'` in `TokenService.setAccessCookie` (or pass `configService.get('app.cookieSecure')` overriding to `true` in prod)
- Unit test update: `apps/viewpro-api/src/auth/guards/__tests__/auth-throttler.guard.spec.ts` — assert tracker = `ip:path` only (no email segment); RED first, then GREEN in same commit

**Exit**: `pnpm --filter @viewpro/platform-api test` — throttler unit test GREEN; all tests GREEN.
**Commit**: `fix(platform-api): throttler per-IP-only + trust proxy + prod cookie secure=true`

---

### [ ] T-21 — Add `/admin` to `isProtectedAppPath` in proxy
**Type**: impl
**Spec**: app-new-proxy-hardening — /admin Server-Side Protection (both scenarios)
**WU**: WU-3, commit 6
**Depends on**: T-20

- `apps/app-new/src/proxy.ts` — add to `isProtectedAppPath`:
  `pathname === '/admin' || pathname.startsWith('/admin/')`
- Test: `apps/app-new/src/__tests__/proxy.spec.ts` (or extend existing) — assert `isProtectedAppPath('/admin')=true`, `isProtectedAppPath('/admin/tenants')=true`, `isProtectedAppPath('/dashboard')=true` (regression), `isProtectedAppPath('/public')=false` (regression); RED first, then GREEN in same commit

**Exit**: proxy unit test GREEN; `pnpm --filter next-shadcn-dashboard-starter test` passes.
**Commit**: `fix(app-new): guard /admin paths in isProtectedAppPath`

---

### [ ] T-22 — Final verification + invariant check
**Type**: verify
**Spec**: All invariants; proposal success criteria
**WU**: WU-3, commit 7
**Depends on**: T-21

1. `pnpm --filter @viewpro/api test` — all GREEN (admin e2e unchanged; platform-control suite GREEN)
2. `pnpm --filter @viewpro/platform-api test` — all GREEN
3. `pnpm --filter next-shadcn-dashboard-starter test` — all GREEN (proxy change)
4. `pnpm --filter @viewpro/api typecheck` — passes (including type-equality assertion)
5. `pnpm --filter @viewpro/platform-api typecheck` — passes
6. `rg 'request\.user' apps/api/src/platform-control/` — zero hits
7. `git diff HEAD -- apps/api/test/admin.e2e-spec.ts` — no test regressions
8. Confirm `platform_command_log` table exists in test DB schema
9. Leave deploy note comment in `apps/viewpro-api/src/bootstrap/create-app.ts`: `// trust proxy: 1 — adjust for your topology if using multiple proxies`

**Exit**: all 9 checks pass; no regressions; service-token isolation confirmed.
**Commit**: `chore(platform-phase5): final verification — control lane, isolation, invariants confirmed`

---

## Summary Table

| Task | Type | WU | Parallel group | Spec requirement | Depends on |
|------|------|-----|---------------|-----------------|------------|
| T-01 platform-contract dep + type assertion | impl | WU-1 | — | Proposal §Scope, admin status policy | — |
| T-02 RED: CommandActor unit tests | test | WU-1 | — | Dual-Actor Audit Attribution | T-01 |
| T-03 GREEN: widen actor union in services/repos | impl | WU-1 | — | Dual-Actor Audit Attribution | T-02 |
| T-04 AdminController passes {type:user} | impl | WU-1 | — | Admin-route unchanged (regression) | T-03 |
| T-05 R1 migration — schema + migrate | impl | WU-1 | — | Additive DB Schema; HIGHEST RISK | T-04 |
| T-06 RED: migration additive invariant | test | WU-1 | — | Additive DB Schema invariant | T-05 |
| T-07 GREEN: migration invariant test passes | impl | WU-1 | — | Additive DB Schema | T-06 |
| T-08 RED: PlatformControlGuard unit tests | test | WU-2 | A | Guard + Trust Isolation | T-07 |
| T-09 GREEN: service-token.verifier + Guard | impl | WU-2 | — | Guard requirement | T-08 |
| T-10 RED: IdempotencyRepository unit tests | test | WU-2 | A (parallel T-08) | Idempotency Store | T-07 |
| T-11 GREEN: PrismaIdempotencyRepository | impl | WU-2 | — | Idempotency Store | T-10 |
| T-12 RED: controller integration tests | test | WU-2 | — | Status/Limits/Audit/Idempotency | T-09, T-11 |
| T-13 GREEN: PlatformControlController + module | impl | WU-2 | — | Internal Status + Limits endpoints | T-12 |
| T-14 RED: trust-isolation integration tests | test | WU-2 | B | Trust Path Isolation | T-13 |
| T-15 GREEN: trust-isolation confirmed | impl | WU-2 | — | Trust Path Isolation | T-14 |
| T-16 RED: client token minting unit tests | test | WU-3 | B (parallel T-14) | Service Token Minting | T-15 |
| T-17 GREEN: PlatformControlClient | impl | WU-3 | — | Token Minting + outbound calls | T-16 |
| T-18 RED: operator endpoint integration tests | test | WU-3 | — | Operator Auth + Command scenarios | T-17 |
| T-19 GREEN: viewpro-api controller + module | impl | WU-3 | — | Operator Commands | T-18 |
| T-20 Auth hardening | impl | WU-3 | — | Throttler per-IP + trust proxy + cookie | T-19 |
| T-21 proxy.ts /admin guard | impl | WU-3 | — | /admin Server-Side Protection | T-20 |
| T-22 Final verification | verify | WU-3 | — | All invariants + success criteria | T-21 |

---

## Success Checklist (maps to spec acceptance)

- [ ] Operator calls `viewpro-api` (Phase 4 auth) → command reaches `POST /internal/platform/tenants/:id/{status,limits}` via valid service token (T-17, T-19)
- [ ] Tenant status/limits mutate on InmoView DB with existing `FOR UPDATE` transactional semantics (T-12, T-13)
- [ ] `AnalyticsEvent` records operator actor (`actorOperatorId` + `PLATFORM_OPERATOR`); `actorUserId` null (T-12, T-13)
- [ ] Duplicate `idempotencyKey` → 200 replay, no double-apply (T-12, T-13)
- [ ] Invalid/missing/expired service token → 401; `request.user` never set by `PlatformControlGuard` (T-08, T-09, T-14)
- [ ] User cookie token rejected by `PlatformControlGuard`; service token rejected by `AuthGuard` (T-14, T-15)
- [x] Existing `/admin` status + limits write routes remain functional (T-04 regression test)
- [x] `actorUserId` preserved on user-actor events (T-02, T-04)
- [x] Type-equality assertion `PlatformTenantStatus ↔ TenantStatus` is compile-time enforced (T-01)
- [ ] `/admin` guarded server-side by `proxy.ts` (T-21)
- [ ] viewpro-api prod cookie `secure=true`; throttler per-IP-only behind `trust proxy 1` (T-20)
- [x] R1 migration deployed before app code (operational sequencing; see T-05 note)
- [ ] `platform_command_log` TTL cleanup noted as deferred ops task (T-22)
