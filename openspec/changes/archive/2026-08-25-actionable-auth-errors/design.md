# Design: Actionable Auth and Invitation Errors (#285)

## Approach and Decisions

Five slices, `A → B1 → B2 → C1 → C2`, each independently revertable. Producers annotate throw sites with `{ errorCode, message }`; the legacy filter branch forwards `errorCode` verbatim in every environment (`global-exception.filter.ts:54`); the client catalog guard (`api-client.ts:100`) is the enforcement point, so catalog growth in A hard-gates the consumer slices. No flag, no migration, no dependency on `PUBLIC_ERROR_ENVELOPE_ENABLED`.

| Decision | Choice / rationale |
|---|---|
| Annotation mechanism | Inline `{ errorCode, message }` literal at each throw site. No constants module, no helper. See ADR-1. |
| Emission proof | One production-mode boundary spec plus a per-file exhaustiveness guard. See ADR-2. |
| Consumer branching | Code map consulted first, existing status ladder retained as fallback. See ADR-3. |
| Test-shape authority | `toApiError` exported; view tests build errors through it, never by hand. See ADR-4. |
| Catalog | Strict append after `REQUEST_FAILED`; prefix assertion frozen at the existing 14. |
| Rollback | Reverse order; catalog last, because reverting it first orphans producer references. |

### Data flow (unchanged transport, new payload field)

```
use case throw new XException({ errorCode, message })
  → HttpException.initMessage() keeps error.message === message
  → GlobalExceptionFilter legacy branch (:50-58)
      message → sanitizeProductionMessage(status)   [production only]
      errorCode → forwarded verbatim, unvalidated   [every environment]
  → apiRequest → toApiError (api-client.ts:98)
      message → GENERIC_API_ERROR_MESSAGE (always)
      errorCode → kept only if isPublicErrorCode(...)
  → view: code → recovery copy
```

Verified: all four consumer flows (`team-invitations/api/service.ts`, `owner-invitations/api/service.ts`, `lib/session.ts` `verifyEmail`/`resetPassword`) call `apiRequest` directly against the API. **No Next BFF route sits between**, so no forwarder work is required and `errorCode` reaches the view unaltered.

Verified: NestJS `HttpException.initMessage()` reads `message` off an object response, so `error.message` is unchanged by annotation. The nine existing assertions on `Authentication required` (`admin.e2e-spec.ts:58,182,372,555`, `documents.e2e-spec.ts:409`, `owner-portal.e2e-spec.ts:640`, `owner-documents.e2e-spec.ts:169`, `team-invitations.use-cases.spec.ts:677,728`) keep passing untouched.

**Accepted side effect.** An object-form exception body carries no `error` key, so the legacy envelope's `error` degrades from `'Unauthorized'`/`'Gone'`/`'Conflict'`/`'Forbidden'` to the filter default `'Error'` (`:52`). This is exactly what the 13 established codes already do in production (`reject-status-change-request.use-case.ts:61-64`). A repository-wide grep found no API-side test and no consumer that binds `error` for these routes; `api-client.ts` discards it. Each WU must re-run that grep before GREEN.

## ADR-1 — Inline literal, no constants module

**Decision.** Each annotated site becomes a one-line replacement:

```ts
throw new GoneException({ errorCode: 'INVITATION_EXPIRED', message: 'Team invitation has expired' })
```

**Rationale and line consequence.** `apps/api` has no formatter config (no `.prettierrc`, no `biome.json`, no `printWidth`/`lineWidth` anywhere in the repo) and its existing code already carries lines up to ~145 characters (`accept-team-invitation.use-case.ts:167`). The annotated literal therefore fits on **one physical line**, so annotation costs exactly `1 added + 1 deleted` per site: **2 × 48 = 96 changed lines total**, with **zero new production files**.

**Rejected — shared constants module.** Team and owner messages differ (`'Team invitation ...'` vs `'Owner invitation ...'`), so one module cannot serve both; it needs two, ~10 and ~8 entries, ≈ 90 lines. Because no wrapping occurs, the call sites stay 1-for-1 either way, so the module saves **nothing** and adds ≈ 90 lines. It also couples B1 and B2 rollback to files neither slice owns alone, and forces a reader to leave the throw site to learn what the user sees. **Net: inline is ~90 lines cheaper and strictly simpler.**

