# Tasks: Platform A3 Slice 2 — Step-up Re-authentication for Destructive Operator Actions

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions D1–D13 (design.md) are LOCKED — do not reopen.

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| `@nestjs/jwt` per-call secret override (design open Q5) | **Confirmed, no blocker.** `@nestjs/jwt@11.0.2` (`viewpro-api`/`platform-api` package.json) ships `JwtSignOptions`/`JwtVerifyOptions` extending `jwt.SignOptions`/`VerifyOptions` with an explicit `secret?: string \| Buffer` field, and `JwtService.signAsync`/`verifyAsync` accept `options?: JwtSignOptions/JwtVerifyOptions` per call (`overrideSecretFromOptions` internal). `TokenService.signStepUpToken`/`verifyStepUpToken` can safely pass `{ secret: STEP_UP_TOKEN_SECRET, expiresIn: STEP_UP_TTL_SECONDS }` per call without a second `JwtModule` registration (D1) |
| `POST /auth/step-up` 200 body | `{ success: true }` — mirrors `logout()` exactly; FE needs nothing richer (D13 retry is fire-and-forget) |
| `StepUpDialog` copy | Spanish, matches sibling dialog conventions (`tenant-status-confirm-dialog.tsx` / `tenant-limits-dialog.tsx`) — e.g. `"Confirmá tu contraseña"` |
| `STEP_UP_TTL_SECONDS` `@Min` bound | `60` — mirrors `ACCESS_TOKEN_TTL_SECONDS` (`env.schema.ts`); default stays `300` |
| Status-target gating precision | Confirmed: `@StepUpStatusTargets(['SUSPENDED','CANCELLED'])` on the status route; `ACTIVE` exempt; `SetTenantStatusDto.@IsIn(['ACTIVE','SUSPENDED','CANCELLED'])` already rejects anything else with 400 pre-handler — no bypass surface (D5) |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850–1 050 (2 apps: 8 backend files modified + 4 created + 2 test-only files; 3 FE files modified + 2 created; ~14 spec files touched across both) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1, viewpro-api: endpoint + guard + config + cookie hygiene) → PR 2 (WU-2, viewpro-web: modal + gate hook + wiring), base = PR 1 branch |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Coupling note (proposal §6, design Migration/Rollout, R6):** backend enforcement and FE threading MUST ship together — a gap between PR 1 merging and PR 2 landing means every destructive action 403s with no prompt. Both PRs target `feat/platform-foundation` (undeployed); PR 2's base is PR 1's branch so they merge back-to-back.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | `viewpro-api`: `STEP_UP_TOKEN_SECRET`/TTL config, `TokenService` step-up methods, `StepUpUseCase` + `findById`, `POST /auth/step-up` + throttle, `StepUpGuard` + `@StepUpStatusTargets`, gate the 2 destructive routes, symmetric cookie-hygiene clear | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/platform-api test` | `supertest`: `POST /auth/step-up` correct pw → 200 + cookie; `PATCH /operators/tenants/:id/status {status:SUSPENDED}` without step-up → 403 `STEP_UP_REQUIRED`, mocked `PlatformControlClient` asserted uncalled | Remove the 2 method-level `@UseGuards(StepUpGuard)` applications (routes revert to `AuthGuard`-only); leave `/auth/step-up` inert or delete; drop `STEP_UP_TOKEN_SECRET`/`STEP_UP_TTL_SECONDS` env — stateless, no migration to reverse |
| WU-2 | `viewpro-web`: `ApiError.code` + `isStepUpRequiredError`, `session.stepUp()`, shared `StepUpDialog` + `useStepUpGate()`, wire into `tenants-management-page.tsx` mutations | PR 2 (base: PR 1 branch) | `pnpm --filter viewpro-web test` | RTL: trigger suspend on `TenantsManagementPage` (mocked `updateTenantStatus` rejecting with 403 `STEP_UP_REQUIRED`) → modal opens → submit correct password (mocked `stepUp` 200) → suspend mutation retried with same `variables` → list invalidated | Revert `tenants-management-page.tsx` mutation wiring; delete `step-up-dialog.tsx` + `use-step-up-gate.ts`; revert `api-client.ts` `code` field + `isStepUpRequiredError` — dead code, no persisted client state |

---

## Dependency Graph

```
T-00 (spike: confirm @nestjs/jwt per-call secret override — resolved above, no code)
  └── T-01 (RED: env.schema step-up config tests)
        └── T-02 (GREEN: STEP_UP_TOKEN_SECRET/TTL in env.schema.ts + app.config.ts + auth.constants.ts + setup-env.ts)
              └── T-03 (RED: TokenService step-up sign/verify/cookie tests — cross-secret isolation both directions)
                    └── T-04 (GREEN: TokenService signStepUpToken/verifyStepUpToken/setStepUpCookie/clearStepUpCookie)
                          └── T-05 (RED: dummy-hash extraction + StepUpUseCase + findById unit tests)
                                └── T-06 (GREEN: dummy-password-hash.ts + operator.repository.findById + step-up.dto.ts + StepUpUseCase)
                                      └── T-07 (RED: POST /auth/step-up integration tests — supertest)
                                            └── T-08 (GREEN: auth.controller.ts route + auth.module.ts wiring)
                                                  └── T-09 (RED: StepUpGuard unit tests — cookie/claim/sub/metadata)
                                                        └── T-10 (GREEN: step-up.guard.ts + @StepUpStatusTargets)
                                                              └── T-11 (RED: destructive-route integration tests — gated/exempt/reusable/expired/cross-operator/body-manipulation)
                                                                    └── T-12 (GREEN: wire StepUpGuard on the 2 platform-control routes + export from AuthModule)
                                                                          └── T-13 (RED: cookie-hygiene + guard-ordering tests — logout, AuthGuard-failure clear, 401-over-403)
                                                                                └── T-14 (GREEN: logout() + auth.guard.ts symmetric clear)
                                                                                      └── T-15 (RED: api-client code field + isStepUpRequiredError tests)
                                                                                            └── T-16 (GREEN: api-client.ts ApiError.code + isStepUpRequiredError)
                                                                                                  └── T-17 (RED: session.stepUp() test)
                                                                                                        └── T-18 (GREEN: session.ts stepUp())
                                                                                                              └── T-19 (RED: StepUpDialog component tests)
                                                                                                                    └── T-20 (GREEN: step-up-dialog.tsx)
                                                                                                                          └── T-21 (RED: useStepUpGate hook tests)
                                                                                                                                └── T-22 (GREEN: use-step-up-gate.ts)
                                                                                                                                      └── T-23 (RED: tenants-management-page wiring tests)
                                                                                                                                            └── T-24 (GREEN: wire useStepUpGate into both mutations + render StepUpDialog)
                                                                                                                                                  └── T-25 (Final verification — both apps)
