# Exploration: Actionable Auth and Invitation Errors (issue #285)

## Current state

`apps/api/src/common/filters/global-exception.filter.ts:87` runs `sanitizeProductionMessage` only when `NODE_ENV === 'production'`. That function (`:110-124`) maps 404 to `Resource not found`, 400 to `Invalid request payload`, 5xx to `Unexpected error`, and lets everything else fall through to `Request failed`. Every recoverable 401, 403, 409, and 410 therefore collapses to one opaque string in production, and no test observes it because the suites do not run in production mode.

**Key structural finding.** The legacy branch of the filter already forwards `errorCode` verbatim (`:54`, `...(body?.errorCode ? { errorCode: body.errorCode } : {})`), and the thirteen established codes already ship through it — see `apps/api/src/status-change-requests/use-cases/reject-status-change-request.use-case.ts:61-64`, which throws `new ForbiddenException({ errorCode: 'SELF_APPROVAL_FORBIDDEN', message: '...' })`. New auth and invitation codes can therefore ship by appending to `PUBLIC_ERROR_CODES` and annotating throw sites with the same object shape, with **no dependency on `PUBLIC_ERROR_ENVELOPE_ENABLED`**. The switch only controls whether `message`, `path`, and `timestamp` are additionally stripped; it never gated `errorCode` delivery.

**Consumer finding.** `apps/app-new/src/lib/api-client.ts:98-109` always sets `message: GENERIC_API_ERROR_MESSAGE` and never forwards server text. Consequently the `error.status === 410 && message.includes('expired' | 'accepted')` branches in `team-invitation-acceptance-view.tsx:565,572` and `owner-invitation-acceptance-view.tsx:529,547,554` are unreachable dead code in production today, independent of the envelope switch. Both views already fall through to the generic branch for every real 410.

## Recoverable state inventory (apps/api)

Auth and session, `apps/api/src/auth`:

| Location | Exception | Message |
|---|---|---|
| `use-cases/login.use-case.ts:35` | 401 | `Invalid email or password` (collapses missing user, wrong password, inactive) |
| `use-cases/register-tenant.use-case.ts:52` | 409 | `Email is already registered` |
| `use-cases/get-current-user.use-case.ts:21` | 401 | `Authentication required` |
| `use-cases/refresh-session.use-case.ts:23,30` | 401 | `Authentication required` (no token; revoked/expired token) |
| `guards/auth.guard.ts:21,29` | 401 | `Authentication required` (no cookie; invalid token) |

Team invitations, `apps/api/src/team/use-cases`:

| Location | Exception | Message |
|---|---|---|
| `validate-team-invitation.use-case.ts:23,27,31,35` | 404/410 | not found, expired, revoked, already accepted |
| `accept-team-invitation.use-case.ts:82,104,127,211` | 403 | `Team invitation belongs to another email` |
| `accept-team-invitation.use-case.ts:111` | 401 | `Invalid email or password` (login mode) |
| `accept-team-invitation.use-case.ts:123,158,218` | 401 | `Authentication required` |
| `accept-team-invitation.use-case.ts:169-199` | 404/410 | not found, expired, revoked, already accepted, duplicated across validate helper and accept-result mapping |
| `accept-team-invitation.use-case.ts:203,207,215` | 409 | already a member, email already registered, tenant user limit exceeded |
| `create-team-invitation.use-case.ts:51` | 409 | already a member (staff side) |
| `resend-team-invitation.use-case.ts:44,48`, `revoke-team-invitation.use-case.ts:26,30` | 404/410 | not found, no longer available (staff side) |

Owner invitations, `apps/api/src/owner-invitations/use-cases`:

| Location | Exception | Message |
|---|---|---|
| `validate-owner-invitation.use-case.ts:31,35,39,43` | 404/410 | not found, already accepted, revoked, expired |
| `accept-owner-invitation.use-case.ts:140-183` | 404/410 | same set, duplicated |
| `accept-owner-invitation.use-case.ts:110` | 401 | `Invalid email or password` |
| `accept-owner-invitation.use-case.ts:122,194` | 401 | `Authentication required` |
| `accept-owner-invitation.use-case.ts:149,191` | 403 | `Owner invitation belongs to another email` |
| `accept-owner-invitation.use-case.ts:187` | 409 | `Owner email is already registered` |

`team-invitations.repository.ts:40-78` already models `expired`, `revoked`, and `alreadyAccepted` as distinct domain states, so no repository redesign is required — only throw-site annotation.

Out of scope: staff-side `Insufficient permissions` RBAC denials, and `property-engagements` owner-invitation-link create/revoke.

## The disclosure line