**Rejected — extract a shared `throwForInvitationState(status)` helper** to collapse the four availability branches duplicated three times per bounded context. It is a genuine dedup (~30 lines saved per context) but it is a behavioral refactor of two production files landing in the same slice as a contract change, which enlarges the blast radius of a slice whose entire value is mechanical reviewability. Recorded as a follow-up, not blocked by this change.

## ADR-2 — Emission proof: production-mode boundary + exhaustiveness guard

`sanitizeProductionMessage` runs only when `nodeEnv === 'production'` (`global-exception.filter.ts:87`), so a green suite proves nothing about production. Two layers, both mandatory:

1. **Production-mode boundary table.** One new file `apps/api/test/public-error-annotations.spec.ts`, created by A and appended to by B1 and B2. Each case drives the real use case or guard with a minimal repository stub, catches the thrown exception, feeds it through `new GlobalExceptionFilter('production', undefined, {})` and a direct `ArgumentsHost` (the shape already proven at `errors.e2e-spec.ts:290-316`), then asserts **both** halves of the contract in one assertion:
   - `body.errorCode === <expected code>` — the code survives production, and
   - `body.message === 'Request failed' | 'Invalid request payload' | 'Resource not found'` — the prose does **not**.

   `nodeEnv` is a constructor parameter, so production sanitization is exercised hermetically without mutating `process.env` for the whole worker.

   One case per **distinct (state → code) pair**, not per throw site: 4 for A, 10 for B1, 8 for B2. Duplicated helper/accept-result pairs are the same observable state on a second path and are covered by layer 2.

2. **Per-file exhaustiveness guard.** One ~8-line test per annotated file asserting that the count of `throw new (Unauthorized|Forbidden|Gone|Conflict|NotFound)Exception(` occurrences in the file's own source equals the count of `errorCode:` occurrences. This is what makes "all 48 sites annotated" *verifiable* rather than asserted, and it fails loudly if a later edit adds an unannotated in-scope throw. `BadRequestException` is deliberately excluded from the pattern: the four DTO-validation throws stay unannotated by scope, and the two `AUTH_TOKEN_INVALID` sites live in files with no other `BadRequestException`.

`apps/api/test/errors.e2e-spec.ts:10-16` derives its cases from `PUBLIC_ERROR_CODES`, so the 11 appended codes gain filter-level e2e coverage automatically with no edit to that file.

**Rejected — HTTP-level supertest coverage of each site** through the existing production app at `errors.e2e-spec.ts:322`. It requires a live database and authenticated fixtures for 48 states; cost is disproportionate and the failure mode it would catch (routing/guard wiring) is not what this change touches.

## ADR-3 — Consumer branching: code map first, status ladder retained

```ts
const INVITATION_ERROR_COPY = { /* code → InvitationUiError */ } satisfies Partial<
  Record<PublicErrorCode, InvitationUiError>
>

function getInvitationUiError(error: unknown): InvitationUiError {
  if (!isApiError(error)) return connectError
  const byCode = error.errorCode ? INVITATION_ERROR_COPY[error.errorCode] : undefined
  if (byCode) return byCode
  return getStatusFallbackUiError(error.status)
}
```

`const message = error.message.toLowerCase()` and both `message.includes(...)` conditions are deleted. The status ladder survives, minus the two dead 410 sub-branches, as the fallback for an API older than the client and for the 400 DTO-validation case that stays unannotated. This is what makes C1 revertable on its own and what makes a partial deploy safe in either direction.

**Rejected — replacing the ladder outright with a code-only map.** It would make the client hard-depend on a deployed API of the same generation; a rollback of B1 or B2 alone would then render *nothing* instead of today's generic panel.

## ADR-4 — A test may not construct `ApiError` by hand

Both view test files define a local helper that manufactures a shape production cannot emit:

```ts
function apiError(status: number, message: string): ApiError { return { status, message } }
```

`owner-invitation-acceptance-view.test.tsx:243-245` and `team-invitation-acceptance-view.test.tsx:203`. Its callers (`owner :159,:167,:175,:188,:200`; `team :77,:170,:178,:187`) feed English server prose that `toApiError` **can never produce** — it always overwrites `message` with `GENERIC_API_ERROR_MESSAGE` (`api-client.ts:105`). Those cases are green while the branch they pin is dead in production. **A test that builds the value by hand instead of through the production path is the root cause of the false green.**

**Decision.** C1 adds the word `export` to `toApiError` in `apps/app-new/src/lib/api-client.ts` — a one-word change, no new file, no new layer — and both helpers are replaced by:

