# Proposal: Platform A3 Slice 2 — Shorter Idle-Timeout for the Operator Session

**Change id**: `platform-operator-idle-timeout`
**Store**: `openspec/changes/platform-operator-idle-timeout/proposal.md` (+ Engram `sdd/platform-operator-idle-timeout/proposal`)
**Vision**: A3 (operator-lane hardening), Slice 2 — reinforcement schedule row "Shorter idle-timeout for the platform session". Sibling slice `platform-step-up-reauth` is shipped; MFA is scheduled separately.
**Grounded in**: explore `sdd/explore/operator-idle-timeout`; code read of `viewpro-app/apps/viewpro-api` auth lane and `viewpro-app/apps/viewpro-web` session/api plumbing.

---

## 1. Intent

**Problem / why now.** The operator console is the single most-privileged surface in the system — one session governs **all tenants** (suspend, cancel, re-limit). Today an operator access token is signed **once** at login with a fixed `exp = iat + 900s` (`ACCESS_TOKEN_TTL_SECONDS`) and is never re-issued or refreshed. Within that window an **unattended or left-open** operator session stays fully live; there is no notion of "the human walked away". A3 requires the platform session to die on inactivity, not merely on a fixed clock, while still capping total session length so a session can never be renewed forever.

**Success.** The access token becomes a **rolling idle deadline**: each authenticated request re-issues it with a fresh `exp = now + IDLE_TIMEOUT_SECONDS` (600s), so 10 minutes of true inactivity expires the session — but the token also carries an **absolute deadline** (session-start / absolute-expiry) carried forward unchanged on every re-sign, so no session outlives `ABSOLUTE_SESSION_SECONDS` (28800s / 8h) regardless of activity. `AuthGuard` rejects (401, clears both cookies) when **either** the sliding `exp` is past **or** `now > absolute deadline`. The FE handles a mid-action expiry cleanly: any 401 from the api-client redirects to operator sign-in with a "sesión expirada" indication.

**Doc drift to correct.** `apps/viewpro-web/docs/auth.md` references a non-existent `/auth/refresh` and memberships from the old shared-login app; vision A2 ("shared login, no separate identity table") is stale versus the shipped Design-B isolation (`viewpro-api`/`viewpro-web`, own `Operator` table). This change targets the **actual** system and corrects `auth.md` as an in-change cleanup.

---

## 2. Scope

### In scope
1. **viewpro-api — config surface.** New `IDLE_TIMEOUT_SECONDS` (default 600) and `ABSOLUTE_SESSION_SECONDS` (default 28800) in `env.schema.ts` + `app.config.ts`, following the existing `ACCESS_TOKEN_TTL_SECONDS`/`STEP_UP_TTL_SECONDS` pattern. `ACCESS_TOKEN_TTL_SECONDS` is **reconciled**: the access token's `exp` is now driven by the idle timeout (600s), so the old 900s TTL is effectively replaced/reframed by `IDLE_TIMEOUT_SECONDS` (final treatment — remove vs. alias — is a design detail).
2. **viewpro-api — absolute-deadline claim.** The access-token payload gains a session-anchored claim (e.g. `sessionExp` / `sessionStart`) minted at **login** and **carried forward unchanged** on every re-sign. The sliding `exp` moves; the absolute deadline never does.
3. **viewpro-api — `AuthGuard` re-issue on activity + dual-deadline rejection.** On a successful auth, re-sign and `Set-Cookie` the access token with `exp = now + IDLE_TIMEOUT_SECONDS`, preserving the absolute claim. Reject (401 + `clearBothCookies`) when the sliding `exp` is past **or** `now > absolute deadline`. `AuthGuard` already reaches the response object (`clearBothCookies`) — the same seam re-issues on success.
4. **viewpro-api — threshold-based re-sign (churn control).** Re-issue only when more than a set fraction of the idle window has elapsed since the token's `iat` (not on literally every request). Chosen churn-control approach; exact fraction finalized in design. This is not a reopening of rolling-token-vs-store.
5. **viewpro-web — global 401 handling (required).** Add reactive global handling so **any** 401 from the api-client (tenants / audit / limits, not just `GET /auth/me`) triggers a clean redirect to operator sign-in with a neutral/professional Spanish "sesión expirada" indication matching existing console copy. No proactive countdown.
6. **Doc cleanup.** Correct `apps/viewpro-web/docs/auth.md` (drop `/auth/refresh` + memberships; describe the actual rolling-idle model).

