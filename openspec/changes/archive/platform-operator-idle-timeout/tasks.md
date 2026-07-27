# Tasks: Platform A3 Slice 2 — Shorter Idle-Timeout for the Operator Session

> Strict TDD: RED precedes every GREEN. All source paths are under `viewpro-app/`.
> Decisions D1–D9 (design.md) are LOCKED — do not reopen.

---

## Resolved Design Residuals (inline, tasks phase)

| Question | Decision |
|----------|----------|
| `@nestjs/jwt` per-call `clockTolerance` forwarding (design open Q3) | **Confirmed, no blocker.** `@nestjs/jwt@11.0.2` (`viewpro-api`/`platform-api`): `JwtVerifyOptions` extends `jwt.VerifyOptions` (`@types/jsonwebtoken@9.0.10`, which declares `clockTolerance?: number`). Compiled `dist/jwt.service.js` `mergeJwtOptions` only strips `secret`/`publicKey`/`privateKey` from the merged per-call options before calling `jwt.verify(token, secret, verifyOptions, cb)` — `clockTolerance` passed per call survives unmodified and reaches jsonwebtoken as-is. `verifyAccessToken(token, { clockTolerance: CLOCK_TOLERANCE_SECONDS })` works exactly as D6 designed; the manual-tolerance-in-guard fallback is **not needed** |
| `IDLE_TIMEOUT_SECONDS`/`ABSOLUTE_SESSION_SECONDS` required vs. defaulted | Design D4 assigns explicit numeric defaults (`= 600`, `= 28800`) with `@Min` floors, mirroring the existing `STEP_UP_TTL_SECONDS = 300` pattern (defaulted, boot-validated) — **not** a no-default fail-fast field like `ACCESS_TOKEN_SECRET`/`STEP_UP_TOKEN_SECRET`. Both vars are boot-validated (invalid value fails startup) but have safe defaults, so no new required secret ships |
| `auth-idle-timeout.spec.ts` harness | Full `AuthModule` via `Test.createTestingModule`, mirroring `auth-me.controller.spec.ts` (seeded operator, real login, `supertest`) — reuses the DB-seed pattern already proven for cookie-shape assertions; a minimal guard-only harness would miss the real `JwtModule`/`ConfigService` wiring this change touches |

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~590–650 (viewpro-api: ~9 files, ~390 lines incl. new `auth-idle-timeout.spec.ts`; viewpro-web: ~5 files, ~215 lines incl. `auth.md` rewrite) |
| 400-line budget risk | Medium (WU-1 alone is ~380–400, near the cap; WU-2 ~215; neither PR is dramatically oversized once split) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (WU-1, viewpro-api: config + claim + TokenService + AuthGuard + module wiring) → PR 2 (WU-2, viewpro-web: 401 interceptor + sign-in copy + doc), base = PR 1 branch |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

**Deploy-coupling note (proposal §6, R2):** once WU-1 ships, access tokens start sliding on the new 600s/28800s windows and unattended sessions begin expiring mid-action — WU-2's global 401 handling turns that into one clean redirect instead of scattered raw errors on every console feature. WU-2 must land promptly after WU-1. Both target `feat/platform-foundation`; PR 2's base is PR 1's branch so they merge back-to-back.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| WU-1 | `viewpro-api`: `IDLE_TIMEOUT_SECONDS`/`ABSOLUTE_SESSION_SECONDS` config + window-order boot guard, `sessionExp` claim, `TokenService.reissueAccessToken`, `AuthGuard` dual-deadline reject + threshold re-issue, `JwtModule` per-call `expiresIn` | PR 1 (base: `feat/platform-foundation`) | `pnpm --filter @viewpro/platform-api test` | `supertest`: idle-expired token → 401; valid sliding exp + past `sessionExp` → 401; `iat` past threshold + valid → 200 + fresh access `Set-Cookie` with same `sessionExp`; step-up cookie untouched by re-issue | Revert `auth.guard.ts` to verify-only (no `sessionExp` checks, no re-issue); restore `signOptions.expiresIn` + `ACCESS_TOKEN_TTL_SECONDS` on `JwtModule`/env.schema; drop the two new env vars and `auth.constants.ts` additions — stateless, no migration to reverse |
| WU-2 | `viewpro-web`: `apiRequest` 401 interceptor + `SESSION_EXEMPT_401_PATHS`, `sign-in-view` `reason=session_expired` Alert, `auth.md` cleanup | PR 2 (base: PR 1 branch) | `pnpm --filter viewpro-web test` | vitest: mocked `fetch` returning 401 from a non-exempt path → `window.location.assign` called with `?reason=session_expired`; 401 from `/auth/login`/`/auth/step-up` and 403 `STEP_UP_REQUIRED` → no redirect; RTL: `sign-in-view` with the query param renders the expiry Alert | Revert the interceptor block in `api-client.ts` (leaves existing per-call error handling); revert `sign-in-view.tsx`'s `reason` read; `auth.md` cleanup can stay (doc-only) — dead code, no persisted client state |