```ts
function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body)
}
```

Every fixture then passes through the real parser, so a test **cannot** express `message: 'Owner invitation has expired'` any more: the parser overwrites it. Fixtures become `apiErrorFrom(410, { errorCode: 'INVITATION_EXPIRED' })`, and an uncatalogued code silently drops exactly as it does in the browser.

C2's two new test files reuse the same export. That is C2's only dependency on C1 and it is satisfied by the stated reverse rollback order.

**Rejected — reshaping the helper to `{ status, message: GENERIC, errorCode }`.** Closer to reality but still hand-built, so the next contributor can widen it again. **Rejected — stubbing `global.fetch` and going through `apiRequest`.** Fully faithful, but it mutates a global inside files that already mock the service layer, and the ordering is fragile.

## Work units

| WU | Modify | Create |
|---|---|---|
| A | `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `apps/api/src/auth/guards/auth.guard.ts`, `apps/api/src/auth/use-cases/{get-current-user,refresh-session,verify-email,reset-password}.use-case.ts` | `apps/api/test/public-error-annotations.spec.ts` |
| B1 | `apps/api/src/team/use-cases/{validate-team-invitation,accept-team-invitation}.use-case.ts`, `apps/api/test/public-error-annotations.spec.ts` | — |
| B2 | `apps/api/src/owner-invitations/use-cases/{validate-owner-invitation,accept-owner-invitation}.use-case.ts`, `apps/api/test/public-error-annotations.spec.ts` | — |
| C1 | `apps/app-new/src/lib/api-client.ts` (one word), `apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.{tsx,test.tsx}`, `apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.{tsx,test.tsx}` | — |
| C2 | `apps/app-new/src/features/auth/components/{verify-email-view,reset-password-view}.tsx` | `apps/app-new/src/features/auth/components/{verify-email-view,reset-password-view}.test.tsx` |

### Forecasts, validated against the code

| WU | Sites | Proposal | Revised | Basis |
|---|---|---|---|---|
| A | 7 | 175–235 | **130–190** | catalog +11; spec ≈ 20; sites 14; new boundary spec ≈ 95. |
| B1 | 23 | 230–290 | **110–170** | validate 8 + accept 38 + 10 cases & guard ≈ 75. |
| B2 | 18 | 190–250 | **100–160** | validate 8 + accept 36 + 8 cases & guard ≈ 65. |
| C1 | — | 200–280 | **200–290** | 2 views ≈ 70 each; 2 test files ≈ 45 each; `export` 1. |
| C2 | — | 80–130 | **150–210** | 2 views ≈ 28; **two new test files** ≈ 150. |

Site counts confirmed exactly against source: auth.guard `:21,:29`; get-current-user `:21`; refresh-session `:23,:30`; verify-email `:23`; reset-password `:29` = **7**. validate-team `:23,:27,:31,:35` = 4; accept-team `:82,:104,:111,:123,:127,:158,:169,:173,:177,:181,:187,:191,:195,:199,:203,:207,:211,:215,:218` = 19 → **B1 = 23**. validate-owner `:31,:35,:39,:43` = 4; accept-owner `:110,:122,:140,:149,:155,:159,:163,:171,:175,:179,:183,:187,:191,:194` = 14 → **B2 = 18**. Total **48**. The four `BadRequestException` DTO throws in each accept file are correctly excluded.

**B1 and B2 forecasts revised down** because the proposal's numbers assume a multi-line wrapped literal; `apps/api` has no formatter, so it is 1-for-1 (ADR-1).

**C2 revised up and the proposal is wrong here**: no test file exists for `verify-email-view.tsx` or `reset-password-view.tsx`. Under Strict TDD the RED step must create both. The 80–130 forecast silently assumed existing files.

**C1 split trigger.** C1 is the only Medium-risk slice. If the measured diff exceeds **320** changed lines, split into `C1a` (team view + test) and `C1b` (owner view + test), with the `toApiError` export landing in `C1a`. Do not absorb an over-budget C1.

### Strict TDD per work unit

`NODE_ENV=production` is set on every command that asserts emission. It is belt-and-braces: the boundary spec injects `'production'` through the filter constructor, so the assertion holds regardless. The REFACTOR command re-runs at default `NODE_ENV` to prove the production setting leaked nothing.

**WU-A**

- RED — write the 11 catalog entries into `runtime-contract.spec.ts` (`expectedPublicErrorCodes`, prefix frozen at 14) and 4 boundary cases in the new `public-error-annotations.spec.ts`, then:
  `NODE_ENV=production pnpm --filter @viewpro/contracts test && NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts`
- GREEN — append the 11 codes, annotate the 7 sites, rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/auth.use-cases.spec.ts test/team-invitations.use-cases.spec.ts && pnpm --filter @viewpro/api typecheck`

