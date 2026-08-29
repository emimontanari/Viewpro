# Apply Progress: Actionable Auth and Invitation Errors (#285)

## Status and Identity
Phase 1 (WU-A) complete in Strict TDD mode; phases 2-6 not started. Delivery is `dependency-parallel-to-develop`: A ships first because every later unit needs its catalog.

## Completed Tasks
- [x] 1.1-1.3 RED: catalog assertion extended to 25 with the prefix frozen at 14; hermetic boundary harness and per-file exhaustiveness guards created; guard scope confirmed to exclude `login.use-case.ts` and `register-tenant.use-case.ts`.
- [x] 1.4 Pre-GREEN grep: no test or consumer binds the legacy `error` field on the seven annotated routes, so its documented degradation to the filter default `'Error'` breaks nothing.
- [x] 1.5-1.6 GREEN: 11 codes appended after `REQUEST_FAILED`; 7 sites annotated inline per ADR-1 with every message string byte-identical.
- [x] 1.7-1.9 REFACTOR: full focused matrix, both typechecks, and the derived e2e suite.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `pnpm --filter @viewpro/contracts test` | 3/3 before edits |
| RED 1 | `NODE_ENV=production pnpm --filter @viewpro/contracts test` | exit 1; **2 failed, 3 passed** — catalog still 14 codes against 25 expected |
| RED 2 | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | exit 1; **10 failed, 1 passed** — 5 boundary cases missing `errorCode` (message already sanitized), 5 exhaustiveness guards showing throw-count against `errorCode:`-count mismatch |
| GREEN | both commands unchanged | contracts **5/5**; boundary harness **11/11** |
| TRIANGULATE | `test/errors.e2e-spec.ts` | **39/39** — grew automatically because `PUBLIC_ERROR_CASES` derives from the catalog, with no edit to that file |
| REFACTOR | contracts test + typecheck, API focused matrix, API typecheck | 4 files / **77 tests**, both typechecks clean |
| Regression | the five files holding the nine `'Authentication required'` assertions | 5 files / **102 tests**, all unmodified |
| Consumer | `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/lib/api-client.test.ts` | **7/7** |

## Work Unit Evidence
- Runtime harness: `new GlobalExceptionFilter('production', undefined, {})` with a direct `ArgumentsHost` (ADR-2). Production-mode sanitization is exercised without a live app and without a process-wide env var, so the assertion holds regardless of how the suite is invoked. Every REFACTOR command re-runs at default `NODE_ENV` to prove no leakage.
- Enumeration protection: `login.use-case.ts:35` and `register-tenant.use-case.ts:52` are untouched, confirmed by `git status` and by task 1.3's scope-exclusion guard.
- Message preservation: `HttpException.initMessage()` reads `message` off an object-form response, so annotating a throw leaves `.message` byte-identical. The nine pre-existing assertions passed unmodified; none was edited to accommodate the change.
- WU-A count: **222 additions + 10 deletions = 232 changed lines** of source and tests, 168 under the 400-line budget. `git diff --check` passes.

## Deviations and Issues
- Task 1.2 stated "4 boundary cases" while enumerating 5 files. Implemented 5, one per annotated file, because the spec gives `verify-email` and `reset-password` separate scenarios and collapsing them would leave one `AUTH_TOKEN_INVALID` producer without boundary coverage. The task text has been corrected to 5.
- Docker was down at batch start, so DB-backed suites failed with `PrismaClientInitializationError`. Environmental, not a regression: Docker was started, both Postgres containers reached healthy, and the suites passed on rerun.

## Rollback Boundary
Revert `packages/contracts/src/index.ts`, `packages/contracts/test/runtime-contract.spec.ts`, `auth.guard.ts`, `get-current-user.use-case.ts`, `refresh-session.use-case.ts`, `verify-email.use-case.ts`, `reset-password.use-case.ts`; delete `apps/api/test/public-error-annotations.spec.ts`. WU-A reverts **last** — B1, B2 and C1 must revert first, or their producers reference absent codes.

## Remaining
Phases 3-6 pending. No user-visible behavior changes until the view slices C1 and C2 ship; WU-A/B1 only make the codes available on the wire.