---

## Dependency Graph

```
T-00 (spike: confirm @nestjs/jwt per-call clockTolerance forwarding — resolved above, no code)
  └── T-01 (RED: env.schema idle/absolute config + window-order boot guard tests)
        └── T-02 (GREEN: IDLE_TIMEOUT_SECONDS/ABSOLUTE_SESSION_SECONDS + auth.constants.ts + assertSessionWindowOrder)
              └── T-03 (RED: TokenService sessionExp mint/reissue/clockTolerance tests)
                    └── T-04 (GREEN: TokenService sessionExp + reissueAccessToken + clockTolerance + JwtModule per-call expiresIn)
                          └── T-05 (RED: AuthGuard absolute-deadline + legacy-token rejection tests)
                                └── T-06 (GREEN: AuthGuard dual-deadline check order)
                                      └── T-07 (RED: AuthGuard threshold re-issue + step-up invariance tests)
                                            └── T-08 (GREEN: AuthGuard threshold-based reissueAccessToken — closes WU-1)
                                                  └── T-09 (RED: api-client 401 interceptor tests)
                                                        └── T-10 (GREEN: api-client.ts 401 interceptor)
                                                              └── T-11 (RED: sign-in-view session_expired Alert tests)
                                                                    └── T-12 (GREEN: sign-in-view.tsx reads reason=session_expired)
                                                                          └── T-13 (docs: correct auth.md)
                                                                                └── T-14 (Final verification — both apps)
```

---

## WU-1 — viewpro-api: config + claim + TokenService + AuthGuard + module

### [x] T-00 — Spike: confirm `@nestjs/jwt` per-call `clockTolerance` forwarding
**Type**: spike/verify
**Spec**: N/A (design-dependency gate)
**WU**: WU-1, pre-work (no commit — findings folded into T-01 commit message context)
**Depends on**: nothing

- Confirmed via `viewpro-app/node_modules/.pnpm/@nestjs+jwt@11.0.2*/node_modules/@nestjs/jwt/dist/interfaces/jwt-module-options.interface.d.ts` (`JwtVerifyOptions extends jwt.VerifyOptions`) and `@types/jsonwebtoken@9.0.10`'s `VerifyOptions.clockTolerance?: number`, plus the compiled `dist/jwt.service.js` `mergeJwtOptions`/`verifyAsync` (only `secret`/`publicKey`/`privateKey` stripped before `jwt.verify(token, secret, verifyOptions, cb)`)
- **Result: NOT a blocker.** `verifyAccessToken` may pass `{ clockTolerance: CLOCK_TOLERANCE_SECONDS }` per call against the existing single `JwtService` instance — reaches jsonwebtoken's `verify` unmodified (D6 confirmed)

**Exit**: finding documented above; proceed with D6 as designed.

---

### [x] T-01 — RED: env schema idle/absolute config + window-order boot guard tests
**Type**: test (RED)
**Spec**: Idle and Absolute Timeout Are Required, Validated Configuration
**WU**: WU-1, commit 1
**Depends on**: T-00