The decisive distinction is whether the target email is attacker-controlled. On `login` and `register-tenant` the email is free input on an open endpoint, the classic enumeration surface. On invitation validate and accept the email is server-bound to a secret token (`invitation.email`) and is never attacker-supplied, which narrows the attack surface materially: an attacker needs a valid token first.

| State | Classification | Reason |
|---|---|---|
| Session expired or invalid | SAFE | Concerns the caller's own session; reveals nothing about other accounts. |
| Login: invalid email or password | MUST STAY VAGUE | Attacker-controlled email on an open endpoint. |
| Register-tenant: email already registered | MUST STAY VAGUE | Same. Note the 409 status itself already leaks existence today; pre-existing residual. |
| Invitation not found, expired, revoked | SAFE | Token-gated; the recipient already knows an invitation existed. |
| Invitation already accepted | SAFE | Same; the UI already offers a sign-in path for this case. |
| Wrong account or email mismatch on accept | SAFE | Tells the authenticated caller their own session does not match; not a third-party disclosure. |
| Authentication required during accept | SAFE | Same class as session expiry. |
| Accept in register mode: email already registered | SAFE with residual | Email is token-bound, but a leaked token becomes a secondary enumeration path. |
| Accept in login mode: invalid email or password | **UNCERTAIN — needs a human decision** | Token-bound email argues SAFE, but a leaked or forwarded token turns this into a targeted password-existence oracle against a known victim. No documented decision exists. |
| Tenant user limit exceeded | SAFE | Capacity disclosure, not identity enumeration. |

## Correction to a prior claim

`apps/viewpro-web` does **not** import `@viewpro/contracts` and does not consume `PUBLIC_ERROR_CODES`. Its `AUTH_REQUIRED`, `STEP_UP_REQUIRED`, `LAST_OWNER_PROTECTED`, `SELF_DEMOTE_FORBIDDEN`, and `SELF_STATUS_CHANGE_FORBIDDEN` come from `apps/viewpro-api`'s own constants (`src/auth/auth.constants.ts`, surfaced at `src/auth/guards/auth.guard.ts:15-34`). That app's `SentryExceptionFilter` extends `BaseExceptionFilter` and calls `super.catch(...)` (`src/common/filters/sentry-exception.filter.ts:9,29`), forwarding the body unsanitized in every environment.

`apps/viewpro-api` and `apps/viewpro-web` are therefore a separate bounded context with their own already-safe, already-actionable error contract. Issue #372 is **not** blocked on this issue extending the shared catalog; that stated dependency was incorrect and must be corrected on #372 rather than carried forward.

## Catalog impact

`packages/contracts/test/runtime-contract.spec.ts:73-76` asserts exact equality of the full fourteen-code array plus a separate prefix-preservation assertion over the first thirteen. Growth therefore requires editing that exact-equality test in the same change, while extending the prefix assertion to the new stable length. `apps/api/test/errors.e2e-spec.ts:10-16` derives its cases from `PUBLIC_ERROR_CODES`, so appended codes gain e2e coverage automatically.

Candidate additions from the safe set: `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED` — roughly seven or eight, pending the granularity decision below.

## Candidate slicing under the 400-line budget

| Unit | Scope | Forecast |
|---|---|---|
| WU-A | Catalog plus session codes; annotate the seven auth guard and use-case throw sites; catalog and e2e tests. | 120-180 |
| WU-B | Invitation-state codes for team and owner; annotate roughly fourteen team and ten owner throw sites; tests. | 200-280, may need a team/owner split |
| WU-C | Replace `message.includes(...)` matching with `errorCode` checks in both acceptance views and their tests. | 80-150 |

All three are independently revertable because codes are additive and legacy consumers ignore unknown `errorCode` values. WU-A first proves the pattern; WU-C is gated on WU-B's codes existing.

## Open questions

1. **Invitation-scoped login collapse.** Should the login-mode 401 inside invitation accept stay collapsed like open login, or may it disclose account existence given the token-bound email? Security policy, not engineering.
2. **Code granularity.** One shared `INVITATION_*` set for both team and owner invitations, or separate `TEAM_INVITATION_*` and `OWNER_INVITATION_*` pairs? Changes catalog size and whether WU-B splits.
3. **Register-tenant 409 status leak.** Pre-existing and not fixable by annotation alone. Accept as documented residual, or defer to a child that redesigns status uniformity?
4. **Production value of `PUBLIC_ERROR_ENVELOPE_ENABLED`.** Unverified from the development environment. It does not change whether this work ships, only the rollback framing.
5. **400-level validation messages.** Also invisible in production because the client discards `message` unconditionally. Broader DTO-validation problem; state explicitly as out of scope so it is not assumed solved.

## Readiness

Ready for proposal once questions 1 and 2 are decided, since both change which codes are added and how many throw sites are touched. No blocker exists in the codebase; the pattern is already proven by the thirteen established codes.
