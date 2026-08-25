# Proposal: Actionable Auth and Invitation Errors (issue #285)

## Intent

Production collapses every recoverable 401/403/409/410 to `Request failed` (`global-exception.filter.ts:87`) and `api-client.ts:105` discards server prose. The `message.includes('expired'|'accepted')` branches in both acceptance views are therefore **dead code in production today**: expired, revoked, already-accepted, wrong-email, tenant-limit and session-expired all render one generic panel, and a user whose session expired mid-accept is told to check their password. Emit catalog `errorCode` values and branch on them.

## Scope

### In Scope
- Append 11 codes to `PUBLIC_ERROR_CODES` (14 → 25) and update `packages/contracts/test/runtime-contract.spec.ts`.
- Annotate **48 verified throw sites** in `apps/api` auth, team-invitations, owner-invitations, plus `verify-email.use-case.ts:23` and `reset-password.use-case.ts:29`.
- Replace message matching with `errorCode` branching in both acceptance views, and add `errorCode` branching to `verify-email-view.tsx` and `reset-password-view.tsx`.
- Tests at package, API (forced production mode), and App New layers.

### Out of Scope (explicitly not solved here)
- `login.use-case.ts:35`, `register-tenant.use-case.ts:52` stay vague (enumeration protection).
- Register-tenant 409 existence leak: documented pre-existing residual.
- Staff RBAC `Insufficient permissions`; 400-level DTO validation other than the two token-state sites above.
- Staff-side team invitation lifecycle (`create:51`, `resend:44,48`, `revoke:26,30`) — 5 sites with no consumer in this scope; deferred as follow-up.
- The wider dead-branch class in App New (`status-change-requests`, `product-form`, `property-agents-section`, `property-owner-section`) — tracked by issue #374. Only the four invitation branches stay here.
- `apps/viewpro-api` / `apps/viewpro-web` — separate bounded context; #372 is not a dependency.

## Code set (strict append after `REQUEST_FAILED`)

`SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`.

One shared `INVITATION_*` set (the route already carries team vs owner). `INVITATION_INVALID_CREDENTIALS` is actionable by maintainer decision: the email is bound to the secret token, and both accept endpoints already run `AuthThrottlerGuard` with `authRateLimit.register` (3 attempts / 60 s default). `INVITATION_ALREADY_MEMBER` is added beyond the agreed list because three distinct 409s currently collapse into one wrong panel.

`AUTH_TOKEN_INVALID` is one shared code for both `verify-email.use-case.ts:23` and `reset-password.use-case.ts:29`, by the same rule that keeps `INVITATION_*` shared: each view already knows which flow it renders and supplies its own recovery copy. It deliberately does not separate invalid from expired, matching the existing collapsed message. These two are 400-level, unlike the rest of the set; they are in scope because they are the same class — token-bound, recoverable, safe to disclose — and today production renders them as `Invalid request payload`, which misleads the user into retyping a correct password against an expired link.

## Capabilities

### New Capabilities
- `actionable-auth-errors`: session and invitation states emit stable public codes; the acceptance consumers map code → recovery copy.

### Modified Capabilities
- `safe-public-error-boundary`: `Canonical public error catalog` freezes the exact 14-code tuple and forbids auth/invitation codes; `Focused tolerant direct consumer` forbids changing invitation copy/recovery. Both need deltas.

## Approach

No dependency on `PUBLIC_ERROR_ENVELOPE_ENABLED`: the legacy branch (`global-exception.filter.ts:54`) forwards `errorCode` verbatim in every environment and 13 codes already ship that way. Producers throw `new XException({ errorCode, message })`. The client `isPublicErrorCode` guard (`api-client.ts:100`) is the enforcement point, so catalog growth strictly gates the view slices.

## Work units

| WU | Scope | Sites | Forecast | Budget risk |
|---|---|---|---|---|
| A | Catalog (11 codes) + `SESSION_EXPIRED`; `auth.guard` (2), `get-current-user` (1), `refresh-session` (2); `AUTH_TOKEN_INVALID`: `verify-email` (1), `reset-password` (1); package + production-mode API tests | 7 | 175–235 | Low |
| B1 | Team recipient: `validate` (4) + `accept` (19) | 23 | 230–290 | Low |
| B2 | Owner recipient: `validate` (4) + `accept` (14) | 18 | 190–250 | Low |
| C1 | Both invitation acceptance views + their tests | — | 200–280 | Medium |
| C2 | `verify-email-view.tsx` and `reset-password-view.tsx` + tests | — | 80–130 | Low |

