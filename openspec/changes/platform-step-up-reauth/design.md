# Design: Platform A3 Slice 2 — Step-up Re-authentication for Destructive Operator Actions

Add a "sudo mode" to the operator lane: `POST /auth/step-up` re-verifies the operator's current password (pure local — viewpro-api owns `Operator.passwordHash`, Argon2) and sets a second short-lived httpOnly cookie carrying a `{ sub, stepUp:true }` JWT (5 min, reusable). A new additive `StepUpGuard` — layered AFTER the existing `AuthGuard` — gates `PATCH /operators/tenants/:id/limits` unconditionally and `PATCH /operators/tenants/:id/status` only when the target is `SUSPENDED` or `CANCELLED` (reactivate exempt). Failure returns a machine-readable **403 `STEP_UP_REQUIRED`**; viewpro-web reacts with a shared step-up modal that collects the password, calls `/auth/step-up`, and retries the original mutation. Zero server-side state, no migration, no platform-contract change. Paths below are under `viewpro-app/`.

## Technical Approach

Proposal Approach 1 (dedicated endpoint + second cookie), fleshed out against the real Phase 4 auth code. `StepUpUseCase` mirrors `LoginUseCase` exactly (same `OPERATOR_REPOSITORY` + `PASSWORD_HASHER` DI, same constant-time dummy-hash pattern), except it resolves the operator by the AuthGuard-verified `sub` instead of an email from the body. `TokenService` grows step-up sign/verify/set/clear methods that pass explicit `{ secret, expiresIn }` overrides to the same `JwtService` — a distinct `STEP_UP_TOKEN_SECRET` means a step-up token can never pass `AuthGuard` and an access token can never pass `StepUpGuard`, structurally. The FE flow is **reactive**: it never tracks the 5-min window client-side; the API's 403 `STEP_UP_REQUIRED` is the single source of truth (within the window the API simply succeeds, so the modal never appears).

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Token plumbing | Extend `TokenService` with `signStepUpToken`/`verifyStepUpToken`/`setStepUpCookie`/`clearStepUpCookie`, passing explicit `{ secret, expiresIn }` per-call options to the existing `JwtService` (per-call options override the `JwtModule.registerAsync` defaults) | Dedicated `StepUpTokenService`; second `JwtModule` registration | One service already owns "auth token + cookie" for the operator lane; the step-up methods are exact structural parallels of the access ones (incl. reusing private `baseCookieOptions()`). A second service/module duplicates config wiring for 4 small methods |
| D2 | Secret separation | New `STEP_UP_TOKEN_SECRET` (required, `@MinLength(16)`, no default — fail fast like `ACCESS_TOKEN_SECRET`) + `stepUp: true` claim; `STEP_UP_TTL_SECONDS` default 300 | Reuse `ACCESS_TOKEN_SECRET` + claim only | Distinct secret gives clean independent rotation AND makes cross-use cryptographically impossible both directions (defense layer 1); the `stepUp:true` claim check in the guard is layer 2. With a shared secret, one missed claim check = a forged session |
| D3 | Cookie | `viewpro_platform_stepup_token` (constant `STEP_UP_TOKEN_COOKIE` beside `ACCESS_TOKEN_COOKIE` in `auth.constants.ts`); same `baseCookieOptions()` — httpOnly, `sameSite:'lax'`, `secure` per env (forced in prod), `path:'/'`, optional domain; `maxAge = STEP_UP_TTL_SECONDS * 1000` | Different attributes; JS-readable cookie for FE freshness checks | Identical hygiene to the hardened access cookie; httpOnly forces the FE to stay reactive (D10) instead of trusting a readable expiry |
| D4 | Guard layering | Keep class-level `@UseGuards(AuthGuard)` on `PlatformControlController`; add **method-level** `@UseGuards(StepUpGuard)` on the two PATCH routes | Both guards at method level; global guard | Nest executes class-level guards before method-level ones — `AuthGuard`'s 401 structurally wins over `StepUpGuard`'s 403 (unauthenticated never sees `STEP_UP_REQUIRED`), and `request.user` is guaranteed populated when `StepUpGuard` runs |
| D5 | Conditional status gating | Data-only route metadata: `@StepUpStatusTargets(['SUSPENDED','CANCELLED'])` (a `SetMetadata` decorator) on the status route; `StepUpGuard` reads it via `Reflector`. If metadata exists and raw `request.body?.status` is NOT in the list → allow without step-up. Limits route carries no metadata → unconditional | Guard hardcoding route paths; splitting status into two routes; gating inside the use-case/client | Guards run after body parsing but before pipes, so the raw body is readable. Non-listed values are either `'ACTIVE'` (legitimately exempt) or garbage the DTO's `@IsIn(['ACTIVE','SUSPENDED','CANCELLED'])` rejects with 400 before the handler runs — **no bypass**: every value that can reach the destructive handler is in the gated list. Declarative metadata keeps the guard reusable and the policy visible at the route |
| D6 | Blocked-response contract | `throw new ForbiddenException({ statusCode: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' })` — the object becomes the response body verbatim | 401; header-based signal; plain 403 string | 401 already means "session invalid → sign-in redirect" in the FE (`session-context` D6); overloading it would log operators out instead of prompting. A stable `code` field is machine-readable regardless of message copy |
| D7 | Step-up verification | New `StepUpUseCase`: `findById(request.user.id)` (new method on `IOperatorRepository` + `PrismaOperatorRepository`), verify against `operator?.passwordHash ?? DUMMY_PASSWORD_HASH` (constant extracted to `security/dummy-password-hash.ts`, shared with login), require `status === 'ACTIVE'`, wrong password → generic 401 `UnauthorizedException('Invalid password')`, **no cookie set** | Skip dummy-hash (operator already authenticated); lookup by JWT email | Keeps timing constant even for a deleted/suspended operator with a live session (doesn't leak account state); `findById` is the correct key — email in the JWT could go stale. 401 here is scoped to the step-up POST and handled inline by the modal (D13), never as session expiry |
| D8 | Brute-force guard | `@UseGuards(AuthGuard, AuthThrottlerGuard)` on `POST /auth/step-up` | No throttle | Step-up accepts a password → same guessing surface as login. `AuthThrottlerGuard` keys per `ip:path`, so step-up gets its own independent 5/60s bucket for free |
| D9 | Cookie hygiene points | (a) `logout()` calls `clearAccessCookie` + `clearStepUpCookie`; (b) `AuthGuard`'s failure paths clear BOTH cookies via `context.switchToHttp().getResponse()` before throwing (Set-Cookie headers survive the exception filter) | FE-only cleanup; rely on 5-min expiry | AC7 symmetry: no stale step-up cookie outlives a rotated/expired session, self-healing even when the client never calls logout. Step-up TTL (300s) < access TTL (900s) bounds any residue anyway |
| D10 | FE trigger model | **Reactive**: attempt the destructive mutation; on 403 `STEP_UP_REQUIRED` open the shared modal, verify, retry. No client-side freshness timer | Password field inside each confirm/limits dialog; client-side expiry tracking | The server is the only clock that matters (httpOnly cookie is unreadable anyway). Reuse-window skip falls out for free: in-window calls just succeed. Inline password fields duplicate UI in 2 dialogs and break when the MFA slice changes the proof |
| D11 | FE placement | Shared `StepUpDialog` + `useStepUpGate()` hook in `src/features/auth/`; instantiated locally by `TenantsManagementPage` (the only destructive surface) — no global context/provider | Global `StepUpProvider`; page-local one-off | Reusable seam for future destructive surfaces without premature global state; hook holds `{ isOpen, stashed retry }` and dies with the page (logout unmount clears it) |
| D12 | api-client change | Extend `ErrorResponseBody`/`ApiError` with optional `code?: string`; `toApiError` copies it; export `isStepUpRequiredError(e) = isApiError(e) && e.status === 403 && e.code === 'STEP_UP_REQUIRED'` | Sniffing `details` at call sites | One typed helper; 401 handling and 404/400 copy mapping stay untouched |
| D13 | Retry semantics | In `statusMutation`/`limitsMutation` `onError(error, variables)`: check `isStepUpRequiredError` FIRST → keep the underlying dialog open (do NOT clear pending state / toast), stash `() => mutation.mutate(variables)`, open modal. Modal submit → `stepUp(password)` → on 200 close modal + run stash; on 401 show inline "Contraseña incorrecta" (no logout, no toast) | Auto-retry queue in api-client; closing dialogs and asking user to redo | React Query hands `variables` to `onError` — the retry is a one-liner with zero request replumbing. Keeping the confirm dialog open preserves the operator's context; `isPending` re-engages on retry as today |

## Data Flow

    Operator clicks Suspender/Cancelar/Guardar límites (tenants-management-page)
      mutation.mutate(vars) ──→ PATCH /operators/tenants/:id/{status|limits}   (credentials:'include')
        AuthGuard (class-level): viewpro_platform_access_token → verify(ACCESS_TOKEN_SECRET)
          fail → clear BOTH cookies (D9) → 401  ──→ FE session flow (sign-in), NOT the modal
        StepUpGuard (method-level, D4/D5):
          @StepUpStatusTargets? && body.status ∉ targets → pass (reactivate exempt)
          else: viewpro_platform_stepup_token → verify(STEP_UP_TOKEN_SECRET)
                && payload.stepUp === true && payload.sub === request.user.id
            fail/absent/expired → 403 { code:'STEP_UP_REQUIRED' }  (D6)
        handler → PlatformControlClient → InmoView (unchanged: idempotencyKey, audit, terminality)

    FE on 403 STEP_UP_REQUIRED (D10/D13)
      onError: stash retry(vars) → StepUpDialog opens (confirm dialog stays open)
        submit password → POST /auth/step-up  (AuthGuard + AuthThrottlerGuard)
          StepUpUseCase: findById(user.id) → argon2.verify(hash ?? DUMMY) → ACTIVE?  (D7)
            ok  → TokenService.setStepUpCookie (5 min)  → 200 { success:true }
            bad → 401 (no cookie) → inline "Contraseña incorrecta"
        on 200 → close modal → run stashed retry → PATCH now passes StepUpGuard
      within 5-min window: next destructive PATCH just succeeds — no 403, no modal

    Logout: POST /auth/logout → clearAccessCookie + clearStepUpCookie (D9); FE signOut clears query cache

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-api/src/config/env.schema.ts` | Modify | `STEP_UP_TOKEN_SECRET!` (`@MinLength(16)`, required); `STEP_UP_TTL_SECONDS = 300` (`@Min(60)`) |
| `apps/viewpro-api/src/config/app.config.ts` | Modify | `auth.stepUpTokenSecret` (throw if missing, like access secret) + `auth.stepUpTtlSeconds` |
| `apps/viewpro-api/src/auth/auth.constants.ts` | Modify | Add `STEP_UP_TOKEN_COOKIE = 'viewpro_platform_stepup_token'` |
| `apps/viewpro-api/src/auth/tokens/token.service.ts` | Modify | `StepUpTokenPayload` + sign/verify (explicit secret/TTL options) + set/clear cookie methods (D1–D3) |
| `apps/viewpro-api/src/auth/security/dummy-password-hash.ts` | Create | Extracted `DUMMY_PASSWORD_HASH` constant (shared by login + step-up, D7) |
| `apps/viewpro-api/src/auth/use-cases/login.use-case.ts` | Modify | Import the extracted dummy-hash constant (no behavior change) |
| `apps/viewpro-api/src/auth/repositories/operator.repository.ts` | Modify | Add `findById(id: string): Promise<Operator \| null>` to `IOperatorRepository` |
| `apps/viewpro-api/src/auth/repositories/prisma-operator.repository.ts` | Modify | Implement `findById` (`operator.findUnique({ where: { id } })`) |
| `apps/viewpro-api/src/auth/dto/step-up.dto.ts` | Create | `{ password: string }` (`@IsString @MinLength(1)`) — MFA slice later widens ONLY this body |
| `apps/viewpro-api/src/auth/use-cases/step-up.use-case.ts` | Create | Verify password for `operatorId` (D7); returns token via `TokenService.signStepUpToken({ sub })` |
| `apps/viewpro-api/src/auth/guards/step-up.guard.ts` | Create | `StepUpGuard` + `@StepUpStatusTargets()` decorator/metadata key (D4–D6) |
| `apps/viewpro-api/src/auth/guards/auth.guard.ts` | Modify | On both failure paths, clear both cookies via `getResponse()` before throwing 401 (D9) |
| `apps/viewpro-api/src/auth/auth.controller.ts` | Modify | `POST /auth/step-up` (`@UseGuards(AuthGuard, AuthThrottlerGuard)`, 200, sets cookie); `logout()` clears both cookies |
| `apps/viewpro-api/src/auth/auth.module.ts` | Modify | Providers += `StepUpUseCase`, `StepUpGuard`; exports += `StepUpGuard` (consumed via existing `AuthModule` import in `PlatformControlModule`) |
| `apps/viewpro-api/src/platform-control/platform-control.controller.ts` | Modify | Status route: `@UseGuards(StepUpGuard)` + `@StepUpStatusTargets(['SUSPENDED','CANCELLED'])`; limits route: `@UseGuards(StepUpGuard)` |
| `apps/viewpro-web/src/lib/api-client.ts` | Modify | `code?` on `ApiError` + `isStepUpRequiredError` (D12) |
| `apps/viewpro-web/src/lib/session.ts` | Modify | `stepUp(password)` → `POST /auth/step-up` (sibling of `login`/`logout`) |
| `apps/viewpro-web/src/features/auth/components/step-up-dialog.tsx` | Create | Shared password-prompt Dialog: pending state, inline wrong-password error, Escape gated while verifying |
| `apps/viewpro-web/src/features/auth/hooks/use-step-up-gate.ts` | Create | `useStepUpGate()`: `{ dialogProps, handleStepUpError(error, retry): boolean }` — stash + open on `STEP_UP_REQUIRED` (D11/D13) |
| `apps/viewpro-web/src/features/tenants/components/tenants-management-page.tsx` | Modify | Wire `useStepUpGate` into both mutations' `onError` (checked before 400/404 mapping); render `<StepUpDialog {...dialogProps} />` |

No changes: `packages/platform-contract` (control-lane DTOs untouched), `apps/api` legacy `/admin` lane, Prisma schemas (**no migration — `Operator.passwordHash` exists; the step-up token is stateless**, AC10 confirmed).

## Interfaces / Contracts

    // viewpro-api
    POST /auth/step-up   (AuthGuard + AuthThrottlerGuard)
      body: { password: string }
      200 → { success: true }  + Set-Cookie viewpro_platform_stepup_token (httpOnly, lax, secure*, maxAge 300s)
      401 → wrong password / inactive operator (no cookie) | no valid access cookie

    type StepUpTokenPayload = { sub: string; stepUp: true }   // signed with STEP_UP_TOKEN_SECRET, exp = ttl

    // StepUpGuard failure (destructive route without fresh step-up)
    403 { statusCode: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' }

    // viewpro-web
    isStepUpRequiredError(error: unknown): boolean            // status 403 && code === 'STEP_UP_REQUIRED'
    stepUp(password: string): Promise<{ success: true }>
    useStepUpGate(): {
      dialogProps: StepUpDialogProps                          // open, onSubmit(password), isVerifying, error
      handleStepUpError(error: unknown, retry: () => void): boolean   // true = consumed (modal opened)
    }

## Security Review

1. **Step-up cookie is NOT an access token**: distinct secret (verify under `ACCESS_TOKEN_SECRET` fails) AND payload shape (`stepUp:true`, no `email`) — two independent layers; the reverse direction (access token as step-up proof) fails identically (D2).
2. **No bypass on the status route**: values outside `['SUSPENDED','CANCELLED']` that skip the guard are either `'ACTIVE'` (exempt by decision) or rejected 400 by the DTO before the handler runs (D5).
3. **Reusable 5-min window** (accepted R1): hijacked step-up cookie acts ≤300s, sub-bound, httpOnly; blocked without the ALSO-required access cookie.
4. **CSRF posture**: identical to the access cookie — httpOnly + `sameSite:'lax'` (+ `secure` forced in prod); the destructive PATCH/step-up POST are not sent on cross-site navigations under lax; no regression, no new surface.
5. **Cross-operator**: `payload.sub === request.user.id` (AuthGuard sets `user.id` from the verified access JWT).
6. **Enumeration/timing**: dummy-hash constant-time verify kept even authenticated (D7); wrong password 401 is generic.
7. **Guard order**: class-before-method guarantees 401-over-403 and a populated `request.user` (D4).

## Testing Strategy

| Layer | What (AC) | Approach |
|-------|-----------|----------|
| Unit | `TokenService` step-up sign/verify use `STEP_UP_TOKEN_SECRET`/TTL; access↔step-up cross-verify FAILS both ways; set/clear cookie attrs | vitest (extend `token.service.spec.ts`) |
| Unit | `StepUpUseCase`: correct pw → token; wrong pw / missing operator / non-ACTIVE → 401, dummy-hash called when operator absent (AC1) | vitest, mocked repo+hasher |
| Unit | `StepUpGuard`: no/expired/forged cookie → 403 `STEP_UP_REQUIRED` body; `stepUp` claim required; sub mismatch → 403 (AC5); metadata + `body.status='ACTIVE'` → pass (AC6); `'SUSPENDED'`/`'CANCELLED'` → require; limits (no metadata) → always require (AC2) | vitest, mocked ExecutionContext |
| Unit | `AuthGuard` failure clears both cookies then throws 401 (AC7) | vitest, mocked response |
| Unit | FE: `isStepUpRequiredError` narrows correctly (403+code vs plain 403 vs 401); `useStepUpGate` stashes/retries; dialog inline 401 error | vitest / RTL |
| Integration | `POST /auth/step-up`: correct pw → 200 + cookie; wrong → 401 no cookie; unauth → 401; throttled after 5 attempts (AC1/D8) | supertest |
| Integration | Destructive PATCH without step-up → 403, **no outbound InmoView call** (mock client asserted uncalled, AC2); with fresh cookie → proceeds (AC3); reusable within window, rejected after expiry — fake timers (AC4); reactivate ungated (AC6); operator-B request with A's step-up → 403 (AC5) | supertest (extend platform-control controller specs) |
| Integration | `logout` clears both cookies (AC7); legacy `/admin` lane untouched (AC9 — existing suites stay green) | supertest |
| FE integration | `tenants-management-page.spec`: 403 `STEP_UP_REQUIRED` on suspend/cancel/limits → modal opens (no error toast, confirm dialog stays); submit → step-up POST → original mutation retried with same variables; step-up 401 → inline error, session kept (AC8) | RTL + mocked service |

## Threat Matrix

New auth boundary on existing HTTP routes; no shell/subprocess/VCS automation:

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Token confusion (access↔step-up) | Applicable | Cross-verification fails both directions (distinct secret + claim); RED: access JWT in step-up cookie → 403; step-up JWT in access cookie → 401 |
| Privilege bypass via body manipulation (status route) | Applicable | Non-gated values are exempt-`ACTIVE` or 400 pre-handler; RED: `status:'SUSPENDED'` w/o step-up → 403, garbage status → 400, never reaches client |
| Cross-operator token reuse | Applicable | sub-bind → 403; RED: AC5 test |
| Replay within window | Applicable | Accepted (R1): ≤300s, requires valid access cookie too; documented, not further mitigated |
| Brute force on step-up password | Applicable | `AuthThrottlerGuard` per `ip:path`; RED: 6th attempt → 429 |
| CSRF on new cookie/endpoints | Applicable | httpOnly + lax + secure (prod-forced), same posture as access cookie; RED: cookie attribute assertions |
| Stale cookie after session end | Applicable | Logout + AuthGuard-failure clear both; RED: AC7 tests |
| Shell/subprocess/VCS/routing-config | N/A | Pure NestJS guard/controller + React changes |

## Migration / Rollout

**No DB migration, no platform-contract change** (AC10). New required env `STEP_UP_TOKEN_SECRET` must be set per environment before the api boots (fail-fast in `app.config.ts`) — add to `.env.example`/deploy secrets alongside the PR.

**Coupling**: backend enforcement (`StepUpGuard`) and FE threading MUST ship together — a gap means every destructive action 403s with no prompt. Everything lands on `feat/platform-foundation` (undeployed): **2 chained PRs** — PR#1 viewpro-api (endpoint, guard, config, hygiene), PR#2 viewpro-web (modal, gate hook, api-client) targeting PR#1's branch — merged back-to-back so the integration branch never sits in the gated-but-unthreaded state. Whenever this deploys, the same rule holds: api+web released together (or hold PR#1's guard application as the final commit).

**Rollback**: remove the two method-level `@UseGuards(StepUpGuard)` applications (routes revert to AuthGuard-only), leave `/auth/step-up` inert or remove; FE gate becomes dead code (no more 403s). Stateless — nothing to reverse.

## Open Questions (for tasks phase)

- [ ] `POST /auth/step-up` 200 body: `{ success: true }` (proposed, mirrors logout) vs echoing the operator — confirm FE needs nothing richer.
- [ ] Whether `StepUpDialog` copy lives with the existing es-AR UI copy conventions (`"Confirmá tu contraseña"` etc.) — copy pass at implementation, Spanish like sibling dialogs.
- [ ] `@Min` bound for `STEP_UP_TTL_SECONDS` (60 proposed, mirroring `ACCESS_TOKEN_TTL_SECONDS`) — allow lower for tests via config override instead of env?
- [ ] Confirm `@nestjs/jwt` version in use merges per-call `secret` into `verifyAsync` options (it does for >=7; verify against the workspace lockfile during tasks).
