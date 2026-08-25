```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:afaa3f2d68aa99c7040986e67529db84fe8345c8a93ed63ca0ce6371bb57eb28
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 22/22
test_command: pnpm --filter @viewpro/contracts test && NODE_ENV=production pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts && pnpm --filter @viewpro/api exec vitest run test/public-error-annotations.spec.ts test/errors.e2e-spec.ts test/auth.use-cases.spec.ts test/team-invitations.use-cases.spec.ts test/team.use-cases.spec.ts test/owner-portal.use-cases.spec.ts && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/team-invitations src/features/owner-invitations src/features/auth src/lib/api-client.test.ts
test_exit_code: 0
test_output_hash: sha256:2c71a91b20b501fbb5f30d489637deca75160650af833cb4fa6097ba11bbb960
build_command: pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck && pnpm --filter next-shadcn-dashboard-starter typecheck
build_exit_code: 0
build_output_hash: sha256:fd9cf13d5d17ba4d3db288b938754e8e943b639478749ee2cd9971515744596c
```

## Verification Report

**Change**: actionable-auth-errors (GitHub issue #285)
**Mode**: Strict TDD
**Artifact store**: hybrid (OpenSpec + Engram)
**Verified HEAD**: `6c919fb` on `chore/actionable-auth-errors-close`, at `origin/develop`
**Pre-change baseline**: `3603745` (docs-only planning commit; last commit before WU-A)
**Delta specs**: `specs/actionable-auth-errors/spec.md` (6 requirements, 17 scenarios), `specs/safe-public-error-boundary/spec.md` (2 MODIFIED requirements, 5 scenarios)

`evidence_revision` is the SHA-256 of the sorted `git ls-tree HEAD` entries for the
22 product and test paths owned by this change. It is non-self-referential and
excludes mutable OpenSpec artifacts.

All five implementation slices (#377 `63a5fb3`, #378 `0af57f7`, #379 `90d8587`,
#380 `45be7f8`, #381 `6c919fb`) are merged. This is a post-merge verification of
the delivered state.

### Test evidence

| Suite | Result |
|---|---|
| `@viewpro/contracts` runtime contract | 5/5 |
| `@viewpro/api` boundary harness under `NODE_ENV=production` | 33/33 |
| `@viewpro/api` focused matrix (boundary, errors e2e, auth, team invitations, team, owner portal) | 137/137 |
| `next-shadcn-dashboard-starter` view suites (team, owner, auth, api-client) | 60/60 |
| `@viewpro/api` e2e regression (team, team invitations, owner portal, owner documents, owner invitations, auth) | 79/79 |
| Typechecks (contracts, api, app-new) | 3/3 clean |

Docker was up for the whole run: `viewpro-postgres` on 5432 and
`viewpro-platform-postgres` on 5434 both healthy. No `PrismaClientInitializationError`
occurred, so no failure needed environmental attribution.

### Requirement-by-requirement verification

#### Capability `actionable-auth-errors`

**R1 — Catalog growth to twenty-five codes (2/2 scenarios): VERIFIED.**
`packages/contracts/src/index.ts:5-31` holds exactly 25 entries. A byte diff of lines
6-19 against `3603745` is empty, so the first 14 codes are unchanged and order-frozen.
Entries 15-25 match the spec's declared append order exactly, all appended after
`REQUEST_FAILED`. `packages/contracts/test/runtime-contract.spec.ts:89-93` asserts full
ordered equality, the frozen 14-code prefix separately, and set-uniqueness against the
tuple length.

**R2 — Production-mode code emission at throw sites (4/4 scenarios): VERIFIED.**
The harness at `apps/api/test/public-error-annotations.spec.ts:26-39` constructs
`new GlobalExceptionFilter('production', undefined, {})` directly, so
`resolveMessage`'s `this.nodeEnv === 'production'` guard
(`apps/api/src/common/filters/global-exception.filter.ts:87`) activates
`sanitizeProductionMessage` regardless of the ambient `NODE_ENV`. Every one of the 23
boundary cases asserts both `errorCode` and the sanitized message
(`Request failed` / `Resource not found` / `Invalid request payload`), which only
production mode can produce — a development-mode run would return server prose and fail.
This is genuine production-mode evidence, not a development-mode suite.

The 9 exhaustiveness guards (`:138-188`, `:382-404`, `:558-580`) each read the real
source file and compare `countMatches(source, /throw new <ExceptionTypes>\(/g)` against
`countMatches(source, /errorCode:/g)`. Measured per-file counts:

| File | In-scope throws | `errorCode:` |
|---|---:|---:|
| `auth.guard.ts` | 2 | 2 |
| `get-current-user.use-case.ts` | 1 | 1 |
| `refresh-session.use-case.ts` | 2 | 2 |
| `verify-email.use-case.ts` | 1 | 1 |
| `reset-password.use-case.ts` | 1 | 1 |
| `validate-team-invitation.use-case.ts` | 4 | 4 |
| `accept-team-invitation.use-case.ts` | 19 of 23 | 19 |
| `validate-owner-invitation.use-case.ts` | 4 | 4 |
| `accept-owner-invitation.use-case.ts` | 14 of 18 | 14 |

7 session/token + 23 team (4 validate + 19 accept) + 18 owner (4 validate + 14 accept)
= 48 annotated sites, matching the delivered slices.

**R3 — Enumeration protection stays collapsed (2/2 scenarios): VERIFIED.**
`git diff 3603745..6c919fb` over `apps/api/src/auth/use-cases/login.use-case.ts` and
`register-tenant.use-case.ts` is empty — neither file was touched by any of the five
slices. `login.use-case.ts:35` still throws the single collapsed
`UnauthorizedException('Invalid email or password')` for missing user, wrong password,
and inactive account alike; `register-tenant.use-case.ts:52` still throws the generic
`ConflictException('Email is already registered')`. Both files carry zero `errorCode:`
occurrences, and `public-error-annotations.spec.ts:182-188` asserts that zero count
explicitly, so a future annotation would break the build.

**R4 — Consumer branches on errorCode and HTTP status only (4/4 scenarios): VERIFIED,
with two spec-wording warnings.**
A grep for `message.includes(`, `message.toLowerCase(`, and `.includes(` across all four
touched views returns zero matches. Both acceptance views resolve copy through
`INVITATION_ERROR_COPY[error.errorCode] ?? getStatusFallbackUiError(error)`
(`team-invitation-acceptance-view.tsx:587-598`,
`owner-invitation-acceptance-view.tsx:544-555`), so the code map takes priority and the
status ladder is the fallback only.

All three team 409 states render distinct copy: `INVITATION_ALREADY_MEMBER`
(`:558-563`), `INVITATION_EMAIL_ALREADY_REGISTERED` (`:564-569`),
`TENANT_USER_LIMIT_EXCEEDED` (`:570-574`). The four distinguished 410/404 states resolve
to four distinct strings in both views. 403 `INVITATION_EMAIL_MISMATCH` renders
"Usá el email invitado" in both. See WARNING-2 and WARNING-3 for the spec-wording gaps.

**R5 — Session expiry never renders credential copy (2/2 scenarios): VERIFIED.**
`SESSION_EXPIRED` has an explicit map entry in both views
(`team:575-580`, `owner:532-537`) rendering "Tu sesión expiró mientras completabas la
invitación…". Because the code map is consulted before the status ladder, a 401 carrying
`SESSION_EXPIRED` never reaches the 401 credential branch. Both view test files assert
this in both directions:
`expect(screen.queryByText(/revisá tu contraseña/i)).not.toBeInTheDocument()` on the
session-expired case, and `queryByText(/tu sesión expiró/i)).not.toBeInTheDocument()` on
the `INVITATION_INVALID_CREDENTIALS` case.

**R6 — Token-state recovery copy without weakening generic DTO validation (3/3
scenarios): VERIFIED.**
`verify-email-view.tsx` and `reset-password-view.tsx` each gained a private
`get*ErrorMessage(error)` helper that branches on
`isApiError(error) && error.errorCode === 'AUTH_TOKEN_INVALID'` and otherwise delegates
to the pre-existing `getApiErrorMessage(error)`. Each supplies its own flow-specific copy
(new verification link vs. new reset link). Both new test files include an
`apiErrorFrom(400, {})` case proving ordinary DTO validation still renders the untouched
generic fallback, plus a non-400 case.

#### Capability `safe-public-error-boundary` (delta)

**R-catalog — Canonical public error catalog (3/3 scenarios): VERIFIED.** Covered by R1
above plus `apps/api/test/errors.e2e-spec.ts:10-13`, whose `PUBLIC_ERROR_CASES` derives
from `PUBLIC_ERROR_CODES` and therefore grew to 25 pass-through cases automatically, with
`undefined` and `'unknown-code'` both collapsing to `REQUEST_FAILED`.

**R-consumer — Focused tolerant direct consumer (2/2 scenarios): VERIFIED.**
`apps/app-new/src/lib/api-client.test.ts` retains all 7 pre-existing cases green: valid
catalog fields only, unknown/missing code dropped, invalid request IDs and server prose
dropped, and local generic fallback for malformed, non-JSON, empty, and read-rejecting
bodies. The only production change to `api-client.ts` is adding `export` to `toApiError`
(`:98`); the parser body is untouched.

### Load-bearing claim checks

**Messages byte-identical — CONFIRMED against git history, not against the artifact.**
For each of the nine annotated production files, the multiset of message string literals
extracted from `3603745` equals the multiset extracted from `6c919fb`. The one
non-literal message, `TENANT_USER_LIMIT_EXCEEDED_MESSAGE`
(`apps/api/src/tenant-limits/tenant-limit-enforcement.constants.ts:1`), is unchanged in
the same range. `accept-owner-invitation.use-case.ts` shows exactly 14 insertions and 14
deletions, and `git diff -w` shows the same, so the annotation touched only the 14
annotated lines with no formatting churn.

**Test helpers route through the production parser — CONFIRMED, no hand-built fixture
anywhere.** All four view test files import `toApiError` from `@/lib/api-client` and
define the same local helper
`function apiErrorFrom(status, body) { return toApiError({ status } as Response, body); }`
(`team:285-287`, `owner:277-279`, `verify-email:63-65`, `reset-password:78-80`). Every
`mockRejectedValue`/`mockRejectedValueOnce` in all four files passes an `apiErrorFrom(...)`
call — 22 call sites, zero `{ status, message }` object literals. The structural fix for
issue #374 holds.

### Recorded deviations — confirmed accurate

- **WU-B1 test expectation edits (7 sites) strengthened, not weakened.** The diff of
  `apps/api/test/team-invitations.use-cases.spec.ts` shows every expected exception moving
  from `new XException("message")` to
  `new XException({ errorCode: "CODE", message: "same message" })`. Every message string
  is byte-identical to its predecessor; each assertion now additionally requires the exact
  `errorCode`. Under Vitest's `toThrow(errorInstance)` deep equality this is a strictly
  stronger constraint. Confirmed strengthened.
- **`accept-owner-invitation.use-case.ts` 18 throws / 14 annotated.** The four unannotated
  throws are `BadRequestException` DTO validation at `:69` (first name), `:73` (password),
  `:95` (password), and `:133` (unsupported mode). Excluded by design; accurately described.
- **Legacy `error` field degrades to `'Error'`.** Consistent with the object-form response
  shape and with the precedent set by the parent boundary change. No test or consumer binds
  that field on the annotated routes; the full e2e regression is green.
- **`tasks.md` Phase 6 converted to a narrative section — nothing lost.** The mandatory
  instruction survives verbatim in the delta spec at
  `openspec/changes/actionable-auth-errors/specs/safe-public-error-boundary/spec.md:42-48`,
  which is what `sdd-archive` reads. Both merge targets are reachable in the parent spec
  (`### Requirement: Canonical public error catalog` at
  `openspec/specs/safe-public-error-boundary/spec.md:9`, `### Requirement: Focused tolerant
  direct consumer` at `:23`), and the sentence to reconcile is still present verbatim at
  `openspec/specs/safe-public-error-boundary/spec.md:74-76`. Confirmed nothing was lost.

### Findings

**CRITICAL: 0.**

**WARNING-1 — `tasks.md` carries an uncommitted working-tree modification.**
`openspec/changes/actionable-auth-errors/tasks.md` is modified but not committed; the diff
is exactly the Phase 6 to narrative "Archive-time reconciliation" conversion. The content
is correct and nothing is lost, but the worktree is not clean apart from the untracked
archive `exploration.md` as expected. `sdd-archive` will move this file, so the change
must be committed as part of the archive commit rather than silently carried.

**WARNING-2 — spec wording places `INVITATION_NOT_FOUND` at 410, implementation at 404.**
`specs/actionable-auth-errors/spec.md:65-68` groups `INVITATION_NOT_FOUND` with the "four
distinguished 410 states", but both producers throw `NotFoundException` (404) for it
(`accept-team-invitation.use-case.ts:169,187`,
`accept-owner-invitation.use-case.ts:140,171`), matching `design.md`'s status table.
Behavior is unaffected because the code map lookup is code-first and status-independent,
and all four states still render four distinct strings. This is a spec-wording
inconsistency already flagged by apply, not an implementation defect. Recommend correcting
the sentence at archive time when the delta merges into the parent spec.

**WARNING-3 — "Distinct 409 recovery copy" is fully satisfied only by the team view.**
`specs/actionable-auth-errors/spec.md:70-73` requires an acceptance view to render three
distinct 409 copies. The team view does. The owner view maps only
`INVITATION_EMAIL_ALREADY_REGISTERED` (via the 409 status fallback at
`owner-invitation-acceptance-view.tsx:566-572`); `INVITATION_ALREADY_MEMBER` and
`TENANT_USER_LIMIT_EXCEEDED` would collapse to that same copy. They are unreachable in the
owner flow — `accept-owner-invitation.use-case.ts:187` is the file's only
`ConflictException` and it carries `INVITATION_EMAIL_ALREADY_REGISTERED`. The requirement
is therefore met for every reachable state, but the scenario text is broader than the
implementation's reachability. Recommend narrowing the scenario to the team view at archive
time.

**SUGGESTION-1 — stale comment count.** `apps/api/test/public-error-annotations.spec.ts:568-569`
says "the three DTO-validation throws in this file (first-name, password, unsupported mode)"
for `accept-owner-invitation.use-case.ts`, but there are four ("Password is required"
appears at both `:73` and `:95`). The team counterpart at `:391-393` correctly says
"password x2". Comment-only inaccuracy; the assertion itself is count-driven and correct.

**SUGGESTION-2 — exhaustiveness guards are aggregate, not positional.** The guards compare
per-file throw counts against per-file `errorCode:` counts, so an `errorCode` attached to
the wrong throw within the same file would not be detected by the guard alone. The 23
boundary cases cover the state-to-code mapping for every exercised state, so the residual
gap is narrow. Recorded as a known limitation of the ADR-2 design, not a defect.

### Task completeness

33/33 implementation tasks are checked `[x]`, with zero unchecked items. Each phase's
claimed outcome was re-derived from the code rather than trusted: catalog contents from
`packages/contracts/src/index.ts`, annotation counts from the source files, prose-matching
removal by grep, fixture routing by import and call-site inspection, and message identity
by diff against `3603745`. Task state matches code state.

### Verdict

**PASS (with warnings).** Zero CRITICAL findings, three WARNINGs, two SUGGESTIONs. All 8
requirements and all 22 scenarios are verified against the delivered code. The change is
ready for `sdd-archive`, which must additionally (a) commit the pending `tasks.md`
modification, and (b) perform the mandatory `## Explicit scope` reconciliation at
`openspec/specs/safe-public-error-boundary/spec.md:76`.