```

---

## WU-1 — viewpro-api: endpoint + guard + config + cookie hygiene

### [x] T-00 — Spike: confirm `@nestjs/jwt` per-call `secret` override
**Type**: spike/verify
**Spec**: N/A (design-dependency gate)
**WU**: WU-1, pre-work (no commit — findings folded into T-01 commit message context)
**Depends on**: nothing

- Confirmed via `viewpro-app/node_modules/.pnpm/@nestjs+jwt@11.0.2*/node_modules/@nestjs/jwt/dist/interfaces/jwt-module-options.interface.d.ts`: `JwtSignOptions`/`JwtVerifyOptions` both declare `secret?: string | Buffer`, and `jwt.service.d.ts` shows `signAsync`/`verifyAsync` accept `options?: JwtSignOptions/JwtVerifyOptions`
- **Result: NOT a blocker.** `TokenService` step-up methods may pass `{ secret: STEP_UP_TOKEN_SECRET, expiresIn: STEP_UP_TTL_SECONDS }` per call against the single existing `JwtService` instance — no second `JwtModule.registerAsync` needed (D1 confirmed)

**Exit**: finding documented above; proceed with D1 as designed.

---

### [x] T-01 — RED: env schema step-up config tests
**Type**: test (RED)
**Spec**: operator-step-up-auth — Step-up Endpoint (TTL); AC10 (no migration/no contract change is unaffected by config)
**WU**: WU-1, commit 1
**Depends on**: T-00

- `apps/viewpro-api/src/config/__tests__/env.schema.spec.ts` — add to `VALID_BASE` a `STEP_UP_TOKEN_SECRET`; add assertions:
  - Missing `STEP_UP_TOKEN_SECRET` → `validateEnv` throws `/STEP_UP_TOKEN_SECRET/` (required, no default)
  - `STEP_UP_TOKEN_SECRET` shorter than 16 chars → throws `/STEP_UP_TOKEN_SECRET/`
  - `STEP_UP_TTL_SECONDS` omitted → defaults to `300`
  - `STEP_UP_TTL_SECONDS: 10` (below the 60 floor) → throws

All RED until T-02.
**Exit**: test file compiles; new assertions fail (schema not yet extended).
**Commit**: `test(platform-api): RED — STEP_UP_TOKEN_SECRET required + STEP_UP_TTL_SECONDS default/floor`

---

### [x] T-02 — GREEN: add `STEP_UP_TOKEN_SECRET`/`STEP_UP_TTL_SECONDS` config + cookie constant
**Type**: impl
**Spec**: operator-step-up-auth — Step-up Endpoint; Step-up Freshness (5-min window)
**WU**: WU-1, commit 2
**Depends on**: T-01

- `apps/viewpro-api/src/config/env.schema.ts`: add `@IsString() @MinLength(16) STEP_UP_TOKEN_SECRET!: string` (no default, fail-fast like `ACCESS_TOKEN_SECRET`) and `@IsInt() @Min(60) @Type(() => Number) STEP_UP_TTL_SECONDS = 300`
- `apps/viewpro-api/src/config/app.config.ts`: fail-fast throw if `STEP_UP_TOKEN_SECRET` missing (mirrors `accessTokenSecret`/`platformControlSecret` pattern); expose `auth.stepUpTokenSecret` + `auth.stepUpTtlSeconds`
- `apps/viewpro-api/src/auth/auth.constants.ts`: add `export const STEP_UP_TOKEN_COOKIE = 'viewpro_platform_stepup_token'` beside `ACCESS_TOKEN_COOKIE`
- `apps/viewpro-api/test/setup-env.ts`: add `process.env.STEP_UP_TOKEN_SECRET ??= 'test-step-up-token-secret-min16'`
- Confirm T-01 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-01 GREEN; all prior config tests GREEN.
**Commit**: `feat(platform-api): STEP_UP_TOKEN_SECRET/TTL config + STEP_UP_TOKEN_COOKIE constant (D2/D3)`

---

### [x] T-03 — RED: `TokenService` step-up sign/verify/cookie tests (D1–D3)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Step-up Endpoint (cookie shape); Cookie Hygiene; threat matrix — Token confusion
**WU**: WU-1, commit 3
**Depends on**: T-02

- Extend `apps/viewpro-api/src/auth/tokens/__tests__/token.service.spec.ts`:
  - `signStepUpToken({ sub })` returns a JWT with `stepUp: true` and `sub` claims
  - `verifyStepUpToken` on a token signed with `STEP_UP_TOKEN_SECRET` resolves the payload
  - Token signed with `ACCESS_TOKEN_SECRET` (access token) **fails** `verifyStepUpToken` (cross-verify direction 1 — threat matrix: token confusion)
  - Token signed with `STEP_UP_TOKEN_SECRET` **fails** `verifyAccessToken` (cross-verify direction 2)
  - `setStepUpCookie` uses exactly `STEP_UP_TOKEN_COOKIE`, `httpOnly: true`, `sameSite: 'lax'`, `maxAge = STEP_UP_TTL_SECONDS * 1000`
  - `clearStepUpCookie` calls `clearCookie(STEP_UP_TOKEN_COOKIE, ...)` with the same base options

All RED until T-04.
**Exit**: test file compiles; new assertions fail (methods don't exist yet).
**Commit**: `test(platform-api): RED — TokenService step-up sign/verify/cookie + cross-secret isolation (D1-D3)`

---

### [x] T-04 — GREEN: `TokenService` step-up sign/verify/cookie methods (D1–D3)
**Type**: impl
**Spec**: operator-step-up-auth — Step-up Endpoint; Cookie Hygiene
**WU**: WU-1, commit 4
**Depends on**: T-03

- `apps/viewpro-api/src/auth/tokens/token.service.ts`:
  - `export type StepUpTokenPayload = { sub: string; stepUp: true }`
  - `signStepUpToken({ sub }: { sub: string }): Promise<string>` → `jwtService.signAsync({ sub, stepUp: true }, { secret: this.configService.get('app.auth.stepUpTokenSecret'), expiresIn: this.configService.get('app.auth.stepUpTtlSeconds') })`
  - `verifyStepUpToken(token: string): Promise<StepUpTokenPayload>` → `jwtService.verifyAsync(token, { secret: this.configService.get('app.auth.stepUpTokenSecret') })`
  - `setStepUpCookie(response, token)` — reuses private `baseCookieOptions()`, `maxAge = stepUpTtlSeconds * 1000`
  - `clearStepUpCookie(response)` — `response.clearCookie(STEP_UP_TOKEN_COOKIE, this.baseCookieOptions())`
- Confirm T-03 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-03 GREEN; all prior TokenService tests GREEN.
**Commit**: `feat(platform-api): TokenService step-up sign/verify/setCookie/clearCookie (D1-D3)`

---

### [x] T-05 — RED: dummy-hash extraction + `StepUpUseCase` + `findById` unit tests (D7)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Step-up Endpoint (both scenarios); threat matrix — Brute force / enumeration
**WU**: WU-1, commit 5
**Depends on**: T-04

- Create `apps/viewpro-api/src/auth/use-cases/__tests__/step-up.use-case.spec.ts` (mocked repo + hasher + `TokenService`):
  - Correct password for the `sub`-resolved operator → returns a token via `tokenService.signStepUpToken({ sub })`
  - Wrong password → throws `UnauthorizedException`, `tokenService.signStepUpToken` NOT called
  - Operator not found (`findById` returns `null`) → dummy-hash constant-time verify still invoked, then `UnauthorizedException`
  - Operator found but `status !== 'ACTIVE'` → `UnauthorizedException`, even with correct password
- Extend `apps/viewpro-api/src/auth/use-cases/__tests__/login.use-case.spec.ts` (regression): still passes after `DUMMY_PASSWORD_HASH` moves to `security/dummy-password-hash.ts`

All RED until T-06.
**Exit**: new spec file compiles; assertions fail (`StepUpUseCase` doesn't exist; `findById` unimplemented).
**Commit**: `test(platform-api): RED — StepUpUseCase (pw verify, dummy-hash, ACTIVE check) + findById (D7)`

---

### [x] T-06 — GREEN: `security/dummy-password-hash.ts` + `IOperatorRepository.findById` + `step-up.dto.ts` + `StepUpUseCase` (D7)
**Type**: impl
**Spec**: operator-step-up-auth — Step-up Endpoint
**WU**: WU-1, commit 6
**Depends on**: T-05

- Create `apps/viewpro-api/src/auth/security/dummy-password-hash.ts` — export the existing argon2id `DUMMY_PASSWORD_HASH` constant (moved verbatim from `login.use-case.ts`)
- `apps/viewpro-api/src/auth/use-cases/login.use-case.ts` — import the extracted constant, delete the local one (no behavior change)
- `apps/viewpro-api/src/auth/repositories/operator.repository.ts` — add `findById(id: string): Promise<Operator | null>` to `IOperatorRepository`
- `apps/viewpro-api/src/auth/repositories/prisma-operator.repository.ts` — implement `findById` via `prisma.operator.findUnique({ where: { id } })`
- Create `apps/viewpro-api/src/auth/dto/step-up.dto.ts` — `class StepUpDto { @IsString() @MinLength(1) password!: string }`
- Create `apps/viewpro-api/src/auth/use-cases/step-up.use-case.ts` — `StepUpUseCase.execute(operatorId, password)`: `findById(operatorId)`, verify against `operator?.passwordHash ?? DUMMY_PASSWORD_HASH`, require `status === 'ACTIVE'`, on success `tokenService.signStepUpToken({ sub: operatorId })`
- Confirm T-05 GREEN; confirm `login.use-case.spec.ts` regression GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-05 GREEN; all prior auth tests GREEN.
**Commit**: `feat(platform-api): StepUpUseCase + findById + shared dummy-hash constant (D7)`

---

### [x] T-07 — RED: `POST /auth/step-up` integration tests (D6, D8)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Step-up Endpoint — Password Re-verification (all 3 scenarios)
**WU**: WU-1, commit 7
**Depends on**: T-06

- Create `apps/viewpro-api/src/auth/__tests__/step-up.controller.spec.ts` (supertest + test DB, mirrors `auth.controller.spec.ts` seeding pattern):
  - Signed-in operator, correct current password → `POST /api/auth/step-up` → 200 `{ success: true }` + `Set-Cookie` for `viewpro_platform_stepup_token` (httpOnly)
  - Signed-in operator, wrong password → 401, no `viewpro_platform_stepup_token` cookie in response
  - No `viewpro_platform_access_token` cookie → 401, no step-up cookie set
  - 6th rapid attempt from the same IP within the throttle window → 429 (D8, `AuthThrottlerGuard` reused)

All RED until T-08.
**Exit**: new spec file compiles; all assertions fail (route doesn't exist).
**Commit**: `test(platform-api): RED — POST /auth/step-up (correct/wrong pw, unauth, throttled) (D6/D8)`

---

### [x] T-08 — GREEN: `POST /auth/step-up` route + `auth.module.ts` wiring
**Type**: impl
**Spec**: operator-step-up-auth — Step-up Endpoint — Password Re-verification
**WU**: WU-1, commit 8
**Depends on**: T-07

- `apps/viewpro-api/src/auth/auth.controller.ts`: inject `StepUpUseCase`; add `@Post('step-up') @HttpCode(200) @UseGuards(AuthGuard, AuthThrottlerGuard) stepUp(@Body() dto: StepUpDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response)` → `const token = await this.stepUpUseCase.execute(req.user!.id, dto.password); this.tokenService.setStepUpCookie(response, token); return { success: true }`
- `apps/viewpro-api/src/auth/auth.module.ts`: add `StepUpUseCase` to providers
- Confirm T-07 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-07 GREEN; all prior auth tests GREEN.
**Commit**: `feat(platform-api): POST /auth/step-up route + auth.module.ts wiring`

---

### [x] T-09 — RED: `StepUpGuard` unit tests (D4–D6)
**Type**: test (RED)
**Spec**: operator-step-up-auth — StepUpGuard Gates Destructive Tenant Routes; Reactivate Is Exempt; Cross-Operator Step-up Rejection
**WU**: WU-1, commit 9
**Depends on**: T-08

- Create `apps/viewpro-api/src/auth/guards/__tests__/step-up.guard.spec.ts` (mocked `ExecutionContext`, mocked `TokenService`, mocked `Reflector`):
  - No step-up cookie → `ForbiddenException` with body `{ statusCode: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' }`
  - Expired/forged step-up cookie (verify rejects) → same 403 shape
  - Valid step-up cookie but `payload.sub !== request.user.id` → 403 `STEP_UP_REQUIRED` (AC5)
  - `@StepUpStatusTargets(['SUSPENDED','CANCELLED'])` metadata present + `request.body.status === 'ACTIVE'` → `canActivate` returns `true` without checking the cookie (AC6, reactivate exempt)
  - Same metadata + `request.body.status === 'SUSPENDED'` (or `'CANCELLED'`) → cookie check required
  - No metadata (limits route) → cookie check always required, regardless of body

All RED until T-10.
**Exit**: new spec file compiles; assertions fail (`StepUpGuard` doesn't exist).
**Commit**: `test(platform-api): RED — StepUpGuard (cookie/claim/sub/metadata) (D4-D6)`

---

### [x] T-10 — GREEN: `step-up.guard.ts` + `@StepUpStatusTargets` decorator (D4–D6)
**Type**: impl
**Spec**: operator-step-up-auth — StepUpGuard Gates Destructive Tenant Routes; Reactivate Is Exempt; Cross-Operator Step-up Rejection
**WU**: WU-1, commit 10
**Depends on**: T-09

- Create `apps/viewpro-api/src/auth/guards/step-up.guard.ts`:
  - `export const STEP_UP_STATUS_TARGETS_KEY = 'stepUpStatusTargets'`
  - `export const StepUpStatusTargets = (targets: string[]) => SetMetadata(STEP_UP_STATUS_TARGETS_KEY, targets)`
  - `@Injectable() class StepUpGuard implements CanActivate`: reads metadata via `Reflector`; if metadata present and `request.body?.status` not in it → `return true`; else read `STEP_UP_TOKEN_COOKIE`, `verifyStepUpToken`, check `payload.stepUp === true && payload.sub === request.user!.id`; on any failure throw `new ForbiddenException({ statusCode: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' })`
- Confirm T-09 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-09 GREEN.
**Commit**: `feat(platform-api): StepUpGuard + @StepUpStatusTargets decorator (D4-D6)`

---

### [x] T-11 — RED: destructive-route integration tests — gated/exempt/reusable/expired/cross-operator/body-manipulation (AC2–AC6, threat matrix)
**Type**: test (RED)
**Spec**: operator-step-up-auth — StepUpGuard Gates Destructive Tenant Routes (all 5 scenarios); Reactivate Is Exempt; Step-up Freshness (both scenarios); Cross-Operator Step-up Rejection
**WU**: WU-1, commit 11
**Depends on**: T-10

- Extend `apps/viewpro-api/src/platform-control/__tests__/platform-control.controller.spec.ts` (reuses the mocked `PlatformControlClient` pattern):
  - `PATCH .../status {status:SUSPENDED}` without step-up cookie → 403 `STEP_UP_REQUIRED`; `mockClient.postTenantStatus` NOT called (AC2)
  - `PATCH .../status {status:CANCELLED}` without step-up → 403 `STEP_UP_REQUIRED`; not called
  - `PATCH .../limits` without step-up → 403 `STEP_UP_REQUIRED`; `mockClient.postTenantLimits` NOT called
  - `PATCH .../status {status:SUSPENDED}` WITH a fresh step-up cookie (`sub` matching) → 200, `mockClient.postTenantStatus` called once (AC3)
  - `PATCH .../limits` WITH a fresh step-up cookie → 200, `mockClient.postTenantLimits` called once
  - `PATCH .../status {status:ACTIVE}` with NO step-up cookie → 200 (reactivate exempt, AC6)
  - One `POST /auth/step-up`, then `PATCH .../limits` followed by `PATCH .../status {status:SUSPENDED}` within the window → both 200, no second `/auth/step-up` call (AC4 reusable — use vitest fake timers to advance <5min)
  - Step-up cookie issued, fake-timers advance past `STEP_UP_TTL_SECONDS` → `PATCH .../status {status:CANCELLED}` → 403 `STEP_UP_REQUIRED` (AC4 expiry)
  - Operator A's step-up cookie sent alongside operator B's access cookie → 403 `STEP_UP_REQUIRED`; no mutation (AC5)
  - `PATCH .../status {status:'GARBAGE'}` → 400 from `SetTenantStatusDto` validation, never reaches `StepUpGuard`/handler (threat matrix — body-manipulation bypass)

All RED until T-12.
**Exit**: new assertions fail; existing platform-control assertions unchanged.
**Commit**: `test(platform-api): RED — destructive routes gated by StepUpGuard (AC2-AC6, threat matrix)`

---

### [x] T-12 — GREEN: wire `StepUpGuard` on the 2 destructive routes + export from `AuthModule`
**Type**: impl
**Spec**: operator-step-up-auth — StepUpGuard Gates Destructive Tenant Routes; Reactivate Is Exempt
**WU**: WU-1, commit 12
**Depends on**: T-11

- `apps/viewpro-api/src/auth/auth.module.ts`: add `StepUpGuard` to providers; add `StepUpGuard` to `exports` (alongside `AuthGuard`, `TokenService`)
- `apps/viewpro-api/src/platform-control/platform-control.controller.ts`:
  - `updateTenantStatus`: add `@UseGuards(StepUpGuard) @StepUpStatusTargets(['SUSPENDED', 'CANCELLED'])`
  - `updateTenantLimits`: add `@UseGuards(StepUpGuard)` (no metadata — unconditional, D5)
- Confirm T-11 GREEN; confirm class-level `@UseGuards(AuthGuard)` still present and unchanged (D4 ordering)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-11 GREEN; full platform-control suite GREEN.
**Commit**: `feat(platform-api): gate PATCH status(SUSPENDED/CANCELLED)+limits with StepUpGuard (D4-D6)`

---

### [x] T-13 — RED: cookie-hygiene + guard-ordering tests (AC7, threat matrix — stale cookie, StepUpGuard-never-bypasses)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Cookie Hygiene — Symmetric Clear on Logout and Auth Failure (both scenarios); StepUpGuard Never Bypasses AuthGuard
**WU**: WU-1, commit 13
**Depends on**: T-12

- `apps/viewpro-api/src/auth/__tests__/auth.controller.spec.ts` — add: `POST /api/auth/logout` after a valid step-up cookie was set → response `Set-Cookie` headers clear BOTH `viewpro_platform_access_token` AND `viewpro_platform_stepup_token`
- `apps/viewpro-api/src/auth/guards/__tests__/auth.guard.spec.ts` (new file, mocked `ExecutionContext`+`Response`): `AuthGuard.canActivate` on missing/invalid access token → calls `response.clearCookie` for BOTH cookie names via `context.switchToHttp().getResponse()`, THEN throws `UnauthorizedException`
- Extend `platform-control.controller.spec.ts`: no access cookie present, but a valid unexpired step-up cookie IS present → `PATCH .../status {status:SUSPENDED}` → 401 (NOT the `STEP_UP_REQUIRED` 403 shape) — AuthGuard's 401 wins (D4 class-before-method ordering)

All RED until T-14.
**Exit**: new assertions fail (guard doesn't clear the step-up cookie yet).
**Commit**: `test(platform-api): RED — logout/AuthGuard-failure clear both cookies; 401-over-403 ordering (AC7)`

---

### [x] T-14 — GREEN: symmetric cookie clear on `logout()` and `AuthGuard` failure (D9)
**Type**: impl
**Spec**: operator-step-up-auth — Cookie Hygiene — Symmetric Clear on Logout and Auth Failure
**WU**: WU-1, commit 14
**Depends on**: T-13

- `apps/viewpro-api/src/auth/auth.controller.ts`: `logout()` calls `tokenService.clearAccessCookie(response)` AND `tokenService.clearStepUpCookie(response)`
- `apps/viewpro-api/src/auth/guards/auth.guard.ts`: in both failure branches (missing token, verify throws), before throwing `UnauthorizedException`, call `const response = context.switchToHttp().getResponse(); this.tokenService.clearAccessCookie(response); this.tokenService.clearStepUpCookie(response)`
- Confirm T-13 GREEN; confirm full `apps/viewpro-api` suite GREEN (regression) — this closes WU-1

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-13 GREEN; all WU-1 tests GREEN; `pnpm --filter @viewpro/platform-api typecheck` passes.
**Commit**: `feat(platform-api): symmetric cookie clear — logout + AuthGuard failure (D9, AC7)`

---

## WU-2 — viewpro-web: api-client + modal + gate hook + wiring

### [x] T-15 — RED: `api-client.ts` `code` field + `isStepUpRequiredError` tests (D12)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions (403 re-opens modal, precondition)
**WU**: WU-2, commit 1
**Depends on**: T-14

- Create `apps/viewpro-web/src/lib/__tests__/api-client.spec.ts` (or extend if one exists) — vitest:
  - `toApiError` on a response body `{ statusCode: 403, code: 'STEP_UP_REQUIRED', message: '...' }` produces an `ApiError` with `code === 'STEP_UP_REQUIRED'`
  - `isStepUpRequiredError(error)` → `true` for `{ status: 403, code: 'STEP_UP_REQUIRED' }`
  - `isStepUpRequiredError(error)` → `false` for a plain `{ status: 403 }` (no code)
  - `isStepUpRequiredError(error)` → `false` for `{ status: 401, code: 'STEP_UP_REQUIRED' }` (status must also be 403)
  - `isStepUpRequiredError(error)` → `false` for non-`ApiError` values

All RED until T-16.
**Exit**: test file compiles; assertions fail (`code`/`isStepUpRequiredError` don't exist).
**Commit**: `test(web): RED — ApiError.code + isStepUpRequiredError (D12)`

---

### [x] T-16 — GREEN: `ApiError.code` + `isStepUpRequiredError` (D12)
**Type**: impl
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 2
**Depends on**: T-15

- `apps/viewpro-web/src/lib/api-client.ts`:
  - Add `code?: string` to `ApiError` and `code?: string` to `ErrorResponseBody`
  - `toApiError` copies `parsedBody?.code` into the returned `ApiError.code`
  - Widen `isErrorResponseBody`'s valid-shape check to accept an optional string `code`
  - `export function isStepUpRequiredError(error: unknown): error is ApiError { return isApiError(error) && error.status === 403 && (error as ApiError).code === 'STEP_UP_REQUIRED' }`
- Confirm T-15 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-15 GREEN; all prior api-client tests GREEN.
**Commit**: `feat(web): ApiError.code + isStepUpRequiredError (D12)`

---

### [x] T-17 — RED: `session.stepUp(password)` test
**Type**: test (RED)
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 3
**Depends on**: T-16

- Extend `apps/viewpro-web/src/lib/__tests__/session.spec.ts` (or create, mirroring `login`/`logout` test coverage if present): `stepUp('secret')` calls `apiRequest('/auth/step-up', { body: { password: 'secret' }, method: 'POST' })` and resolves the response

All RED until T-18.
**Exit**: assertion fails (`stepUp` doesn't exist).
**Commit**: `test(web): RED — session.stepUp(password)`

---

### [x] T-18 — GREEN: `session.ts` `stepUp()`
**Type**: impl
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 4
**Depends on**: T-17

- `apps/viewpro-web/src/lib/session.ts`: add `export function stepUp(password: string): Promise<{ success: true }> { return apiRequest('/auth/step-up', { body: { password }, method: 'POST' }) }`
- Confirm T-17 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-17 GREEN.
**Commit**: `feat(web): session.stepUp(password) (sibling of login/logout)`

---

### [x] T-19 — RED: `StepUpDialog` component tests (D11)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions (wrong-password scenario)
**WU**: WU-2, commit 5
**Depends on**: T-18

- Create `apps/viewpro-web/src/features/auth/components/step-up-dialog.test.ts` (RTL, mirrors `sign-in-view.test.ts` conventions):
  - Renders a password field and submit button when `open`
  - Submitting calls `onSubmit(password)` with the entered value
  - `isVerifying: true` disables the submit button and gates Escape-to-close
  - Passing an `error` prop renders it inline (no toast, modal stays open)

All RED until T-20.
**Exit**: new test file compiles; assertions fail (component doesn't exist).
**Commit**: `test(web): RED — StepUpDialog (submit, pending state, inline error) (D11)`

---

### [x] T-20 — GREEN: `step-up-dialog.tsx` (D11)
**Type**: impl
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 6
**Depends on**: T-19

- Create `apps/viewpro-web/src/features/auth/components/step-up-dialog.tsx`: shared `Dialog` (Radix, matches `tenant-status-confirm-dialog.tsx` styling) with a password `Input`, submit button (`isVerifying` → disabled + spinner), inline error text, Escape gated while `isVerifying`. Props: `{ open, onSubmit(password), isVerifying, error }`. Spanish copy per Resolved Design Residuals.
- Confirm T-19 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-19 GREEN.
**Commit**: `feat(web): StepUpDialog — shared password re-entry modal (D11)`

---

### [x] T-21 — RED: `useStepUpGate()` hook tests (D11, D13)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions (all 5 scenarios)
**WU**: WU-2, commit 7
**Depends on**: T-20

- Create `apps/viewpro-web/src/features/auth/hooks/use-step-up-gate.test.ts` (RTL `renderHook`):
  - `handleStepUpError(error, retry)` with an `isStepUpRequiredError` error → returns `true`, `dialogProps.open` becomes `true`
  - `handleStepUpError(error, retry)` with a non-step-up error → returns `false`, dialog stays closed
  - Submitting the correct password (`stepUp` mocked resolved) → dialog closes, the stashed `retry` is invoked exactly once
  - Submitting a wrong password (`stepUp` mocked rejected 401) → dialog stays open, `dialogProps.error` is set, `retry` is NOT invoked, no logout side-effect triggered
  - A second `handleStepUpError` call while the dialog is already open re-stashes the new `retry` (latest wins)

All RED until T-22.
**Exit**: new test file compiles; assertions fail (hook doesn't exist).
**Commit**: `test(web): RED — useStepUpGate (stash/retry, success/failure, no logout) (D11/D13)`

---

### [x] T-22 — GREEN: `use-step-up-gate.ts` (D11, D13)
**Type**: impl
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 8
**Depends on**: T-21

- Create `apps/viewpro-web/src/features/auth/hooks/use-step-up-gate.ts`: `useStepUpGate()` holds `{ isOpen, isVerifying, error, pendingRetry }` state; `handleStepUpError(error, retry)` — if `isStepUpRequiredError(error)`, stash `retry`, open dialog, return `true`; else return `false`; `onSubmit(password)` → `stepUp(password)` → success: close + invoke stashed retry + clear error; failure (401): keep open, set inline error, no logout. Returns `{ dialogProps: { open, onSubmit, isVerifying, error }, handleStepUpError }`
- Confirm T-21 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-21 GREEN.
**Commit**: `feat(web): useStepUpGate — stash/retry on STEP_UP_REQUIRED (D11/D13)`

---

### [x] T-23 — RED: `tenants-management-page.tsx` step-up wiring tests (AC8, all 5 FE scenarios)
**Type**: test (RED)
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions (all 5 scenarios)
**WU**: WU-2, commit 9
**Depends on**: T-22

- Extend the existing `tenants-management-page` RTL suite (mock `updateTenantStatus`/`updateTenantLimits`/`stepUp` from the service/session modules):
  - First suspend attempt: `updateTenantStatus` rejects with `{status:403, code:'STEP_UP_REQUIRED'}` → `StepUpDialog` opens, `TenantStatusConfirmDialog` stays open, no error toast, no `setPendingStatusAction(null)` (AC8 scenario 1)
  - Submitting the correct password in the modal → `stepUp` resolves 200 → the ORIGINAL suspend mutation is retried with the same `{ tenantId, status }` variables → on success, list invalidates + confirm dialog + step-up dialog both close (scenario 2)
  - Wrong password in the modal → inline error shown, no mutation performed, modal stays open (scenario 3)
  - A destructive mutation that resolves normally (no 403) — e.g. within the reuse window — never opens the modal (scenario 4, simulated by mocking success on first call)
  - A `403 STEP_UP_REQUIRED` on `updateTenantLimits` also opens the shared modal — no logout, no redirect (scenario 5, cross-mutation reuse of the same gate)

All RED until T-24.
**Exit**: existing suite compiles; new assertions fail (mutations don't check `isStepUpRequiredError` yet).
**Commit**: `test(web): RED — tenants-management-page step-up wiring for suspend/cancel/limits (AC8)`

---

### [x] T-24 — GREEN: wire `useStepUpGate` into both mutations + render `StepUpDialog` (D13)
**Type**: impl
**Spec**: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
**WU**: WU-2, commit 10
**Depends on**: T-23

- `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx`:
  - Instantiate `const stepUpGate = useStepUpGate()`
  - `statusMutation.onError`: check `stepUpGate.handleStepUpError(error, () => statusMutation.mutate(variables))` FIRST — if it returns `true`, `return` immediately (do NOT clear `pendingStatusAction`, do NOT call `reportMutationError`); otherwise fall through to existing `setPendingStatusAction(null)` + 400/other handling
  - `limitsMutation.onError`: same pattern — check `stepUpGate.handleStepUpError` first, `return` if consumed; else fall through to `reportMutationError`
  - Render `<StepUpDialog {...stepUpGate.dialogProps} />` alongside the existing confirm/limits dialogs
- Confirm T-23 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-23 GREEN; all prior `tenants-management-page` tests GREEN (regression).
**Commit**: `feat(web): wire useStepUpGate into status/limits mutations onError (D13)`

---

## T-25 — Final verification (both apps)

**Type**: verify
**Spec**: All invariants; proposal acceptance criteria 1–10
**WU**: closes WU-1 + WU-2
**Depends on**: T-24

**Security regression scenarios (all MUST be green from prior tasks):**
1. Destructive route without step-up → 403 `STEP_UP_REQUIRED`, no mutation/outbox/service-token call (T-11)
2. Reactivate `SUSPENDED`→`ACTIVE` needs NO step-up (T-11)
3. Step-up cookie cannot pass `AuthGuard` (distinct secret); access cookie cannot pass `StepUpGuard` (T-03)
4. Cross-operator `sub` mismatch → 403 (T-11)
5. `StepUpGuard` never turns a 401 into a 403 — `AuthGuard`-first ordering (T-13)
6. Logout clears BOTH cookies (T-13/T-14)
7. Wrong password on `POST /auth/step-up` → 401, no cookie (T-07)
8. Expired step-up → 403 re-prompt (T-11)

**Final verification checklist**:
1. `pnpm --filter @viewpro/platform-api test` — all GREEN (auth + platform-control suites)
2. `pnpm --filter @viewpro/platform-api typecheck` — passes
3. `pnpm --filter viewpro-web test` — all GREEN
4. `pnpm --filter viewpro-web typecheck` — passes
5. `pnpm --filter viewpro-web build` — succeeds (no runtime import errors from new `features/auth/` files)
6. `git diff HEAD -- viewpro-app/apps/viewpro-api/prisma/` — empty (no migration, AC10)
7. `git diff HEAD -- packages/platform-contract/` — empty (no contract change, AC10)
8. `git diff HEAD -- viewpro-app/apps/api/` — empty (legacy `/admin` lane untouched, AC9)
9. Destructive-action E2E (manual or supertest, dev DB): `POST /auth/step-up` → suspend → cancel → change-limits all succeed within one 5-min window with a single password entry; without step-up, all three 403 `STEP_UP_REQUIRED`
10. Confirm `.env.example` / deploy docs updated with `STEP_UP_TOKEN_SECRET` requirement (Migration/Rollout note)

**Exit**: all 8 security scenarios + 10 checklist items pass; no regressions in existing auth/platform-control/tenants suites.
**Commit**: `chore(platform-step-up-reauth): final verification — both apps green, no migration/contract diff`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-00 spike: @nestjs/jwt per-call secret | spike | WU-1 | Design dependency gate | — |
| T-01 RED: env schema step-up tests | test | WU-1 | Step-up Endpoint (TTL) | T-00 |
| T-02 GREEN: env/config/constants | impl | WU-1 | Step-up Endpoint | T-01 |
| T-03 RED: TokenService step-up tests | test | WU-1 | Step-up Endpoint; token confusion | T-02 |
| T-04 GREEN: TokenService step-up methods | impl | WU-1 | D1-D3 | T-03 |
| T-05 RED: StepUpUseCase + findById tests | test | WU-1 | Step-up Endpoint (both scenarios) | T-04 |
| T-06 GREEN: dummy-hash + findById + StepUpUseCase | impl | WU-1 | D7 | T-05 |
| T-07 RED: POST /auth/step-up integration | test | WU-1 | Step-up Endpoint (all 3 scenarios) | T-06 |
| T-08 GREEN: auth.controller route + module wiring | impl | WU-1 | D6/D8 | T-07 |
| T-09 RED: StepUpGuard unit tests | test | WU-1 | StepUpGuard Gates Destructive Routes; Cross-Operator | T-08 |
| T-10 GREEN: step-up.guard.ts + decorator | impl | WU-1 | D4-D6 | T-09 |
| T-11 RED: destructive-route integration tests | test | WU-1 | AC2-AC6, threat matrix | T-10 |
| T-12 GREEN: wire StepUpGuard on 2 routes | impl | WU-1 | D4-D6 | T-11 |
| T-13 RED: cookie-hygiene + ordering tests | test | WU-1 | Cookie Hygiene; StepUpGuard Never Bypasses AuthGuard | T-12 |
| T-14 GREEN: symmetric cookie clear | impl | WU-1 | D9, AC7 | T-13 |
| T-15 RED: api-client code field tests | test | WU-2 | FE Step-up Prompt (precondition) | T-14 |
| T-16 GREEN: ApiError.code + isStepUpRequiredError | impl | WU-2 | D12 | T-15 |
| T-17 RED: session.stepUp test | test | WU-2 | FE Step-up Prompt | T-16 |
| T-18 GREEN: session.stepUp() | impl | WU-2 | — | T-17 |
| T-19 RED: StepUpDialog component tests | test | WU-2 | FE Step-up Prompt | T-18 |
| T-20 GREEN: step-up-dialog.tsx | impl | WU-2 | D11 | T-19 |
| T-21 RED: useStepUpGate hook tests | test | WU-2 | FE Step-up Prompt (all 5 scenarios) | T-20 |
| T-22 GREEN: use-step-up-gate.ts | impl | WU-2 | D11/D13 | T-21 |
| T-23 RED: tenants-management-page wiring tests | test | WU-2 | AC8, all 5 FE scenarios | T-22 |
| T-24 GREEN: wire mutations + render StepUpDialog | impl | WU-2 | D13 | T-23 |
| T-25 Final verification | verify | both | All invariants + AC1-10 | T-24 |

---

## Success Checklist (maps to spec acceptance criteria)

- [x] Correct password → `POST /auth/step-up` 200 + step-up cookie (httpOnly, `stepUp:true`, `sub`, ~5min exp) (T-07, T-08)
- [x] Wrong password → 401, no cookie set; unauthenticated → 401 before password check (T-07, T-08)
- [x] Destructive route (status SUSPENDED/CANCELLED, limits) without step-up → 403 `STEP_UP_REQUIRED`, no mutation, no InmoView call, no outbox event (T-11, T-12)
- [x] Same routes WITH fresh step-up → 200, existing behavior (terminality, audit, outbox) unaffected (T-11, T-12)
- [x] Reactivate (→ACTIVE) succeeds with NO step-up (T-11, T-12)
- [x] Step-up cookie reusable across multiple destructive actions within 5 min; rejected after expiry (T-11)
- [x] Cross-operator step-up rejected — `sub` bound to `request.user.id` (T-09, T-11)
- [x] `logout()` and `AuthGuard`-failure clear BOTH cookies symmetrically (T-13, T-14)
- [x] `StepUpGuard` never bypasses `AuthGuard` — unauthenticated + present step-up cookie → 401, not 403 (T-13, T-14)
- [x] FE prompts for password before a destructive action unless a fresh step-up is server-confirmed valid; threads through status/limits mutations (T-19–T-24)
- [x] `403 STEP_UP_REQUIRED` mid-session re-opens the modal — never logs out, never redirects to sign-in (T-21, T-22, T-23)
- [ ] Operator-lane only — legacy `/admin` lane and its DTOs unchanged (T-25 checklist item 8)
- [ ] No schema migration, no `platform-contract` change (T-25 checklist items 6–7)