- `apps/viewpro-api/src/config/__tests__/env.schema.spec.ts` — add:
  - `IDLE_TIMEOUT_SECONDS` omitted → defaults to `600`
  - `ABSOLUTE_SESSION_SECONDS` omitted → defaults to `28800`
  - `IDLE_TIMEOUT_SECONDS` below the 60-second floor → throws `/IDLE_TIMEOUT_SECONDS/`
  - `ABSOLUTE_SESSION_SECONDS` below the 300-second floor → throws `/ABSOLUTE_SESSION_SECONDS/`
  - `ABSOLUTE_SESSION_SECONDS <= IDLE_TIMEOUT_SECONDS` (e.g. both `600`) → throws naming both vars (`assertSessionWindowOrder`, new boot guard beside `assertDistinctSecrets`)
  - existing `assertDistinctSecrets` assertions still pass (regression pin)

All RED until T-02.
**Exit**: test file compiles; new assertions fail (schema not yet extended).
**Commit**: `test(platform-api): RED — IDLE_TIMEOUT_SECONDS/ABSOLUTE_SESSION_SECONDS config + window-order boot guard`

---

### [x] T-02 — GREEN: `IDLE_TIMEOUT_SECONDS`/`ABSOLUTE_SESSION_SECONDS` config + `assertSessionWindowOrder` (D4)
**Type**: impl
**Spec**: Idle and Absolute Timeout Are Required, Validated Configuration
**WU**: WU-1, commit 2
**Depends on**: T-01

- `apps/viewpro-api/src/config/env.schema.ts`: remove `ACCESS_TOKEN_TTL_SECONDS` entirely; add `@IsInt() @Min(60) @Type(() => Number) IDLE_TIMEOUT_SECONDS = 600` and `@IsInt() @Min(300) @Type(() => Number) ABSOLUTE_SESSION_SECONDS = 28800`; call new `assertSessionWindowOrder(validatedConfig)` from `validateEnv`, beside `assertDistinctSecrets` — throws if `ABSOLUTE_SESSION_SECONDS <= IDLE_TIMEOUT_SECONDS`
- `apps/viewpro-api/src/config/app.config.ts`: replace `auth.accessTokenTtlSeconds` with `auth.idleTimeoutSeconds` (`Number(process.env.IDLE_TIMEOUT_SECONDS ?? 600)`) and `auth.absoluteSessionSeconds` (`Number(process.env.ABSOLUTE_SESSION_SECONDS ?? 28800)`)
- `apps/viewpro-api/src/auth/auth.constants.ts`: add `export const IDLE_REISSUE_THRESHOLD = 0.5` and `export const CLOCK_TOLERANCE_SECONDS = 5`
- Confirm T-01 GREEN; grep confirms no remaining `ACCESS_TOKEN_TTL_SECONDS`/`accessTokenTtlSeconds` reference under `apps/viewpro-api` (legacy `apps/api` env schema is untouched — different app)

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-01 GREEN; all prior config tests GREEN.
**Commit**: `feat(platform-api): IDLE_TIMEOUT_SECONDS/ABSOLUTE_SESSION_SECONDS config + window-order boot guard (D4)`

---

### [x] T-03 — RED: `TokenService` sessionExp mint/reissue/clockTolerance tests (D1/D3/D4/D6)
**Type**: test (RED)
**Spec**: Absolute Session Deadline Independent of Activity; Rolling Idle Deadline on Authenticated Activity
**WU**: WU-1, commit 3
**Depends on**: T-02