**WU-B1**

- RED — append the team block (10 boundary cases + the two exhaustiveness guards) to `public-error-annotations.spec.ts`:
  `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts`
- GREEN — annotate the 23 team sites, rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/team-invitations.use-cases.spec.ts test/team.use-cases.spec.ts test/errors.e2e-spec.ts && pnpm --filter @viewpro/api typecheck`

**WU-B2**

- RED — append the owner block (8 boundary cases + the two exhaustiveness guards):
  `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts`
- GREEN — annotate the 18 owner sites, rerun the identical command unchanged.
- REFACTOR — `pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/owner-portal.use-cases.spec.ts && pnpm --filter @viewpro/api typecheck`

**WU-C1**

- RED — replace both `apiError` helpers with `apiErrorFrom` (ADR-4) and rewrite every existing fixture as `apiErrorFrom(status, { errorCode })`, then add the new per-code cases:
  `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx`
  The existing prose-matching cases must go RED at this step. **If they stay green, the helper replacement was not faithful — stop and fix the helper before touching the views.** That check is the whole point of C1.
- GREEN — add `export` to `toApiError`, add the code maps to both views, delete `const message = ...` and both `message.includes` branches; rerun the identical command unchanged.
- REFACTOR — `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts src/features/team-invitations src/features/owner-invitations && pnpm --filter next-shadcn-dashboard-starter typecheck`
- API-side production emission is proven by A/B1/B2; C1 asserts only the code → copy mapping. No `NODE_ENV=production` applies to the client suite.

**WU-C2**

- RED — create `verify-email-view.test.tsx` and `reset-password-view.test.tsx`, each rejecting through `apiErrorFrom(400, { errorCode: 'AUTH_TOKEN_INVALID' })` and asserting expired-link recovery copy rather than the generic string:
  `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/verify-email-view.test.tsx src/features/auth/components/reset-password-view.test.tsx`
- GREEN — branch on `AUTH_TOKEN_INVALID` before the `getApiErrorMessage(error)` fallback in both views (`verify-email-view.tsx:36`, `reset-password-view.tsx:51`); rerun the identical command unchanged.
- REFACTOR — `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib/api-client.test.ts && pnpm --filter next-shadcn-dashboard-starter typecheck`

## Consumer mapping: code → recovery copy intent

Copy intent, not final strings; the delta spec owns exact wording. "existing" marks copy already present that only changes trigger.

| Code | Status | Team acceptance view | Owner acceptance view |
|---|---|---|---|
| `INVITATION_NOT_FOUND` | 404 | Invalid link; check the URL or request a new invitation. No sign-in link. (existing 404 copy) | Same. (existing 404 copy) |
| `INVITATION_EXPIRED` | 410 | Expired; ask the agency to send a new link. No sign-in link. (existing, currently unreachable) | Same. (existing, currently unreachable) |
| `INVITATION_REVOKED` | 410 | No longer available; request a new invitation. No sign-in link. (existing generic 410) | Same. (existing generic 410) |
| `INVITATION_ALREADY_ACCEPTED` | 410 | Already accepted; **sign in** to continue. `showSignInLink`. (existing, currently unreachable) | Already accepted; **sign in** to reach the portal. `showSignInLink`. (existing, currently unreachable) |
| `INVITATION_EMAIL_MISMATCH` | 403 | Use the invited email; sign out and sign in with it. Names the mismatch, not the invitee's address. (existing 403 copy) | Same. (existing 403 copy) |
| `INVITATION_ALREADY_MEMBER` | 409 | Already a member of this agency; **sign in**. `showSignInLink`. (existing 409 copy, now correctly scoped) | Not reachable — omit from the owner map. |
| `INVITATION_EMAIL_ALREADY_REGISTERED` | 409 | **New**: the email already has an account; sign in with it instead of creating one. `showSignInLink`. Today this wrongly renders "you already belong to this agency". | Already registered; sign in. `showSignInLink`. (existing 409 copy) |
| `TENANT_USER_LIMIT_EXCEEDED` | 409 | **New**: the agency reached its user limit; ask an administrator to free a seat or upgrade. **No** sign-in link — signing in does not help. Today this wrongly renders "you already belong to this agency". | Not reachable — omit from the owner map. |
| `SESSION_EXPIRED` | 401 | **New**: the session expired mid-flow; sign in again and reopen the link. `showSignInLink`. Today this wrongly renders "check your password". | Same. |
| `INVITATION_INVALID_CREDENTIALS` | 401 | Wrong password for this invited email; retry or use password recovery. **No** account-existence wording. (existing 401 copy, now correctly scoped) | Same. |
| `AUTH_TOKEN_INVALID` | 400 | n/a | n/a |

`AUTH_TOKEN_INVALID` is consumed only by C2:

| View | Copy intent |
|---|---|
| `verify-email-view.tsx` | The verification link is invalid or expired; sign in and request a new verification link from the dashboard. Replaces today's production string `Invalid request payload`. |
| `reset-password-view.tsx` | The reset link is invalid or expired; request a new one from "forgot password". **Must not** ask the user to check the password they just typed — that is the present harm. |

The three 409 states are the sharpest win: today all three render one panel (`team-invitation-acceptance-view.tsx:587`), so two of three show actively wrong copy and one of those (`TENANT_USER_LIMIT_EXCEEDED`) offers a sign-in link that cannot resolve the problem.

## Rollback

Reverse order, each step self-contained and independently deployable.

| Step | Revert touches | Restores | Why this order |
|---|---|---|---|
| 1. C2 | `verify-email-view.tsx`, `reset-password-view.tsx`, delete `verify-email-view.test.tsx`, `reset-password-view.test.tsx` | `getApiErrorMessage(error)` → generic string, today's behavior | Must precede C1: its test files import the `toApiError` export C1 added. |
| 2. C1 | `api-client.ts` (drop `export`), both `*-acceptance-view.tsx`, both `*-acceptance-view.test.tsx` | Status-only ladder plus the two dead `message.includes` branches, i.e. exactly current production | Must precede B1/B2: the views' code maps reference codes the annotations produce. Dropping the `export` is safe only once C2 is gone. |
| 3. B2 | `validate-owner-invitation.use-case.ts`, `accept-owner-invitation.use-case.ts`, owner block in `public-error-annotations.spec.ts` | Owner sites emit no `errorCode` | Independent of B1. |
| 4. B1 | `validate-team-invitation.use-case.ts`, `accept-team-invitation.use-case.ts`, team block in `public-error-annotations.spec.ts` | Team sites emit no `errorCode` | Independent of B2. |
| 5. A | `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `auth.guard.ts`, `get-current-user.use-case.ts`, `refresh-session.use-case.ts`, `verify-email.use-case.ts`, `reset-password.use-case.ts`, delete `public-error-annotations.spec.ts` | 14-code catalog | **Last, necessarily.** Reverting the catalog while B1/B2/C1 stand leaves `errorCode: 'INVITATION_EXPIRED'` literals with no catalog member: `packages/contracts` typecheck breaks on the views' `satisfies Partial<Record<PublicErrorCode, ...>>` maps, `runtime-contract.spec.ts` exact-equality fails, and any surviving producer emits a string the client guard silently drops — a wordless panel instead of a generic one. |