### Out of scope
- **Proactive client idle-warning / countdown UI** — polish, deferred. Handling is purely reactive (401 → redirect).
- **Server-side session store (Redis/DB)** — rejected: contradicts the deliberate stateless design; `Operator` has no session fields. No migration.
- **MFA / TOTP** — separately deferred A3 slice.
- **Step-up window** — its cookie stays **fixed** and independent (see §5). Not rolled by activity.
- **Any change to tenant/client sessions** (`apps/api` / InmoView lane) — operator-only.

## Capabilities

### New Capabilities
- `operator-idle-timeout`: the rolling access-token idle deadline, the absolute-deadline claim carried across re-signs, `AuthGuard` re-issue-on-activity + dual-deadline (idle **or** absolute) rejection, threshold-based re-sign churn control, the new config surface, and the FE global-401 → sign-in redirect.

### Modified Capabilities
- None at the requirement level. If a formal operator-auth spec exists at design time, the fixed-TTL access-token behavior is superseded by the rolling model; otherwise this is a new capability. No existing spec requirement for step-up, platform-control, or audit changes.

## 3. Approach & rationale

**Approach A — server-side rolling access token (sliding `exp`) enforced in `AuthGuard`, plus minimal reactive FE 401 handling.** The token IS the security boundary; the server owns idle enforcement. The absolute-deadline claim prevents infinite renewal. FE handling is non-authoritative UX. Chosen because it adds **zero** server-side session state (matches the stateless-JWT model and the step-up precedent), reuses the existing sign/verify/cookie plumbing, and keeps the guard as the single enforcement point.

**Rejected.** (C) Redis/DB session store — contradicts the deliberate stateless design, adds infra with no other stated need, requires an `Operator` schema/session change. (B-proactive) client countdown timer — deferred polish, not a security boundary.

## 4. Acceptance criteria

1. A request after **> `IDLE_TIMEOUT_SECONDS`** of inactivity → 401, **both cookies cleared**, no mutation.
2. Activity **within** the idle window → request succeeds and the access cookie is re-issued with a fresh sliding `exp` (subject to the re-sign threshold).
3. A session active past **`ABSOLUTE_SESSION_SECONDS`** → 401 even under continuous activity; the absolute deadline is **not** extended by re-signs.
4. The absolute-deadline claim minted at login is **byte-identical** across every re-sign of the same session.
5. Re-signing happens **only** past the configured threshold fraction of the idle window — not on every request (verifiable via `Set-Cookie` presence/absence).
6. The **step-up** cookie TTL (300s) is **unaffected** by access-token activity/re-issue — it is never rolled (invariant, §5).
7. **Any** 401 from the api-client (tenants/audit/limits, not only `/auth/me`) → clean redirect to operator sign-in with a "sesión expirada" indication.
8. On a re-issue response that **also** clears cookies (a rejection path), there is **no conflicting `Set-Cookie`** — reject wins; the guard never both clears and re-issues.
9. A token lacking the absolute-deadline claim is **treated as expired** (rejected), not grandfathered — the feature is not yet deployed (§7 R6).
10. **No DB migration, no platform-contract change, no `apps/api` change** — operator-only (`viewpro-api` + `viewpro-web`); the distinct-secrets boot guard is unchanged.

## 5. Invariants