- Extend `apps/viewpro-api/src/auth/tokens/__tests__/token.service.spec.ts` (config mock gains `app.auth.idleTimeoutSeconds: 600`, `app.auth.absoluteSessionSeconds: 28800`, replacing `accessTokenTtlSeconds`):
  - `signAccessToken({sub,email})` → decoded payload has `sessionExp ≈ now + 28800` and `exp ≈ now + 600` (not 900)
  - `reissueAccessToken(verifiedPayload)` → fresh token with the SAME `sessionExp` (byte-identical), a NEW `iat`/`exp`, and does NOT throw despite the input payload already carrying `iat`/`exp` (regression against jsonwebtoken's `expiresIn` + existing `exp` throw)
  - `setAccessCookie` `maxAge = idleTimeoutSeconds * 1000` (`600000`, not `900000`)
  - `verifyAccessToken` on a token whose `exp` is 3s in the past resolves (within `CLOCK_TOLERANCE_SECONDS = 5`) — clockTolerance forwarded

All RED until T-04.
**Exit**: test file compiles; new assertions fail (methods/fields don't exist yet).
**Commit**: `test(platform-api): RED — TokenService sessionExp mint/reissue + clockTolerance + idle-driven cookie maxAge (D1/D3/D4/D6)`

---

### [x] T-04 — GREEN: `sessionExp` claim + `reissueAccessToken` + clockTolerance + per-call `expiresIn` (D1/D3/D4/D6)
**Type**: impl
**Spec**: Absolute Session Deadline Independent of Activity; Rolling Idle Deadline; effective idle window from `IDLE_TIMEOUT_SECONDS`
**WU**: WU-1, commit 4
**Depends on**: T-03

- `apps/viewpro-api/src/auth/tokens/token.service.ts`:
  - `export type AccessTokenPayload = { sub: string; email: string; sessionExp: number }`
  - `export type VerifiedAccessTokenPayload = AccessTokenPayload & { iat: number; exp: number }`
  - `signAccessToken({sub,email})`: `sessionExp = Math.floor(Date.now()/1000) + absoluteSessionSeconds`; `signAsync({sub,email,sessionExp}, {expiresIn: idleTimeoutSeconds})`
  - new `reissueAccessToken(verified: VerifiedAccessTokenPayload)`: `signAsync({sub: verified.sub, email: verified.email, sessionExp: verified.sessionExp}, {expiresIn: idleTimeoutSeconds})` — fresh object literal, never spreads `verified` (no `iat`/`exp` leak)
  - `verifyAccessToken`: `verifyAsync<VerifiedAccessTokenPayload>(token, {clockTolerance: CLOCK_TOLERANCE_SECONDS})`
  - `setAccessCookie`: `maxAge` from `app.auth.idleTimeoutSeconds` (not `accessTokenTtlSeconds`)
- `apps/viewpro-api/src/auth/auth.module.ts`: drop `signOptions: { expiresIn: ... }` from `JwtModule.registerAsync` — factory returns `{ secret: configService.get('app.auth.accessTokenSecret') }` only
- Confirm T-03 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-03 GREEN; all prior TokenService tests GREEN.
**Commit**: `feat(platform-api): sessionExp claim + reissueAccessToken + clockTolerance + per-call expiresIn (D1/D3/D4/D6)`

---

### [x] T-05 — RED: `AuthGuard` absolute-deadline + legacy-token rejection tests (D2)
**Type**: test (RED)
**Spec**: Absolute Session Deadline Independent of Activity; Dual-Deadline Rejection Precedence; Tokens Without an Absolute-Deadline Claim Are Rejected
**WU**: WU-1, commit 5
**Depends on**: T-04

- `apps/viewpro-api/src/auth/__tests__/auth-me.controller.spec.ts`: generalize `buildExpiredToken` → `buildAccessToken({sub,email,iat,exp,sessionExp}: Partial<...>)` using a second `JwtService` with the test `ACCESS_TOKEN_SECRET`, `noTimestamp: true`, explicit `iat`/`exp`/`sessionExp` in the payload (deterministic, no fake timers); existing expired-token test (Scenario 3) updated to pass a valid future `sessionExp` alongside the past `exp` (still 401 — idle wins)
  - New: `exp` valid (future), `sessionExp = now - 10` → 401, `response.body.operator` undefined (**KEY new absolute case**)
  - New: token signed WITHOUT a `sessionExp` claim at all (helper omits the key) → 401 (legacy, AC9)

All RED until T-06.
**Exit**: new assertions fail; existing suite assertions unchanged.
**Commit**: `test(platform-api): RED — AuthGuard absolute-deadline rejection + legacy no-sessionExp rejection`

---

### [x] T-06 — GREEN: `AuthGuard` dual-deadline check order (D2)
**Type**: impl
**Spec**: same as T-05 + Dual-Deadline Rejection Precedence
**WU**: WU-1, commit 6
**Depends on**: T-05

- `apps/viewpro-api/src/auth/guards/auth.guard.ts`: after `verifyAccessToken` resolves, BEFORE setting `request.user`:
  1. `if (typeof payload.sessionExp !== 'number') { this.clearBothCookies(context); throw new UnauthorizedException(...) }` (legacy/AC9)
  2. `if (Math.floor(Date.now()/1000) > payload.sessionExp + CLOCK_TOLERANCE_SECONDS) { this.clearBothCookies(context); throw new UnauthorizedException(...) }` (absolute)
  3. only then `request.user = { id: payload.sub, email: payload.email }`
- Confirm T-05 GREEN

**Exit**: `pnpm --filter @viewpro/platform-api test` — T-05 GREEN; `auth-me.controller.spec.ts` fully GREEN (regression).
**Commit**: `feat(platform-api): AuthGuard dual-deadline rejection order — sliding exp then absolute sessionExp (D2)`

---

### [x] T-07 — RED: `AuthGuard` threshold re-issue + step-up invariance tests (D2/D5)
**Type**: test (RED)
**Spec**: Rolling Idle Deadline on Authenticated Activity; Absolute Session Deadline (byte-identical carry-forward); Step-up Cookie Independence from Access-Session Activity; Symmetric Cookie Clearing on Idle or Absolute Expiry
**WU**: WU-1, commit 7
**Depends on**: T-06

- Create `apps/viewpro-api/src/auth/__tests__/auth-idle-timeout.spec.ts` (mounts `AuthModule` via `Test.createTestingModule`, mirrors `auth-me.controller.spec.ts`'s seed + `buildAccessToken` pattern):
  - `iat = now - 400` (≥300s threshold), valid `exp`/`sessionExp` → `GET /api/auth/me` → 200, response has an access-token `Set-Cookie` with a future `maxAge`; decode the NEW cookie value: same `sessionExp`, fresh `iat`/`exp` (AC2/AC4/AC5)
  - `iat = now` (fresh, <300s) → 200, NO access-token `Set-Cookie` present in response headers (AC5 no-churn)
  - Valid access cookie crossing the threshold, sent alongside a valid step-up cookie → response `Set-Cookie` headers name ONLY the access cookie, step-up cookie untouched (AC6)
  - Fresh, valid step-up cookie present + access token `exp` already past → 401 (idle-expired access session is NOT rescued by step-up); both cookies cleared
  - Idle-expired request (`exp` past) → response `Set-Cookie` clears BOTH access and step-up cookies (symmetric-clear regression)

All RED until T-08.
**Exit**: new spec file compiles; all assertions fail (no re-issue logic yet).
**Commit**: `test(platform-api): RED — AuthGuard threshold re-issue, sessionExp carry-forward, step-up invariance`

---

### [x] T-08 — GREEN: threshold-based access-cookie re-issue on activity (D2/D5)
**Type**: impl
**Spec**: same as T-07
**WU**: WU-1, commit 8, closes WU-1
**Depends on**: T-07

- `apps/viewpro-api/src/auth/guards/auth.guard.ts`: after `request.user` is set, as the LAST statement before `return true`:
  - `const now = Math.floor(Date.now()/1000)`
  - `if (now - payload.iat >= idleTimeoutSeconds * IDLE_REISSUE_THRESHOLD) { const fresh = await this.tokenService.reissueAccessToken(payload); this.tokenService.setAccessCookie(response, fresh) }`
  - inject `ConfigService` for `idleTimeoutSeconds`; response already obtained via `context.switchToHttp().getResponse()`
  - re-issue is structurally unreachable from either reject branch (D2/R5 — never coexists with `clearBothCookies`)
- Confirm T-07 GREEN; confirm full `apps/viewpro-api` suite GREEN (regression, incl. `operator-step-up-auth` suites) — closes WU-1

**Exit**: `pnpm --filter @viewpro/platform-api test` — all GREEN; `pnpm --filter @viewpro/platform-api typecheck` passes.
**Commit**: `feat(platform-api): threshold-based access-cookie re-issue on activity (D2/D5)`

---

## WU-2 — viewpro-web: 401 interceptor + sign-in copy + doc

### [x] T-09 — RED: `api-client.ts` 401 interceptor tests (D7)
**Type**: test (RED)
**Spec**: Global 401 Handling Redirects to Sign-in with Session-Expired Indication
**WU**: WU-2, commit 1
**Depends on**: T-08

- Extend `apps/viewpro-web/src/lib/__tests__/api-client.spec.ts` (mock `window.location.assign` + `pathname`/`search`, restore after each):
  - 401 from a non-exempt path (e.g. `/operators/tenants`) → `location.assign` called with a URL starting `/auth/sign-in?reason=session_expired&redirect_url=...`; `apiRequest` still rejects with the `ApiError` (AC7 scenario 1)
  - 401 from `/auth/login` → `location.assign` NOT called; still rejects (negative — login-attempt 401, scenario 2)
  - 401 from `/auth/step-up` → `location.assign` NOT called (step-up wrong-password stays inline)
  - 401 from `/auth/logout` → `location.assign` NOT called
  - 403 with `code: 'STEP_UP_REQUIRED'` from any path → `location.assign` NOT called (status-401-only match, regression guard, scenario 3)
  - two concurrent non-exempt 401s → `location.assign` called exactly once (dedupe guard)

All RED until T-10.
**Exit**: new assertions fail (`SESSION_EXEMPT_401_PATHS`/interceptor don't exist yet).
**Commit**: `test(web): RED — apiRequest 401 interceptor, SESSION_EXEMPT_401_PATHS, dedupe (D7)`

---

### [x] T-10 — GREEN: `apiRequest` 401 interceptor → sign-in redirect (D7)
**Type**: impl
**Spec**: Global 401 Handling Redirects to Sign-in with Session-Expired Indication
**WU**: WU-2, commit 2
**Depends on**: T-09

- `apps/viewpro-web/src/lib/api-client.ts`:
  - `const SESSION_EXEMPT_401_PATHS = ['/auth/login', '/auth/step-up', '/auth/logout']`
  - module-level `let redirecting = false`
  - inside `apiRequest`, right before `throw toApiError(...)`: if `response.status === 401 && typeof window !== 'undefined' && !SESSION_EXEMPT_401_PATHS.includes(normalizeApiPath(path)) && !redirecting` → `redirecting = true; window.location.assign('/auth/sign-in?reason=session_expired&redirect_url=' + encodeURIComponent(window.location.pathname + window.location.search))`
  - still always `throw toApiError(response, responseBody)` afterward — 403 untouched by construction (status check is `=== 401` only)
- Confirm T-09 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-09 GREEN; all prior `api-client` tests GREEN.
**Commit**: `feat(web): apiRequest 401 interceptor → sign-in redirect with session_expired (D7)`

---

### [x] T-11 — RED: `sign-in-view` `session_expired` Alert tests (D8)
**Type**: test (RED)
**Spec**: Global 401 Handling Redirects to Sign-in with Session-Expired Indication
**WU**: WU-2, commit 3
**Depends on**: T-10

- Extend/create `apps/viewpro-web/src/features/auth/components/sign-in-view.test.ts(x)` (RTL, mock `useSearchParams`):
  - `?reason=session_expired` present → renders the destructive Alert with "Tu sesión expiró. Iniciá sesión de nuevo para continuar."
  - no `reason` param → no expiry Alert rendered
  - resubmitting the form clears the expiry alert before any new error renders

All RED until T-12.
**Exit**: new/extended assertions fail (component doesn't read `reason` yet).
**Commit**: `test(web): RED — sign-in-view session_expired Alert (D8)`

---

### [x] T-12 — GREEN: `sign-in-view.tsx` renders `reason=session_expired` Alert (D8)
**Type**: impl
**Spec**: same as T-11
**WU**: WU-2, commit 4
**Depends on**: T-11

- `apps/viewpro-web/src/features/auth/components/sign-in-view.tsx`: `SignInForm` reads `searchParams.get('reason')`; if `'session_expired'`, seeds `errorMessage` state with the es-AR copy (lazy initializer or mount effect) — reuses the existing destructive `Alert` slot already rendered from `errorMessage`; no new Alert JSX
- Confirm T-11 GREEN

**Exit**: `pnpm --filter viewpro-web test` — T-11 GREEN.
**Commit**: `feat(web): sign-in-view renders session_expired Alert (D8)`

---

### [x] T-13 — Docs: correct `auth.md`
**Type**: docs
**Spec**: proposal §2.6 doc cleanup (no formal requirement; no RED/GREEN)
**WU**: WU-2, commit 5
**Depends on**: T-12

- `apps/viewpro-web/docs/auth.md`: remove the `POST /auth/refresh` row and all tenant-membership/`session-context.tsx` content (does not exist in this operator-only, Design-B-isolated app); rewrite to describe the actual operations (`login`, `me`, `logout`, `stepUp` from `src/lib/session.ts`) and the rolling-idle + absolute-cap model (dual-deadline 401, global FE 401 → `/auth/sign-in?reason=session_expired` redirect)

**Exit**: doc reviewed for accuracy against `session.ts`/`api-client.ts`/`auth.guard.ts` as implemented.
**Commit**: `docs(web): correct auth.md — drop phantom /auth/refresh + memberships, document idle-timeout model`

---

## T-14 — Final verification (both apps)

**Type**: verify
**Spec**: all 8 requirements; invariants
**WU**: closes WU-1 + WU-2
**Depends on**: T-13

**Requirement scenarios (all MUST be green from prior tasks):**
1. Idle-expired (`exp` past, `sessionExp` future) → 401 (T-05/T-06)
2. Valid sliding `exp` but `sessionExp` past → 401 — KEY new case (T-05/T-06)
3. Legacy token without `sessionExp` → 401 (T-05/T-06)
4. Both cookies cleared on either idle or absolute expiry (T-05/T-06/T-07)
5. Re-issue `Set-Cookie` present when `iat` ≥ threshold & valid; absent when fresh (T-07/T-08)
6. `sessionExp` byte-identical across every re-issue (T-03/T-04, T-07)
7. No re-issue past the absolute deadline — structurally unreachable from the reject path (D2, T-06/T-08)
8. Step-up cookie untouched by access re-issue; a fresh step-up does not rescue an idle-expired access session (T-07/T-08)
9. FE: any authenticated 401 → redirect w/ `session_expired`; `/auth/login`, `/auth/step-up`, `/auth/logout` 401 → no redirect; `403 STEP_UP_REQUIRED` → no redirect (T-09/T-10)

**Final verification checklist**:
1. `pnpm --filter @viewpro/platform-api test` — all GREEN (auth + platform-control + step-up suites)
2. `pnpm --filter @viewpro/platform-api typecheck` — passes
3. `pnpm --filter viewpro-web test` — all GREEN
4. `pnpm --filter viewpro-web typecheck` — passes
5. `pnpm --filter viewpro-web build` — succeeds
6. `git diff HEAD -- viewpro-app/apps/viewpro-api/prisma/` — empty (no migration, AC10)
7. `git diff HEAD -- packages/platform-contract/` — empty (no contract change, AC10)
8. `git diff HEAD -- viewpro-app/apps/api/` — empty (InmoView lane untouched, AC10)
9. `assertDistinctSecrets` still green alongside the new `assertSessionWindowOrder` (both boot guards independently enforced)
10. `operator-step-up-auth` suite fully green — no regression from the `AuthGuard` reorder (step-up cookie set/clear/gating untouched)
11. Manual/dev-DB sanity: login → idle past `IDLE_TIMEOUT_SECONDS` with no activity → next request 401; login → stay active every <5min → session survives past 10min but dies at `ABSOLUTE_SESSION_SECONDS`

**Exit**: all 9 requirement scenarios + 11 checklist items pass; no regressions in existing auth/platform-control/step-up/tenants suites.
**Commit**: `chore(platform-operator-idle-timeout): final verification — both apps green, no migration/contract diff`

---

## Summary Table

| Task | Type | WU | Spec requirement | Depends on |
|------|------|----|-----------------|------------|
| T-00 spike: @nestjs/jwt per-call clockTolerance | spike | WU-1 | Design dependency gate | — |
| T-01 RED: env schema idle/absolute + boot guard | test | WU-1 | Idle/Absolute Required, Validated Configuration | T-00 |
| T-02 GREEN: config + assertSessionWindowOrder | impl | WU-1 | Idle/Absolute Required, Validated Configuration | T-01 |
| T-03 RED: TokenService sessionExp/reissue tests | test | WU-1 | Absolute Session Deadline; Rolling Idle Deadline | T-02 |
| T-04 GREEN: sessionExp + reissueAccessToken + clockTolerance | impl | WU-1 | D1/D3/D4/D6 | T-03 |
| T-05 RED: AuthGuard absolute + legacy rejection | test | WU-1 | Absolute Session Deadline; Dual-Deadline Precedence; No-Claim Rejected | T-04 |
| T-06 GREEN: AuthGuard dual-deadline order | impl | WU-1 | D2 | T-05 |
| T-07 RED: AuthGuard threshold re-issue + step-up invariance | test | WU-1 | Rolling Idle Deadline; Absolute (byte-identical); Step-up Independence; Symmetric Clear | T-06 |
| T-08 GREEN: threshold-based re-issue | impl | WU-1 | D2/D5 | T-07 |
| T-09 RED: api-client 401 interceptor tests | test | WU-2 | Global 401 Handling Redirects to Sign-in | T-08 |
| T-10 GREEN: api-client.ts 401 interceptor | impl | WU-2 | D7 | T-09 |
| T-11 RED: sign-in-view session_expired Alert tests | test | WU-2 | Global 401 Handling Redirects to Sign-in | T-10 |
| T-12 GREEN: sign-in-view.tsx reason Alert | impl | WU-2 | D8 | T-11 |
| T-13 Docs: correct auth.md | docs | WU-2 | proposal §2.6 | T-12 |
| T-14 Final verification | verify | both | All 8 requirements + invariants | T-13 |

---

## Success Checklist (maps to the 8 spec requirements)

- [x] Rolling Idle Deadline on Authenticated Activity — activity within the idle window keeps the session alive; no activity beyond `IDLE_TIMEOUT_SECONDS` rejects the next request (T-05–T-08)
- [x] Absolute Session Deadline Independent of Activity — minted at login, carried forward byte-identical on every re-sign, continuous activity does not survive it (T-03/T-04, T-07)
- [x] Dual-Deadline Rejection Precedence — either deadline alone is sufficient to reject, evaluated independently (T-05/T-06)
- [x] Symmetric Cookie Clearing on Idle or Absolute Expiry — both cookies cleared on either rejection; a stale cleared cookie is rejected again (T-05–T-08)
- [x] Step-up Cookie Independence from Access-Session Activity — re-issue never touches the step-up cookie; a fresh step-up cookie never rescues an idle-expired access session (T-07/T-08)
- [x] Tokens Without an Absolute-Deadline Claim Are Rejected — legacy tokens treated as expired, not grandfathered (T-05/T-06)
- [x] Global 401 Handling Redirects to Sign-in with Session-Expired Indication — any authenticated 401 redirects; login/step-up/logout 401 and `403 STEP_UP_REQUIRED` do not (T-09–T-12)
- [x] Idle and Absolute Timeout Are Required, Validated Configuration — both vars boot-validated with safe defaults; `IDLE_TIMEOUT_SECONDS` alone drives the effective idle window (T-01/T-02)
- [ ] No DB migration, no `platform-contract` change, no `apps/api` change; distinct-secrets boot guard unchanged (T-14 checklist items 6–9)
