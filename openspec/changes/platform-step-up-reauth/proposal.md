# Proposal: Platform A3 Slice 2 — Step-up Re-authentication for Destructive Operator Actions

**Change id**: `platform-step-up-reauth`
**Store**: `openspec/changes/platform-step-up-reauth/proposal.md` (+ Engram `sdd/platform-step-up-reauth/proposal`)
**Vision**: A3 (operator-lane hardening), Slice 2. MFA is the sibling slice, scheduled separately.
**Grounded in**: explore #5899; code read of `apps/viewpro-api` auth + platform-control lanes and `apps/viewpro-web` tenants feature.

---

## 1. Intent

**Problem / why now.** An operator's `viewpro_platform_access_token` session lasts 15 min and, once minted, silently authorizes every destructive tenant action. A hijacked or left-open operator session can therefore **suspend, cancel, or re-limit any tenant** with no second proof that a human is still at the keyboard. A3 requires that high-impact tenant actions demand a fresh "still you?" check, not just a valid session cookie.

**Success.** Before **suspend** (ACTIVE→SUSPENDED), **cancel** (→CANCELLED), or **change-limits**, the operator must re-enter their current password. On success the backend issues a short-lived, reusable "sudo" proof; the three destructive endpoints reject any request lacking that proof. Non-destructive **reactivate** (SUSPENDED→ACTIVE) is untouched, and the legacy InmoView `/admin` lane is untouched.

**Doc drift to correct.** Vision A2 implies operator credentials may be shared with tenant users. The code already fully separates them (`apps/viewpro-api` owns its `Operator` table + Argon2 hashing). Step-up re-verification is therefore a **pure local operation** — no InmoView call. The design phase should note this correction.

---

## 2. Scope

### In scope
1. **viewpro-api — `POST /auth/step-up`.** Behind the existing `AuthGuard` (operator must already be logged in). Re-verifies the operator's **current password** locally, reusing the `OPERATOR_REPOSITORY` + `PASSWORD_HASHER` (Argon2) DI already wired in `AuthModule`. On success sets a second httpOnly cookie (`viewpro_platform_stepup_token`) carrying a JWT `{ sub, stepUp:true, exp }`, ~5 min TTL. Wrong password → 401, no cookie.
2. **viewpro-api — `StepUpGuard`.** New guard verifying the step-up cookie's signature + expiry and that `payload.sub === request.user.id`. **Additive** — applied *alongside* `AuthGuard`, never replacing it. Exported from `AuthModule` (mirrors the existing `AuthGuard` export consumed by `PlatformControlModule`).
3. **viewpro-api — gate the 3 destructive routes.** `PATCH /operators/tenants/:id/status` (only when target is SUSPENDED or CANCELLED) and `PATCH /operators/tenants/:id/limits` gain `StepUpGuard`. Reactivate (target ACTIVE) stays ungated.
4. **viewpro-api — token/cookie plumbing + config.** `TokenService` gains step-up sign/verify + cookie set/clear parallel to the access-token methods. New env: `STEP_UP_TOKEN_SECRET` + `STEP_UP_TTL_SECONDS` (separate secret for clean rotation).
5. **viewpro-api — cookie hygiene.** `logout()` and `AuthGuard`-failure/clear paths expire **both** cookies symmetrically, so no stale step-up cookie outlives a rotated session.
6. **viewpro-web — step-up prompt + threading.** Prompt for password before a destructive action when no fresh step-up exists (skip when one is still valid); thread it through the existing status/limits mutations. Exact placement (field inside `tenant-status-confirm-dialog.tsx` / `tenant-limits-dialog.tsx` vs. a shared step-up modal triggered on `STEP_UP_REQUIRED`) is a **design decision**.

### Out of scope
- **MFA / TOTP** — sibling A3 slice. The `/auth/step-up` contract is designed so swapping password→MFA later changes only the endpoint's **request body**, not the guard, cookie, or FE threading.
- **Idle-timeout / single-use tokens** — the window is deliberately reusable (see §5).
- **Legacy `/admin` lane** (`apps/api`) — operator-console lane only, consistent with how CANCELLED was scoped operator-only.
- **Reactivate** (SUSPENDED→ACTIVE) — not destructive, not gated.

## Capabilities

### New Capabilities
- `operator-step-up-auth`: the `POST /auth/step-up` endpoint, the step-up JWT/cookie, `StepUpGuard`, its application to the 3 destructive routes, cookie-hygiene symmetry, and the FE step-up prompt/threading.

### Modified Capabilities
- None. The existing operator-auth and platform-control behaviors are extended additively (a second guard, a second cookie); no existing requirement changes.

## 3. Approach & rationale

**Approach 1 — dedicated endpoint + second short-lived httpOnly cookie** (explore recommendation). Re-verify password locally, issue a stateless `stepUp:true` JWT cookie, enforce with an additive `StepUpGuard`. Chosen because it: adds **zero server-side session state** (matches the pure stateless-JWT model + the `mintServiceToken` time-bound-token precedent); reuses 100% of login DI; and keeps a stable guard/cookie seam so the MFA slice only swaps the endpoint body. Cookies ride `credentials:'include'` automatically — no FE header plumbing.