- **Step-up cookie stays FIXED and independent.** TTL 300s, **never** rolled by activity. Rolling it would erode the just-shipped step-up guarantee (a fresh "still you?" proof must decay on wall-clock time, not on general session activity). Explicit invariant.
- **Distinct-secrets boot guard unchanged.** Access and step-up secrets stay separate; this change touches neither.
- **Statelessness preserved.** No `Operator` session fields, no store, no migration.

## 6. Delivery & migrations

**No DB migration, no platform-contract change, no `apps/api` change.** Anticipated split into **2 chained PRs**:
- **WU-1 (viewpro-api)** — config (`IDLE_TIMEOUT_SECONDS`, `ABSOLUTE_SESSION_SECONDS`, reconcile `ACCESS_TOKEN_TTL_SECONDS`), absolute-deadline claim, `AuthGuard` re-issue-on-activity + dual-deadline rejection, threshold-based re-sign, backend tests for **both** deadlines.
- **WU-2 (viewpro-web)** — global 401 → sign-in redirect with "sesión expirada"; `auth.md` doc cleanup (doc cleanup may ride either WU; grouped with FE).

WU-2 depends on WU-1's runtime behavior (sessions will start expiring mid-action once WU-1 ships), so WU-2 should land promptly after WU-1. Both are small.

## 7. Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| R1 — cookie churn: `Set-Cookie` on every response inflating traffic/log noise | Med | Threshold-based re-sign (§2.4) — re-issue only past a fraction of the idle window, not per request (AC5). |
| R2 — rolling-token bug silently **not** renewing → session dies early, inconsistent FE errors across features | Med | New **global** 401 handling (AC7) turns any silent expiry into one clean redirect instead of scattered raw errors; both-deadline tests (AC1–2). |
| R3 — clock skew on the absolute-deadline check (server drift) | Low | Use server time consistently for both `exp` and absolute checks; no client-supplied time; document tolerance in design. |
| R4 — tests cover only the idle path, missing the absolute cap (or vice-versa) | Med | Acceptance mandates **both** deadlines (AC1 idle, AC3 absolute, AC4 claim-stability); reuse the `buildExpiredToken` pattern; add a second anchored-claim fixture. |
| R5 — conflicting `Set-Cookie`: a response that re-issues **and** clears cookies | Med | Guard rejects-or-reissues, never both (AC8); reject path wins and only clears. |
| R6 — backward-compat: already-issued tokens lack the absolute-deadline claim | Low | **Treat-as-expired** (reject), not grandfather — feature not yet deployed, so no live sessions to preserve (AC9). |
| R7 — step-up cookie accidentally rolled alongside access re-issue, eroding step-up guarantee | Low | Explicit invariant (§5); re-issue touches the access cookie only (AC6). |
| R8 — reconciling `ACCESS_TOKEN_TTL_SECONDS` breaks an existing consumer/config assumption | Low | Idle timeout drives `exp`; keep or alias the old var during design; no external contract reads it. |

## 8. Rollback

Revert `AuthGuard` to verify-only (no re-issue, fixed `exp = iat + ACCESS_TOKEN_TTL_SECONDS`); drop the absolute-deadline claim and the two new env vars; remove the FE global-401 handler (leaving the existing `/auth/me`-only path). Stateless — no data migration to reverse. `auth.md` cleanup is documentation-only and can stay. Fully reversible.

## 9. Open sub-questions for spec/design

1. Exact re-sign threshold fraction of the idle window (e.g. re-issue past 50%) — cost/freshness tradeoff.
2. Final treatment of `ACCESS_TOKEN_TTL_SECONDS`: remove, or alias to `IDLE_TIMEOUT_SECONDS`.
3. Claim shape/name for the absolute deadline (`sessionExp` absolute timestamp vs. `sessionStart` + derived) and how it rides the payload type.
4. Whether the FE distinguishes "session expired" (→ sign-in) from other 401s, and the precise Spanish copy string / placement matching existing console copy.
5. Clock-skew tolerance (if any) on the absolute-deadline comparison.

## 10. Next recommended

`sdd-spec` and `sdd-design` can run in parallel from this proposal.