Order: A → B1 → B2 → C1 → C2. Each is independently revertable; unknown codes are ignored by the client guard. The exploration's single WU-B (355–455) exceeded the 400-line budget and is split; its WU-C forecast (80–150) was too low.

C2 exists because both token-flow views currently call `getApiErrorMessage(error)` (`verify-email-view.tsx:36`, `reset-password-view.tsx:51`), which yields the generic string. Adding `AUTH_TOKEN_INVALID` without touching them would change nothing a user can see.

Staff-side team lifecycle annotation (5 sites) was considered and dropped: it has no consumer in this scope, so it would ship contract surface with no user-visible benefit. Recorded as a follow-up.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/contracts/src/index.ts` | Modified | +11 codes |
| `packages/contracts/test/runtime-contract.spec.ts` | Modified | Exact-equality tuple; freeze prefix at 14 |
| `apps/api/src/{auth,team,owner-invitations}` | Modified | 48 throw-site annotations |
| `apps/api/test/errors.e2e-spec.ts` | Modified | Production-mode legacy `errorCode` survival |
| `apps/app-new/src/features/{team,owner}-invitations/components/*-acceptance-view.tsx` | Modified | `errorCode` branching |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Green suite, broken production (`sanitizeProductionMessage` is production-only) | High | Every WU must assert with `NODE_ENV=production`; the harness exists at `errors.e2e-spec.ts:322`. |
| Leaked/forwarded token turns `INVITATION_INVALID_CREDENTIALS` into a password oracle | Low | Accepted; rate limit 3/60 s on both accept endpoints; recorded as residual. |
| Legacy branch forwards `errorCode` without catalog validation | Low | Client guard filters; e2e covers unknown → ignored. |
| Catalog exact-equality test breaks other packages | Low | Same-change edit; e2e cases derive from the catalog automatically. |

## Rollback Plan

Revert in reverse order C2 → C1 → B2 → B1 → A. Reverting a view slice restores status-only branching (current production behavior). Reverting the catalog requires all annotation slices reverted first, otherwise producers reference absent codes. No data migration, no flag flip.

## Dependencies

None. `PUBLIC_ERROR_ENVELOPE_ENABLED` is not required. Issue #372 is not a dependency.

## Success Criteria

- [ ] Catalog is exactly 25 codes; first 14 unchanged and order-frozen.
- [ ] With `NODE_ENV=production`, each of the 48 sites returns its code and no prose.
- [ ] Expired, revoked, already-accepted, email-mismatch, already-member, email-registered, tenant-limit and session-expired each render distinct recovery copy in both views.
- [ ] A session expiry during accept no longer shows credential copy.
- [ ] No `message.includes(...)` remains in either acceptance view.
- [ ] Every WU under 400 changed lines.

## Resolved decisions

All open questions are closed. Do not re-open them.

1. **Invitation-scoped login is actionable.** `INVITATION_INVALID_CREDENTIALS` exists. The email is bound to the secret token rather than attacker-supplied, and both accept endpoints already enforce `AuthThrottlerGuard` with `authRateLimit.register` (3 attempts per 60 s), so a leaked token yields no practical password oracle. Residual risk accepted and recorded.
2. **Invitation codes are shared** across team and owner. The consumer already knows the invitation type from its route and view, so the code must not duplicate it. Same rule governs `AUTH_TOKEN_INVALID`.
3. **`INVITATION_ALREADY_MEMBER` stays.** Three distinct 409s render one panel today (`team-invitation-acceptance-view.tsx:587`), so two of the three show actively wrong copy. Evidence of present harm outweighs catalog economy.
4. **Staff-side lifecycle is dropped** from this change. Five sites, no consumer in this scope. Follow-up.
5. **`verify-email` and `reset-password` are in.** Same class as the invitation states — token-bound, recoverable, safe to disclose — and today production tells the user their payload is invalid when their link merely expired.
6. **`INVITATION_ALREADY_ACCEPTED` and `INVITATION_ALREADY_MEMBER` keep distinct copy.** They are different situations with different next steps, even though both can offer a sign-in path.
7. **Issue #372 is not a dependency**, and the wider App New dead-branch class belongs to issue #374. Only the four invitation branches are in scope here.

Settled conventions: shared `INVITATION_*` and `AUTH_TOKEN_INVALID` naming; strict append after `REQUEST_FAILED`; the prefix assertion in `packages/contracts/test/runtime-contract.spec.ts` freezes at the existing 14; five delivery slices in the stated order.
