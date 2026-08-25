# Tasks: Actionable Auth and Invitation Errors (#285)

## Review Workload Forecast

| Scope | Estimate | Risk | Headroom (vs 400) |
|---|---:|---|---:|
| WU-A catalog + session/token annotations | 130–190 | Low | 210–270 |
| WU-B1 team invitation annotations | 110–170 | Low | 230–290 |
| WU-B2 owner invitation annotations | 100–160 | Low | 240–300 |
| WU-C1 invitation view branching (split trigger 320) | 200–290 | Medium | 110–200 |
| WU-C2 token-state view branching | 150–210 | Low | 190–250 |
| Total (5 PRs) | 690–1020 | Medium | Split |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: dependency-parallel-to-develop
400-line budget risk: Medium

Delivery order follows the real dependency graph, not a linear chain: A ships to `develop` first because every later unit needs its catalog. Once A merges, B1, B2 and C1 open concurrently against `develop` — B1 and B2 touch disjoint files and neither is a dependency of the other, and C1 needs only A's catalog to typecheck, not the producer annotations. C2 waits for C1 because its tests import C1's `toApiError` export. Rollback still runs in the reverse order C2 → C1 → B2 → B1 → A.

No single work unit is projected to exceed the 400-line budget. C1 is the only Medium-risk slice; if its measured diff exceeds 320 lines it must split into C1a (team view + test + `toApiError` export) and C1b (owner view + test) before review. Delivery strategy is `ask-on-risk`, so the orchestrator asks the user to choose stacked-to-main or feature-branch-chain before `sdd-apply` starts WU-A.

### Suggested Work Units

| Unit / PR boundary | Start → finish | Focused command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| A / PR1 | Catalog +11 codes → annotate 7 session/token sites | `NODE_ENV=production pnpm --filter @viewpro/contracts test && NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | Hermetic: `GlobalExceptionFilter('production', undefined, {})` + direct `ArgumentsHost`, no live app (ADR-2) | Revert `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `auth.guard.ts`, `get-current-user.use-case.ts`, `refresh-session.use-case.ts`, `verify-email.use-case.ts`, `reset-password.use-case.ts`; delete `public-error-annotations.spec.ts`. Revert **last** — B1/B2/C1 must revert first. |
| B1 / PR2 | Annotate 23 team invitation sites | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | Same hermetic filter harness | Revert `validate-team-invitation.use-case.ts`, `accept-team-invitation.use-case.ts`, team block in `public-error-annotations.spec.ts`. Independent of B2. |
| B2 / PR3 | Annotate 18 owner invitation sites | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | Same hermetic filter harness | Revert `validate-owner-invitation.use-case.ts`, `accept-owner-invitation.use-case.ts`, owner block in `public-error-annotations.spec.ts`. Independent of B1. |
| C1 / PR4 (split at 320) | Code-map branching in both acceptance views | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx` | Vitest + Testing Library component render; no live app/BFF exists in this flow | Revert `api-client.ts` (drop `export`), both `*-acceptance-view.tsx`, both `*-acceptance-view.test.tsx`. Must revert before B1/B2. |
| C2 / PR5 | `AUTH_TOKEN_INVALID` branching in two token-state views | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/verify-email-view.test.tsx src/features/auth/components/reset-password-view.test.tsx` | Vitest + Testing Library component render, no live app | Revert `verify-email-view.tsx`, `reset-password-view.tsx`; delete both new test files. Must revert **first** — its tests import C1's `toApiError` export. |

## Phase 1: WU-A — Catalog + Session/Token Annotations

