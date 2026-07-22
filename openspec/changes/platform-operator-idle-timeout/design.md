# Design: Platform A3 Slice 2 — Shorter Idle-Timeout for the Operator Session

Turn the operator access token into a **rolling idle deadline**: `TokenService.signAccessToken` mints a `sessionExp` absolute-deadline claim at login and signs with per-call `expiresIn = IDLE_TIMEOUT_SECONDS` (600s); `AuthGuard` verifies the sliding `exp` (idle), then manually asserts `now <= sessionExp` (absolute, 8h), and past a 50% threshold of the idle window re-issues the cookie via a new `reissueAccessToken` that copies `sessionExp` verbatim. Rejection (either deadline, or a legacy token without `sessionExp`) → 401 + `clearBothCookies`, never a re-issue. viewpro-web gains one api-client-level 401 interceptor → `/auth/sign-in?reason=session_expired`. Step-up cookie untouched (fixed 300s). Zero server-side state, no migration, no platform-contract change, no `apps/api` change. Paths below are under `viewpro-app/` unless prefixed `openspec/`.

## Technical Approach

Proposal Approach A against the real code: `AuthGuard` already reaches the response object (`clearBothCookies` mutates it directly and the Set-Cookie survives the thrown 401) — the same seam re-issues on success. `TokenService` already proves the per-call-options pattern (`signStepUpToken` passes explicit `{ secret, expiresIn }`), so the access token moves off the `JwtModule` default `expiresIn` onto the same per-call shape. The FE handling is purely reactive: `apiRequest` is the single funnel every call goes through (including the non-React-Query direct `login()` call), so the interceptor lives there, not in React Query.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | Absolute-deadline claim | `sessionExp: number` — unix **seconds**, inside the signed payload, minted at login as `nowSec + ABSOLUTE_SESSION_SECONDS` | `absExp` (reads like a second lib claim, and non-standard abbreviations invite confusion with `exp`); `sessionStart` + derived deadline (deadline would silently move for live sessions if `ABSOLUTE_SESSION_SECONDS` changes; verify-time derivation needs config where a plain comparison suffices) | Same unit/semantics as JWT `exp` so both checks compare the same clock; freezing the deadline at mint makes AC4 (byte-identical across re-signs) trivially checkable. Inside the HS256-signed payload → tamper-proof; a cookie attribute would be client-editable. jsonwebtoken's own verification only covers the registered `exp` (sliding); `sessionExp` is a custom claim checked **manually** in `AuthGuard` |
| D2 | Guard control flow | Strict order: cookie present → `verifyAccessToken` (sliding `exp`, `clockTolerance`) → `sessionExp` is a finite number (legacy → reject, R6/AC9) → `now <= sessionExp + tolerance` (absolute) → set `request.user` → threshold re-issue → `return true`. Every failure path: `clearBothCookies` then throw 401; the re-issue call is the **last** statement before `return true` | Re-issue before the absolute check; treating legacy tokens as "no sessionExp = no cap" | Reject-wins by construction (R5/AC8): re-issue is unreachable from any throw path, so a response can never carry both a set and a clear for the access cookie. A request past the absolute deadline never re-issues. Legacy grandfathering would leave uncapped sessions; feature is undeployed so there are no live sessions to preserve |
| D3 | Mint vs. carry | `signAccessToken({ sub, email })` computes a **new** `sessionExp` (login only, call site `LoginUseCase` unchanged). New `reissueAccessToken(verified)` builds a **fresh** payload `{ sub, email, sessionExp: verified.sessionExp }` and re-signs with per-call `expiresIn` — `iat`/`exp` are dropped, `sessionExp` copied verbatim | One method with an optional `sessionExp` param; re-signing the verified payload object as-is | Two names = two intents; an optional param invites a re-issue that accidentally re-mints the deadline. Passing the verified payload through unfiltered makes jsonwebtoken throw (`expiresIn` option + `exp` already in payload), so the fresh-object construction is mandatory anyway. `signStepUpToken`/`verifyStepUpToken`/step-up cookie methods untouched |
| D4 | Config reconciliation | **Remove** `ACCESS_TOKEN_TTL_SECONDS`; add `IDLE_TIMEOUT_SECONDS = 600` (`@Min(60)`) and `ABSOLUTE_SESSION_SECONDS = 28800` (`@Min(300)`); drop `signOptions.expiresIn` from `JwtModule.registerAsync` (keep `secret` — it stays the verify/sign default); access sign moves to per-call `{ expiresIn: idleTimeoutSeconds }`, exactly the step-up pattern. Add `assertSessionWindowOrder` beside `assertDistinctSecrets`: boot fails if `ABSOLUTE_SESSION_SECONDS <= IDLE_TIMEOUT_SECONDS`. `setAccessCookie` maxAge = `idleTimeoutSeconds * 1000` | Alias (`ACCESS_TOKEN_TTL_SECONDS` → idle); keep module-default `expiresIn` | A rolling token needs per-sign `expiresIn` conceptually per call anyway; keeping a module default that nothing should use is a trap for the next sign call. R8: no external contract reads the var, the branch is undeployed → clean removal beats a confusing alias. Distinct-secrets boot guard untouched (AC10) |
| D5 | Re-sign threshold | `IDLE_REISSUE_THRESHOLD = 0.5` — re-issue when `now - iat >= idleTimeoutSeconds * 0.5` (i.e. ≥300s since last sign). Code constant in `auth.constants.ts`, not env | Per-request re-issue (R1 churn); env-configurable fraction; higher threshold (0.8) | 0.5 caps Set-Cookie churn at ~1 per 5 min per operator while guaranteeing the effective idle window is 600–900s from last activity — never below the configured 600s (a request at threshold still resets to a full 600s). 0.8 shaves churn little but lets effective idle approach 600s exactly with more re-sign latency risk. No operational need to tune it → constant, not config |
| D6 | Clock tolerance | `CLOCK_TOLERANCE_SECONDS = 5` (constant in `auth.constants.ts`), applied to BOTH checks: `verifyAccessToken(token, { clockTolerance: 5 })` for the sliding `exp`, and `now > sessionExp + 5` for the absolute check | None (0s); larger (30–60s) | Sign and verify normally happen on the same process (same clock), so tolerance only matters for multi-instance drift/NTP steps; 5s is the conventional allowance and is noise against a 600s window. Applying it to both checks keeps the two deadlines equally strict — omitting it on the manual check would make the absolute comparison the only skew-sensitive path. Step-up verify unchanged (out of scope) |
| D7 | FE 401 layer | Interceptor **inside `apiRequest`** (api-client): on `response.status === 401` && `typeof window !== 'undefined'` && path NOT in `SESSION_EXEMPT_401_PATHS = ['/auth/login', '/auth/step-up', '/auth/logout']` → `window.location.assign('/auth/sign-in?reason=session_expired&redirect_url=' + encodeURIComponent(pathname+search))`; then still `throw toApiError(...)` so callers settle. Module-level `redirecting` flag suppresses duplicate assigns from concurrent 401s | React Query `queryCache`/`mutationCache` global `onError` in query-client.ts | `apiRequest` is the only funnel — `login()` is already called **directly** (not via React Query) from `sign-in-view`, proving RQ-level handlers would miss direct calls and future ones. Path-based disambiguation is explicit and unit-testable: (a) login 401 (bad credentials) stays inline in the form; (b) step-up 401 (wrong password) stays inline in the modal (sibling D7/D13 preserved); (c) 403 `STEP_UP_REQUIRED` is untouched by construction — the interceptor matches status 401 only. Hard navigation (not `router.push`) guarantees full client-state teardown mid-mutation |
| D8 | "Sesión expirada" surface | Query param `reason=session_expired` read by `sign-in-view` via existing `useSearchParams`; renders the existing destructive `Alert` slot with es-AR copy: **"Tu sesión expiró. Iniciá sesión de nuevo para continuar."** Cleared on next submit attempt | Toast; global banner; localStorage flag | A toast fired before `window.location.assign` dies with the page; a query param survives the hard navigation, is bookmark-harmless, and reuses the exact Alert UI the form already has. `redirect_url` rides along and is already sanitized by `getSafeSignInRedirect` |
| D9 | Re-issue vs. downstream failures | Re-issue happens only after ALL AuthGuard checks pass (D2). If a **later** stage fails (method-level `StepUpGuard` 403, handler 4xx/5xx), the fresh access cookie legitimately stays on the response | Deferring the Set-Cookie to an interceptor that fires only on 2xx | The session WAS valid and active — a 403 `STEP_UP_REQUIRED` or a handler error is activity, and rolling on it is correct; only auth failure must not roll. The R5 conflict is specifically set+clear on the SAME cookie, impossible per D2. A success-only response interceptor adds a second seam for zero security gain |