Partial-deploy safety in both directions: an annotated API in front of an un-updated client is harmless (the client guard drops unknown codes and the status ladder still fires); an updated client in front of an un-annotated API is harmless (no code present, status ladder fires). No data migration, no flag flip, no coordinated release.

## Threat / applicability matrix

| Boundary | Applicability / safe failure / RED |
|---|---|
| Enumeration on open endpoints | **Applicable — unchanged by design.** `login.use-case.ts:35` and `register-tenant.use-case.ts:52` take an attacker-supplied email on an unauthenticated endpoint and stay deliberately un-annotated and vague. RED: the WU-A exhaustiveness guard runs only over the seven files this change touches, so it can never pull `login`/`register-tenant` into scope; a reviewer seeing either file in a diff must reject the slice. |
| Enumeration on token-gated endpoints | **Applicable — bounded.** Invitation `email` is server-read from `invitation.email` and never attacker-supplied, so a code discloses only to someone already holding the secret token. RED: no annotated site derives its code from request input; the code is a literal chosen by the branch, so no request value can select a disclosure. |
| Leaked-token password oracle (`INVITATION_INVALID_CREDENTIALS`) | **Applicable — accepted residual, sharpened.** Verified: both accept endpoints carry `@UseGuards(AuthThrottlerGuard)` + `@Throttle(toThrottleOptions(authRateLimit.register))` (`team-invitations-public.controller.ts:38-39`, `owner-invitations.controller.ts:48-49`), and `getAuthRateLimitConfig()` defaults `register` to `limit: 3`, `ttlSeconds: 60` (`app.config.ts:47-50`). **Refinement the proposal did not state**: `AuthThrottlerGuard` overrides `getTracker` to key by `ip:path:email` (`apps/api/src/auth/guards/auth-throttler.guard.ts:6-14`), not by invitation token. The email component isolates targets from one another, but the `ip` component means the bound is 3 attempts per 60 s *per source address*, not per invitation. An attacker holding a leaked token and rotating addresses is not bounded by this control. The decision to ship the code stands (proposal, resolved decision 1); the residual is recorded at its true strength rather than overstated. Mitigating context: the same attacker can already reach the identical oracle through `/auth/login`, which is rate-limited at 5/60 s — so this code adds no capability an attacker lacks. |
| Production-only sanitization trap | **Applicable — primary risk.** `sanitizeProductionMessage` runs only at `nodeEnv === 'production'` (`:87`), so the default suite cannot observe the failure mode. RED: every boundary case asserts `message` equals the sanitized constant **and** `errorCode` equals the expected code in the same assertion, under a filter constructed with `'production'`; every emission command is additionally prefixed `NODE_ENV=production`. A case that asserts only `errorCode` is incomplete and must be rejected in review. |
| Unvalidated `errorCode` on the legacy branch | **Applicable — contained downstream.** The legacy branch forwards `body.errorCode` verbatim without `isPublicErrorCode` (`:54`); only the enabled branch validates (`:77`). Containment is client-side at `api-client.ts:100`, so a view can never observe an uncatalogued code. RED: `errors.e2e-spec.ts:13` already pins `['unknown-code', 'REQUEST_FAILED']`, and `api-client.test.ts` already covers the drop. Consequence to accept: an annotation shipped ahead of its catalog entry is invisible, not dangerous — which is precisely why A must precede B1/B2. |
| False-green view tests | **Applicable — a live defect today.** Two hand-built `apiError` helpers pin behavior production cannot reach (ADR-4). RED: at C1's RED step the pre-existing prose-matching cases **must fail**. A green RED step here means the helper was replaced unfaithfully and the same class of dead test was reintroduced; stop and fix the helper. |
| Catalog exact-equality coupling | **Applicable — same-change edit.** `runtime-contract.spec.ts:73-76` asserts the full tuple plus a prefix. RED: appending 11 codes without editing `expectedPublicErrorCodes` fails `:73` immediately, in the same slice, before any producer work. The prefix assertion freezes at the existing 14 so the first 14 stay order-locked forever. |
| Legacy `error` field degradation | **Applicable — precedent-consistent.** Annotated sites drop `error: 'Unauthorized'` in favour of the filter default `'Error'` (`:52`), exactly as the 13 established codes already do. RED: repository grep before each GREEN confirms no API-side test and no consumer binds `error` for these routes; `api-client.ts` never reads it. |
| Documentation-like paths | N/A — no repository file classification or execution in this change. |
| Git repository / commit / push / PR state | N/A — no operational smoke, deployment, or PR automation; unlike the parent change, this one is 100% repository lines with no environment-bound evidence step. |

## Residuals and follow-ups

| Item | Disposition |
|---|---|
| Register-tenant 409 leaks account existence by status alone | Pre-existing; not fixable by annotation. Documented residual (proposal, out of scope). |
| Staff-side team invitation lifecycle (`create:51`, `resend:44,48`, `revoke:26,30`) | 5 sites, no consumer in scope. Follow-up (resolved decision 4). |
| Wider App New dead-branch class | Issue #374. |
| `throwForInvitationState` dedup across the three duplicated availability ladders per bounded context | Follow-up; deliberately not bundled with a contract change (ADR-1). |
| `AuthThrottlerGuard` keys by `ip:path:email`, not by invitation token | Recorded above. Rotating source addresses yields fresh buckets. A per-token limiter on invitation accept would close the residual properly; out of scope here. |