- [x] 1.1 RED: Extend `packages/contracts/test/runtime-contract.spec.ts` — append the 11 codes (`SESSION_EXPIRED` … `AUTH_TOKEN_INVALID`) to `expectedPublicErrorCodes` in exact order, extend the exact-equality assertion (`:73-76`) to 25 entries, extend the frozen-prefix assertion to the existing 14. `NODE_ENV=production pnpm --filter @viewpro/contracts test`
- [x] 1.2 RED: Create `apps/api/test/public-error-annotations.spec.ts` with 5 boundary cases (one per annotated file) (SESSION_EXPIRED via auth.guard/get-current-user/refresh-session; AUTH_TOKEN_INVALID via verify-email/reset-password), each through `new GlobalExceptionFilter('production', undefined, {})` + a direct `ArgumentsHost`, asserting both `body.errorCode` and the sanitized `body.message` in one assertion. `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` — *implemented as 5 cases, one per file, see apply-progress deviation note.*
- [x] 1.3 RED: Add per-file exhaustiveness guard cases for `auth.guard.ts`, `get-current-user.use-case.ts`, `refresh-session.use-case.ts`, `verify-email.use-case.ts`, `reset-password.use-case.ts` (throw-count vs `errorCode:` count); confirm the guard's file scope excludes `login.use-case.ts` and `register-tenant.use-case.ts` (threat: enumeration on open endpoints stays out).
- [x] 1.4 Grep the repo for any test/consumer binding the legacy `error` field on these 7 routes before GREEN (threat: legacy `error` field degradation) — expect none.
- [x] 1.5 GREEN: Append the 11 codes to `PUBLIC_ERROR_CODES` in `packages/contracts/src/index.ts`.
- [x] 1.6 GREEN: Annotate the 7 sites — `auth.guard.ts:21,29`, `get-current-user.use-case.ts:21`, `refresh-session.use-case.ts:23,30` → `{ errorCode: 'SESSION_EXPIRED', message: <unchanged> }`; `verify-email.use-case.ts:23`, `reset-password.use-case.ts:29` → `{ errorCode: 'AUTH_TOKEN_INVALID', message: <unchanged> }`. Rerun 1.1 and 1.2 commands unchanged; confirm GREEN.
- [x] 1.7 REFACTOR: `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/auth.use-cases.spec.ts test/team-invitations.use-cases.spec.ts && pnpm --filter @viewpro/api typecheck`
- [x] 1.8 REFACTOR: Confirm the nine pre-existing `'Authentication required'` message assertions across the five e2e files still pass unmodified.
- [x] 1.9 REFACTOR: Confirm `errors.e2e-spec.ts:13` (`['unknown-code','REQUEST_FAILED']`) and the `api-client.test.ts` unknown-code drop assertion remain green (threat: unvalidated `errorCode` on legacy branch).

## Phase 2: WU-B1 — Team Invitation Annotations

- [x] 2.1 RED: Append 10 boundary cases (one per distinct state→code pair) to `apps/api/test/public-error-annotations.spec.ts` for `validate-team-invitation.use-case.ts` and `accept-team-invitation.use-case.ts`. `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts`
- [x] 2.2 RED: Add exhaustiveness guard cases for `validate-team-invitation.use-case.ts` and `accept-team-invitation.use-case.ts`.
- [x] 2.3 Grep the repo confirming no test/consumer binds the legacy `error` field on team routes before GREEN.
- [x] 2.4 GREEN: Annotate all 23 team sites — `validate-team-invitation.use-case.ts:23,27,31,35`; `accept-team-invitation.use-case.ts:82,104,111,123,127,158,169,173,177,181,187,191,195,199,203,207,211,215,218` — with the matching catalog `errorCode`, message unchanged. Rerun 2.1 unchanged; confirm GREEN.
- [x] 2.5 REFACTOR: `pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/team-invitations.use-cases.spec.ts test/team.use-cases.spec.ts test/errors.e2e-spec.ts && pnpm --filter @viewpro/api typecheck` — *required an unforecasted deviation, see apply-progress.*
- [x] 2.6 REFACTOR: Confirm `team-invitations.use-cases.spec.ts:677,728` `'Authentication required'` assertions still pass unmodified. — *message text unchanged; assertion construction updated, see apply-progress deviation note.*

## Phase 3: WU-B2 — Owner Invitation Annotations

- [x] 3.1 RED: Append 8 boundary cases to `apps/api/test/public-error-annotations.spec.ts` for `validate-owner-invitation.use-case.ts` and `accept-owner-invitation.use-case.ts` (`INVITATION_ALREADY_MEMBER` not reachable in this flow — omit). `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts`
- [x] 3.2 RED: Add exhaustiveness guard cases for `validate-owner-invitation.use-case.ts` and `accept-owner-invitation.use-case.ts`.
- [x] 3.3 Grep the repo confirming no test/consumer binds the legacy `error` field on owner routes before GREEN.
- [x] 3.4 GREEN: Annotate all 18 owner sites — `validate-owner-invitation.use-case.ts:31,35,39,43`; `accept-owner-invitation.use-case.ts:110,122,140,149,155,159,163,171,175,179,183,187,191,194` — with matching catalog `errorCode`, message unchanged. Rerun 3.1 unchanged; confirm GREEN.
- [x] 3.5 REFACTOR: `pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/owner-portal.use-cases.spec.ts && pnpm --filter @viewpro/api typecheck`
- [x] 3.6 REFACTOR: Confirm `owner-portal.e2e-spec.ts:640` and `owner-documents.e2e-spec.ts:169` `'Authentication required'` assertions still pass unmodified.