---

# WU-B1 Batch (Phase 2 — Team Invitation Annotations)

## Status and Identity
Phase 2 (WU-B1) complete in Strict TDD mode, tasks 2.1-2.6. Independent of WU-B2 per delivery order; builds on WU-A's merged catalog.

## Completed Tasks
- [x] 2.1-2.2 RED: 10 boundary cases (one per distinct state→code pair: 4 validate + 6 accept-unique) and 2 per-file exhaustiveness guards appended to `public-error-annotations.spec.ts`.
- [x] 2.3 Pre-GREEN grep: no test/consumer binds the legacy `error` field on team routes.
- [x] 2.4 GREEN: all 23 sites annotated inline per ADR-1 (4 in `validate-team-invitation.use-case.ts`, 19 in `accept-team-invitation.use-case.ts`, including both duplicated helper methods), every message string byte-identical.
- [x] 2.5-2.6 REFACTOR: focused matrix green, typecheck clean, both `'Authentication required'` message-text sites confirmed unchanged.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | 11/11 before edits (WU-A baseline) |
| RED | same command | exit 1; **12 failed, 11 passed** — 10 boundary cases missing `errorCode`, 2 exhaustiveness guards showing throw-count vs `errorCode:`-count mismatch |
| GREEN | same command | **23/23** |
| REFACTOR | `test/public-error-annotations.spec.ts test/team-invitations.use-cases.spec.ts test/team.use-cases.spec.ts test/errors.e2e-spec.ts` + `pnpm --filter @viewpro/api typecheck` | **97/97**, typecheck clean |
| Extra regression (not in prescribed command, run for safety) | `test/team-invitations.e2e-spec.ts test/team.e2e-spec.ts` | **38/38** |