Note (accepted, documented): near the absolute deadline a re-issued sliding `exp` may exceed `sessionExp`. Harmless — the manual absolute check dominates on every request; no capping logic needed.

## Data Flow

    Login: POST /auth/login → LoginUseCase → signAccessToken({sub,email})
      payload { sub, email, sessionExp: now+28800 }, expiresIn: 600 (per-call) → setAccessCookie (maxAge 600s)

    Any authenticated request → AuthGuard:
      no cookie ──────────────────────────────→ clearBoth → 401
      verify(exp sliding, clockTolerance 5) ──→ fail → clearBoth → 401   (idle timeout, AC1)
      sessionExp missing/non-number ──────────→ clearBoth → 401          (legacy, AC9)
      now > sessionExp + 5 ───────────────────→ clearBoth → 401          (absolute cap, AC3)
      request.user = { id: sub, email }
      now - iat >= 300 (600 * 0.5)? ──────────→ reissueAccessToken(payload)  // SAME sessionExp
                                                 setAccessCookie(response)   (AC2/AC4/AC5)
      return true   (step-up cookie never touched — AC6)

    FE: any apiRequest → 401 && path ∉ {login, step-up, logout}
      → location.assign('/auth/sign-in?reason=session_expired&redirect_url=…') + throw (AC7)
      sign-in-view: reason=session_expired → Alert "Tu sesión expiró. Iniciá sesión de nuevo para continuar."
      401 from /auth/login or /auth/step-up → inline form/modal error, NO redirect
      403 STEP_UP_REQUIRED → existing useStepUpGate flow, untouched

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/viewpro-api/src/config/env.schema.ts` | Modify | Remove `ACCESS_TOKEN_TTL_SECONDS`; add `IDLE_TIMEOUT_SECONDS = 600` (`@Min(60)`), `ABSOLUTE_SESSION_SECONDS = 28800` (`@Min(300)`); add `assertSessionWindowOrder` (absolute > idle, fail fast) |
| `apps/viewpro-api/src/config/app.config.ts` | Modify | `auth.idleTimeoutSeconds` + `auth.absoluteSessionSeconds`; drop `accessTokenTtlSeconds` |
| `apps/viewpro-api/src/auth/auth.constants.ts` | Modify | Add `IDLE_REISSUE_THRESHOLD = 0.5`, `CLOCK_TOLERANCE_SECONDS = 5` |
| `apps/viewpro-api/src/auth/auth.module.ts` | Modify | Drop `signOptions.expiresIn` from `JwtModule.registerAsync` (secret only) — access `expiresIn` is per-call now (D4) |
| `apps/viewpro-api/src/auth/tokens/token.service.ts` | Modify | `AccessTokenPayload` += `sessionExp`; `VerifiedAccessTokenPayload`; `signAccessToken` mints `sessionExp` + per-call `expiresIn`; new `reissueAccessToken`; `verifyAccessToken` passes `clockTolerance`; `setAccessCookie` maxAge from `idleTimeoutSeconds` (D1/D3/D6) |
| `apps/viewpro-api/src/auth/guards/auth.guard.ts` | Modify | Dual-deadline rejection + legacy rejection + threshold re-issue, ordered per D2 |
| `apps/viewpro-api/src/auth/__tests__/auth-me.controller.spec.ts` | Modify | Extend `buildExpiredToken` → general `buildAccessToken` helper (explicit `iat`/`exp`/`sessionExp`, `noTimestamp: true`); existing expired-token test gains a valid `sessionExp` |
| `apps/viewpro-api/src/auth/__tests__/auth-idle-timeout.spec.ts` | Create | Integration suite for both deadlines, threshold re-issue, legacy rejection, no-conflicting-Set-Cookie, step-up-cookie invariance (see Testing) |
| `apps/viewpro-api/src/auth/tokens/token.service.spec.ts` (or `__tests__/`) | Modify | Unit: mint vs. carry — `sessionExp` byte-identical across `reissueAccessToken`; per-call `expiresIn` |
| `apps/viewpro-web/src/lib/api-client.ts` | Modify | 401 interceptor + `SESSION_EXEMPT_401_PATHS` + `redirecting` guard (D7) |
| `apps/viewpro-web/src/features/auth/components/sign-in-view.tsx` | Modify | Read `reason=session_expired` → destructive Alert with expiry copy (D8) |
| `apps/viewpro-web/src/lib/__tests__/api-client.spec.ts` | Create/Modify | Interceptor unit tests incl. both disambiguation negatives |
| `apps/viewpro-web/src/features/auth/components/sign-in-view.test.ts(x)` | Modify | `reason` param renders the expiry alert |
| `apps/viewpro-web/docs/auth.md` | Modify | Drop phantom `/auth/refresh` + memberships; document rolling-idle + absolute-cap model, dual-deadline 401, global FE 401 handling |
| `.env.example` / deploy env docs (api) | Modify | Replace `ACCESS_TOKEN_TTL_SECONDS` with the two new vars |

No changes: `apps/viewpro-web/src/lib/{session.ts, session-context.tsx, query-client.ts}`, `src/proxy.ts` (presence-check middleware unaffected; existing `/auth/me`-error effect stays as network-error fallback), step-up guard/use-case/cookie, `packages/platform-contract`, `apps/api`, Prisma schemas (**no migration**), distinct-secrets boot guard (AC10).

## Interfaces / Contracts

    // token.service.ts
    export type AccessTokenPayload = {
      sub: string
      email: string
      sessionExp: number   // unix seconds; absolute deadline; minted at login, NEVER re-minted on re-issue
    }
    export type VerifiedAccessTokenPayload = AccessTokenPayload & { iat: number; exp: number }

    signAccessToken({ sub, email }: { sub: string; email: string }): Promise<string>
      // sessionExp = floor(Date.now()/1000) + absoluteSessionSeconds
      // signAsync({ sub, email, sessionExp }, { expiresIn: idleTimeoutSeconds })

    reissueAccessToken(verified: VerifiedAccessTokenPayload): Promise<string>
      // signAsync({ sub: verified.sub, email: verified.email, sessionExp: verified.sessionExp },
      //           { expiresIn: idleTimeoutSeconds })   // fresh object — never pass iat/exp through

    verifyAccessToken(token: string): Promise<VerifiedAccessTokenPayload>
      // verifyAsync(token, { clockTolerance: CLOCK_TOLERANCE_SECONDS })

    // api-client.ts
    const SESSION_EXEMPT_401_PATHS = ['/auth/login', '/auth/step-up', '/auth/logout']
    // 401 + browser + non-exempt path → location.assign('/auth/sign-in?reason=session_expired&redirect_url=…'); always still throws ApiError

## Testing Strategy

Deterministic, no fake timers — extend the existing manually-signed-token pattern. Key helper (second `JwtService` with the test `ACCESS_TOKEN_SECRET`): sign with `noTimestamp: true` and **explicit `iat`/`exp`/`sessionExp` in the payload** — full control over both clocks without waiting.

| Layer | What (AC) | Approach |
|-------|-----------|----------|
| Unit | `signAccessToken` mints `sessionExp = now + absolute`, per-call `expiresIn = idle`; `reissueAccessToken` copies `sessionExp` byte-identical, fresh `iat`/`exp`, drops incoming `iat`/`exp` (AC4) | vitest, decode returned JWT |
| Integration | Idle: `exp` in past, `sessionExp` in future → 401, BOTH cookies cleared, no access Set-Cookie with a value (AC1) | supertest, helper token |
| Integration | **Absolute (key new case)**: `exp` valid (future), `sessionExp = now - 10` → 401 + clear both; assert Set-Cookie contains ONLY clears (epoch/empty), no re-issue (AC3/AC8) | helper with past `sessionExp` |
| Integration | Legacy: token without `sessionExp` → 401 (AC9) | helper omitting the claim |
| Integration | Threshold: `iat = now - 400` (≥300s), valid both deadlines → 200 + access Set-Cookie with future maxAge; decoded new cookie: same `sessionExp`, fresh `exp` (AC2/AC4/AC5). Fresh token (`iat = now`) → 200, NO access Set-Cookie (AC5) | assert Set-Cookie presence/absence + decode |
| Integration | Step-up invariance: request with valid access + step-up cookies crossing the threshold → re-issue Set-Cookie names ONLY the access cookie (AC6) | header inspection |
| Integration | Boot guards: `ABSOLUTE_SESSION_SECONDS <= IDLE_TIMEOUT_SECONDS` → boot failure; distinct-secrets guard still green (AC10) | `validateEnv` unit tests |
| FE unit | 401 from `/operators/tenants` → `location.assign` with `reason=session_expired` + still rejects; 401 from `/auth/login` → NO redirect (negative a); 403 `STEP_UP_REQUIRED` → NO redirect, `isStepUpRequiredError` still true (negative b); 401 from `/auth/step-up` → NO redirect (AC7) | vitest, mocked fetch + location |
| FE unit | `sign-in-view` with `?reason=session_expired` renders "Tu sesión expiró…" Alert; absent param → no alert | RTL |

Set-Cookie disambiguation in assertions: a **clear** is empty-value + epoch `Expires`; a **re-issue** carries a JWT value + future expiry — tests must distinguish, not just count headers.

## Threat Matrix

No routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Auth-hardening rows tracked as design requirements instead:

| Row | Status | Safe behavior / RED test |
|-----|--------|--------------------------|
| Infinite renewal (deadline tamper) | Applicable | `sessionExp` inside signed payload; re-issue copies verbatim (AC4 unit + integration decode) |
| Reject/re-issue conflict (R5) | Applicable | Re-issue unreachable from throw paths (D2); RED: past-absolute request shows clears only |
| Legacy/claimless token (R6) | Applicable | Missing `sessionExp` → 401; RED: AC9 test |
| Step-up erosion (R7) | Applicable | Re-issue writes access cookie only; RED: AC6 header test |
| FE redirect misfire (login/step-up/403) | Applicable | Path exemption + status-401-only match; RED: both FE negatives |

## Migration / Rollout

**No DB migration, no platform-contract change, no `apps/api` change.** Env: `ACCESS_TOKEN_TTL_SECONDS` removed, `IDLE_TIMEOUT_SECONDS`/`ABSOLUTE_SESSION_SECONDS` added (both defaulted — no required new secret; update `.env.example`/deploy docs). Already-issued tokens (none deployed) die by design (AC9). Two chained PRs per proposal §6: **WU-1** viewpro-api (config, claim, guard, tests), **WU-2** viewpro-web (interceptor, sign-in copy, `auth.md`) targeting WU-1's branch, landed promptly after — once WU-1 ships, mid-action expiries begin and WU-2 turns them into a clean redirect.

**Rollback**: revert guard to verify-only, restore module-default `expiresIn` + `ACCESS_TOKEN_TTL_SECONDS`, drop the two vars, remove the FE interceptor + sign-in alert. Stateless — nothing to reverse. `auth.md` cleanup can stay.

## Open Questions (for tasks phase)

- [ ] Exact es-AR copy sign-off for "Tu sesión expiró. Iniciá sesión de nuevo para continuar." — copy pass at implementation like sibling dialogs.
- [ ] Whether `auth-idle-timeout.spec.ts` mounts the full `AuthModule` (like `auth-me.controller.spec.ts`) or a minimal guard harness — decide by suite runtime during tasks.
- [ ] Confirm `@nestjs/jwt` `verifyAsync` merges per-call `clockTolerance` (it forwards options to jsonwebtoken `verify`; sanity-check against the workspace lockfile during tasks, mirroring sibling's open question on per-call `secret`).