## Phase 4: WU-C1 — Invitation Acceptance View Branching

- [x] 4.1 RED: Add `export` to `toApiError` in `apps/app-new/src/lib/api-client.ts`.
- [x] 4.2 RED: Replace both hand-built `apiError(status, message)` helpers (`team-invitation-acceptance-view.test.tsx:203`, `owner-invitation-acceptance-view.test.tsx:243-245`) with `apiErrorFrom(status, body)` routed through the exported `toApiError`; rewrite every existing fixture call (`team :77,170,178,187`; `owner :159,167,175,188,200`) as `apiErrorFrom(status, { errorCode })`.
- [x] 4.3 RED: Add new per-code fixture cases for the codes not yet covered (`INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `SESSION_EXPIRED` for team; the owner equivalents) asserting distinct recovery copy per code.
- [x] 4.4 Verify checkpoint (ADR-4, mandatory): run `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx` and confirm the pre-existing prose-matching cases FAIL. If they stay green, the helper replacement was unfaithful — stop and fix before proceeding.
- [x] 4.5 GREEN: In both `*-acceptance-view.tsx`, add the `INVITATION_ERROR_COPY` code map with status-fallback (ADR-3); delete `const message = error.message.toLowerCase()` and both `message.includes(...)` branches. Rerun 4.4's command unchanged; confirm GREEN.
- [x] 4.6 REFACTOR: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts src/features/team-invitations src/features/owner-invitations && pnpm --filter next-shadcn-dashboard-starter typecheck`
- [x] 4.7 REFACTOR: Grep both view sources for `message.includes(` — confirm zero matches remain.
- [x] 4.8 REFACTOR: Measure the WU-C1 diff; if changed lines exceed 320, split into C1a (team view + test + `toApiError` export) and C1b (owner view + test) before requesting review. **271 changed lines (214+/57-), under 320 — no split needed.**

## Phase 5: WU-C2 — Token-State View Branching

- [ ] 5.1 RED: Create `apps/app-new/src/features/auth/components/verify-email-view.test.tsx` (new file) rejecting through `apiErrorFrom(400, { errorCode: 'AUTH_TOKEN_INVALID' })` and asserting expired-link recovery copy, plus an ordinary-DTO-validation 400 case asserting the existing generic fallback is unchanged.
- [ ] 5.2 RED: Create `apps/app-new/src/features/auth/components/reset-password-view.test.tsx` (new file) with the equivalent `AUTH_TOKEN_INVALID` and generic-fallback cases. `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/verify-email-view.test.tsx src/features/auth/components/reset-password-view.test.tsx` — confirm both files fail (no branch exists yet).
- [ ] 5.3 GREEN: In `verify-email-view.tsx:36` and `reset-password-view.tsx:51`, branch on `errorCode === 'AUTH_TOKEN_INVALID'` before the `getApiErrorMessage(error)` fallback, each rendering its own flow-specific copy. Rerun 5.2 unchanged; confirm GREEN.
- [ ] 5.4 REFACTOR: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth src/lib/api-client.test.ts && pnpm --filter next-shadcn-dashboard-starter typecheck`

## Phase 6: Archive-time note (executed by `sdd-archive`, not by this apply)

- [ ] 6.1 Edit `openspec/specs/safe-public-error-boundary/spec.md`'s trailing `## Explicit scope` sentence, removing "actionable codes; invitation/session/credential behavior;" and leaving the remaining deferrals intact, per the delta's mandatory reconciliation note.

Deferred / out of scope: `login.use-case.ts:35` and `register-tenant.use-case.ts:52` stay vague (enumeration protection); the register-tenant 409 existence leak is a documented residual; staff RBAC `Insufficient permissions` and ordinary 400 DTO validation outside the two token-state sites; staff-side team invitation lifecycle (`create:51`, `resend:44,48`, `revoke:26,30`, 5 sites, no consumer in scope); the wider App New dead-branch class (issue #374); `apps/viewpro-api`/`apps/viewpro-web` (separate bounded context, issue #372 not a dependency); the `throwForInvitationState` dedup refactor (ADR-1 follow-up); a per-token rate limiter closing the `AuthThrottlerGuard` `ip:path:email` residual.