## Work Unit Evidence
- Runtime harness: same hermetic `new GlobalExceptionFilter('production', undefined, {})` + `ArgumentsHost` as WU-A (ADR-2); no live app needed.
- Message preservation: all 23 throw sites keep their original string byte-identical, now nested at `message:` inside the object literal.
- WU-B1 count: **312 additions + 40 deletions = 352 changed lines**, 48 under the 400-line budget (forecast was 110-170; see deviation below for why it's higher).

## Deviations and Issues
- **Unforecasted**: `team-invitations.use-cases.spec.ts` uses `.rejects.toThrow(new XException("message string"))` on 7 tests covering the 23 annotated sites. Vitest's `toThrow(errorInstance)` (confirmed in `@vitest/expect` source: `equals(thrown, expected, [...customTesters, iterableEquality])`) performs **full deep-equality** on the thrown object, not a message-only comparison. Since the annotated exceptions moved from string-form (auto-deriving `.response = {statusCode, error, message}`) to object-form (`.response = {errorCode, message}`), these 7 tests failed on `.response.statusCode`/`.response.error` even though every message string was byte-identical — the non-negotiable "message strings do not change" held; only the exception's structural footprint changed, which is ADR-1's documented, intentional consequence. Fix: updated the *expected exception construction* in all 7 tests from `new XException("string")` to `new XException({ errorCode: '<code>', message: '<same string>' })` — same message text, now also positively asserting `errorCode` (a strictly stronger check, not a weakened one). This is the two `'Authentication required'` sites task 2.6 calls out (`:677,728` in the pre-edit file), plus 5 more sites the task list did not anticipate. Net: task 2.5's REFACTOR step required editing a second test file beyond the ones the task named; recorded here rather than silently absorbed. Same risk applies structurally to WU-B2's `owner-invitations.use-cases.spec.ts` if it uses the same `.rejects.toThrow(new XException(string))` pattern — worth checking early in that batch.

## Rollback Boundary
Revert `apps/api/src/team/use-cases/validate-team-invitation.use-case.ts`, `apps/api/src/team/use-cases/accept-team-invitation.use-case.ts`, the WU-B1 blocks in `apps/api/test/public-error-annotations.spec.ts`, and the 7 test-expectation edits in `apps/api/test/team-invitations.use-cases.spec.ts`. Independent of WU-B2. Must revert before WU-A (catalog).

## Remaining
Phases 3-6 pending.

---

# WU-B2 Batch (Phase 3 — Owner Invitation Annotations)

## Status and Identity
Phase 3 (WU-B2) complete in Strict TDD mode, tasks 3.1-3.6. Independent of WU-B1 per delivery order; builds on WU-A's merged catalog.

## Completed Tasks
- [x] 3.1-3.2 RED: 8 boundary cases (one per distinct state→code pair) and 2 per-file exhaustiveness guards appended to `public-error-annotations.spec.ts`.
- [x] 3.3 Pre-GREEN grep: no test/consumer binds the legacy `error` field on owner routes.
- [x] 3.4 GREEN: all 18 sites annotated inline per ADR-1 (4 in `validate-owner-invitation.use-case.ts`, 14 in `accept-owner-invitation.use-case.ts`), every message string byte-identical (verified by `git diff` against `fix/actionable-auth-errors-wu-b1`, message-only lines unchanged).
- [x] 3.5-3.6 REFACTOR: focused matrix green, typecheck clean, both `'Authentication required'` message-text sites (`owner-portal.e2e-spec.ts:640`, `owner-documents.e2e-spec.ts:169`) confirmed unchanged.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts` | 23/23 before edits (WU-A+B1 baseline) |
| RED | same command | exit 1; **10 failed, 23 passed** — 8 boundary cases missing `errorCode`, 2 exhaustiveness guards showing throw-count vs `errorCode:`-count mismatch |
| GREEN | same command | **33/33** |
| REFACTOR | `test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/owner-portal.use-cases.spec.ts` + `pnpm --filter @viewpro/api typecheck` | **99/99**, typecheck clean |
| Extra regression (owner e2e, not in prescribed command, run for safety) | `test/owner-portal.e2e-spec.ts test/owner-documents.e2e-spec.ts test/owner-invitations.e2e-spec.ts` | **32/32** |
| WU-A/B1 regression matrix (unaffected files, run for safety) | `test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/auth.use-cases.spec.ts test/team-invitations.use-cases.spec.ts` | **99/99** |

## Work Unit Evidence
- Runtime harness: same hermetic `new GlobalExceptionFilter('production', undefined, {})` + `ArgumentsHost` as WU-A/B1 (ADR-2); no live app needed for the boundary spec. `errors.e2e-spec.ts`, `owner-portal.use-cases.spec.ts`, and the three owner e2e suites required Docker (both Postgres containers were already healthy at batch start — no environmental blockers).
- Message preservation: all 18 throw sites keep their original string byte-identical, now nested at `message:` inside the object literal — confirmed by a targeted `git diff` against `fix/actionable-auth-errors-wu-b1` showing only the exception-construction shape changed, not any message text.
- WU-B2 count: **196 additions + 18 deletions = 214 changed lines**, 186 under the 400-line budget (forecast was 100-160; slightly above due to the 178-line test-file addition, consistent with WU-B1's pattern of the boundary-spec block outweighing the mechanical production-file edits).

## Deviations and Issues
- **Vitest deep-equality shape issue (from WU-B1) did not recur.** No `apps/api/test/owner-invitations.use-cases.spec.ts` exists, and a repository-wide grep found zero references to `AcceptOwnerInvitationUseCase`/`ValidateOwnerInvitationUseCase` combined with `.rejects.toThrow(new ...)` in any test file. The only other `.rejects.toThrow(new XException(...))` uses in owner-adjacent files (`owner-portal.use-cases.spec.ts`, `owner-documents.use-cases.spec.ts`) target unrelated use cases this change never touches, so no test-expectation edits were needed this batch.
- Task 3.1's own text says "8 boundary cases" and the implementation matches exactly (4 validate-state pairs + 4 accept-only pairs: `INVITATION_EMAIL_MISMATCH`, `INVITATION_INVALID_CREDENTIALS`, `SESSION_EXPIRED`, `INVITATION_EMAIL_ALREADY_REGISTERED`), no correction needed.

## Rollback Boundary
Revert `apps/api/src/owner-invitations/use-cases/validate-owner-invitation.use-case.ts`, `apps/api/src/owner-invitations/use-cases/accept-owner-invitation.use-case.ts`, and the WU-B2 blocks in `apps/api/test/public-error-annotations.spec.ts`. Independent of WU-B1. Must revert before WU-A (catalog).

## Remaining
Phases 4-6 pending. No user-visible behavior changes until the view slices C1 and C2 ship; WU-A/B1/B2 only make the codes available on the wire.
Phases 2-6 pending. No user-visible behavior changes until the view slices C1 and C2 ship; WU-A only makes the codes available on the wire.

# WU-C1 Batch (Phase 4 — Invitation Acceptance View Branching)

### Completed Tasks
- [x] 4.1 `toApiError` exported from `apps/app-new/src/lib/api-client.ts` (one-word change).
- [x] 4.2-4.3 RED: both hand-built `apiError(status, message)` helpers replaced by `apiErrorFrom(status, body)` routed through the real `toApiError`; every existing fixture rewritten as `apiErrorFrom(status, { errorCode })`; new per-code fixtures added for every reachable code per the design's team/owner mapping table (7 new team cases, 3 new owner cases).
- [x] 4.4 Checkpoint (ADR-4): pre-fix run was **8 failed / 22 passed** (30). The 4 pre-existing prose-matching cases (`shows expired invitation guidance` × 2 files, `shows already-accepted guidance...` × 2 files) FAILED as required, proving the helper swap is faithful and the ADR-4 bug was real. The other 4 failures were new fixtures for codes not yet wired (expected).
- [x] 4.5 GREEN: `INVITATION_ERROR_COPY` code maps added (team: 7 entries, owner: 4 entries) with `getStatusFallbackUiError` retained as the status-only ladder; both `const message = error.message.toLowerCase()` lines and all `message.includes(...)` branches deleted. One test-only fix needed after first GREEN pass: `findByText(/tu sesión expiró/i)` was ambiguous (matched both card title and alert description) — narrowed to match the description text. Final: **30/30 passed**.
- [x] 4.6 REFACTOR: `vitest run src/lib/api-client.test.ts src/features/team-invitations src/features/owner-invitations` → **41/41 passed**; `pnpm --filter next-shadcn-dashboard-starter typecheck` → clean.
- [x] 4.7 Grep both view sources for `message.includes(` → zero matches.
- [x] 4.8 Diff measured: **271 changed lines** (214 additions + 57 deletions) across `api-client.ts` + both view/test file pairs — under the 320 split trigger, no split needed.

### TDD Cycle Evidence
| Task | Test File(s) | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1-4.3 | both `*-acceptance-view.test.tsx` | Integration (RTL) | ✅ 20/20 baseline | ✅ 8 failed (checkpoint) | ✅ 30/30 | ✅ 10 new per-code cases | ✅ Clean |
| 4.5 | both `*-acceptance-view.tsx` | Integration | — | (covered above) | ✅ 30/30 execution-confirmed | — | ✅ ambiguous-query fix applied |

### Design deviations (all minimizing scope, none weakening behavior)
- `INVITATION_ERROR_COPY` typed via explicit `Partial<Record<PublicErrorCode, InvitationUiError>>` annotation rather than the design snippet's `satisfies` clause — `satisfies` narrows to only the declared literal keys, which fails to typecheck when indexing by the full `PublicErrorCode` union (`error.errorCode`). Explicit annotation is required for the lookup to typecheck without a cast; behavior is identical.
- Only codes needing text *distinct from* the existing status-only fallback got an explicit map entry (team: `INVITATION_EXPIRED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `SESSION_EXPIRED`, `INVITATION_INVALID_CREDENTIALS`; owner: `INVITATION_EXPIRED`, `INVITATION_ALREADY_ACCEPTED`, `SESSION_EXPIRED`, `INVITATION_INVALID_CREDENTIALS`). Codes whose only reachable text already matches the pre-existing status fallback (`INVITATION_NOT_FOUND`, `INVITATION_REVOKED`, `INVITATION_EMAIL_MISMATCH`, and owner's sole 409 `INVITATION_EMAIL_ALREADY_REGISTERED`) were left to the fallback ladder — same production output, smaller diff, and still ADR-3-correct (code map takes priority; falls through only when no explicit entry exists).
- Spec scenario "Distinct 410 recovery copy" literally groups `INVITATION_NOT_FOUND` with the 410 codes, but design.md's confirmed status table puts `INVITATION_NOT_FOUND` at 404 (matching the real use-case throws). Implemented per design (404), not per the spec's literal grouping — the code-map lookup is code-first regardless of status, so behavior is unaffected either way. Flagging as a spec-wording inconsistency for verify.

### Work Unit Evidence
- Focused command: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx` → 30/30.
- Runtime harness: Vitest + Testing Library component render, real `toApiError` parser (no hand-built error shapes) — no live app/BFF in this flow (per design's forecast table).
- Rollback boundary: revert `apps/app-new/src/lib/api-client.ts` (drop `export`), both `*-acceptance-view.tsx`, both `*-acceptance-view.test.tsx`. Independently revertable; must revert before B1/B2 (design's stated order) — not applicable here since B1/B2 are on separate branches not present in this tree.

### Engram
No `mem_*` tool was available in this session (same as prior sub-agents per the launch note). This section and the tasks.md `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

# WU-C2 Batch (Phase 5 — Token-State View Branching)

### Completed Tasks
- [x] 5.1-5.2 RED: created `verify-email-view.test.tsx` and `reset-password-view.test.tsx` (both new files, none existed before), each with an `AUTH_TOKEN_INVALID` case, an ordinary-DTO 400 case, and a non-400 case — all built through `apiErrorFrom(status, body)` routed via C1's exported `toApiError` (ADR-4), never hand-built.
- [x] 5.3 GREEN: `verify-email-view.tsx` and `reset-password-view.tsx` now branch on `errorCode === 'AUTH_TOKEN_INVALID'` before falling back to `getApiErrorMessage(error)`; each supplies its own flow-specific copy (request a new verification email vs. request a new reset link) per the design's copy-intent table.
- [x] 5.4 REFACTOR: `vitest run src/features/auth src/lib/api-client.test.ts` → 26/26; `pnpm --filter next-shadcn-dashboard-starter typecheck` → clean.

### TDD Cycle Evidence
| Task | Test File(s) | Layer | RED | GREEN | REFACTOR |
|---|---|---|---|---|---|
| 5.1-5.3 | `verify-email-view.test.tsx` | Integration (RTL) | ✅ 1 failed / 2 passed (token-branch case failed; generic/non-400 already passed unchanged) | ✅ 3/3 | ✅ included in broader suite |
| 5.1-5.3 | `reset-password-view.test.tsx` | Integration (RTL) | ✅ 1 failed / 2 passed (same shape) | ✅ 3/3 | ✅ included in broader suite |

RED confirmed the branch was genuinely missing, not a fixture artifact: the generic-fallback and non-400 cases were green from the first run because that path was already correct and untouched; only the two `AUTH_TOKEN_INVALID` cases failed pre-implementation.

### Design deviations
None — implementation matches design (`verify-email-view.tsx:36`, `reset-password-view.tsx:51` branch before the existing `getApiErrorMessage(error)` fallback, no code map needed since each view has exactly one code to handle).

### Work Unit Evidence
- Focused command: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/auth/components/verify-email-view.test.tsx src/features/auth/components/reset-password-view.test.tsx` → 6/6.
- Runtime harness: Vitest + Testing Library component render, real `toApiError` parser — no live app/BFF in this flow.
- Rollback boundary: revert `verify-email-view.tsx`, `reset-password-view.tsx`; delete both new `.test.tsx` files. Must revert first among the shipped units — its tests import C1's `toApiError` export.
- Diff measured against `fix/actionable-auth-errors-wu-c1`: **173 changed lines** (169 additions + 4 deletions) — `verify-email-view.tsx` 12+2, `reset-password-view.tsx` 12+2, `verify-email-view.test.tsx` 65 new, `reset-password-view.test.tsx` 80 new. Well under the 400-line budget and within the 150–210 forecast.

### Engram
No `mem_*` tool was available in this session (same as WU-C1). This section and the tasks.md `[x]` marks are the persisted record.