**Rejected.** (2) Inline password in each destructive DTO — couples "prove human" to every call, no reuse across two quick actions, and every DTO must change when MFA lands. (3) Server-side `lastStepUpAt` stamp — introduces the first piece of session state into an otherwise stateless system.

## 4. Acceptance criteria

1. `POST /auth/step-up` with the **correct current password** → 200 and sets the step-up cookie. Wrong password → 401, **no cookie**. Unauthenticated (no valid access cookie) → 401.
2. A destructive endpoint (suspend / cancel / limits) **without** a valid step-up cookie → 401/403: blocked, **no mutation**, **no outbox event / no service-token call** to InmoView.
3. Same endpoint **with** a fresh step-up cookie → proceeds with existing behavior intact (terminality guards, audit, outbox).
4. The step-up cookie is **reusable** across multiple destructive actions within the 5-min window, and is **rejected after expiry** (re-prompt required).
5. A step-up minted for operator A (`sub=A`) is **rejected** on a request authenticated as operator B — the guard binds `payload.sub === request.user.id`.
6. **Reactivate** (SUSPENDED→ACTIVE) succeeds with **no** step-up cookie.
7. `logout()` clears **both** the access-token and step-up cookies; an `AuthGuard`-failure clear path leaves no stale step-up cookie.
8. FE prompts for password before each destructive action **unless** a fresh step-up is still valid, and threads it through the existing status/limits mutations.
9. **Operator-lane only**: the legacy `/admin` lane and its DTOs are unchanged.
10. **No schema migration / no contract change** — `Operator.passwordHash` already exists; the step-up cookie is stateless (confirm during design).

## 5. Key decision — reusable 5-min "sudo" window

**Locked: 5-minute, reusable (not single-use) window.** Consecutive destructive actions within 5 min do **not** re-prompt (edit limits, then suspend the same tenant, without re-typing). **Tradeoff, stated explicitly:** a hijacked *step-up* cookie widens blast radius for up to 5 min versus a single-use token. Accepted because it mirrors the codebase's existing time-bound-not-single-use service-token precedent and keeps operator UX sane. Too long would degrade into a weaker copy of the 15-min session TTL; too short frustrates multi-step operations.

## 6. Delivery & migrations

- **No DB migration, no platform-contract change expected** (confirm at design). Spans **two apps** → likely **2 chained PRs**: PR#1 viewpro-api (endpoint + guard + config + cookie hygiene); PR#2 viewpro-web (step-up prompt + mutation threading). PR#2 depends on PR#1's contract.
- **Deploy order.** Ship the backend guard/endpoint first; the FE prompt follows. Between the two, destructive actions would 401 until the FE threads step-up — so PR#2 must land promptly after PR#1 (or feature-flag the guard).

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — reusable-window blast radius (hijacked step-up cookie acts for ≤5 min) | Med | Explicit accepted tradeoff (§5); short 5-min TTL; httpOnly + `sameSite` + `secure`; bind `sub`. |
| R2 — stale step-up cookie outliving a rotated/expired session | Med | Clear **both** cookies symmetrically on logout and on AuthGuard-failure clear paths (AC7). |
| R3 — StepUpGuard mistaken as an AuthGuard bypass | Low | Guard is **additive** — both guards apply; StepUpGuard never authenticates, only proves freshness. |
| R4 — cross-operator reuse (A's step-up used by B) | Low | Guard checks `payload.sub === request.user.id` (AC5). |
| R5 — replay / CSRF on the new cookie | Low | httpOnly (no JS read), `sameSite:lax`, `secure` per env, short exp; reuse the access-cookie's existing hardening. |
| R6 — deploy gap: backend gates before FE threads step-up | Med | Chain PRs tightly or feature-flag the guard; §6 deploy order. |
| R7 — MFA seam leaks into guard/cookie (future rework) | Low | Contract designed so only `/auth/step-up` body changes when MFA lands; guard/cookie/FE-threading stay put. |

## 8. Rollback

Remove `StepUpGuard` from the 3 routes (destructive actions revert to AuthGuard-only — prior behavior), leave `POST /auth/step-up` inert or remove it, drop the step-up env vars. No data migration to reverse (stateless cookie). FE: hide/disable the step-up prompt. Fully reversible with no persistent state.

## 9. Open sub-questions for spec/design

1. FE placement: password field inside the existing confirm/limits dialogs vs. a shared step-up modal triggered on a `STEP_UP_REQUIRED` (401/403) response — which minimizes duplication and best supports 5-min skip?
2. Blocked-response contract: 401 vs 403, and a machine-readable code (e.g. `STEP_UP_REQUIRED`) so the FE distinguishes "session expired" (→ sign-in) from "step-up needed" (→ prompt).
3. Cookie name/attributes and whether `STEP_UP_TOKEN_SECRET` is a distinct secret (proposed) vs. `ACCESS_TOKEN_SECRET` + a distinct claim.
4. Should `StepUpUseCase` reuse the login enumeration-guard (constant-time dummy hash) or skip it, since the operator is already authenticated?
5. Confirm status-target gating precisely: step-up required only for SUSPENDED/CANCELLED targets on `PATCH :id/status`, ACTIVE target exempt.

## 10. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
