# Archive Report: Actionable Auth and Invitation Errors (#285)

**Date**: 2026-08-25  
**Change**: actionable-auth-errors  
**GitHub Issue**: #285  
**Archive Location**: `openspec/changes/archive/2026-08-25-actionable-auth-errors/`  

## Cycle Summary

All five implementation slices merged to `develop` (PRs #377–#381) and post-merge verification confirmed `pass_with_warnings` verdict: 8/8 requirements verified, 22/22 scenarios verified, 0 critical findings.

**Task Completion**: 33/33 tasks completed and marked `[x]` in the archived tasks.md.

**Artifact Store Mode**: Hybrid (OpenSpec + Engram)

**Review**: Receipt-driven development is disabled for this clone (`reviewGate` structurally absent); archive proceeds under ordinary repository policy.

## Merged Specifications

### Parent Spec Updated: `openspec/specs/safe-public-error-boundary/spec.md`

#### MODIFIED Requirement: Canonical public error catalog
- **Previous state**: Froze at 14 codes (`phone.too_short` through `REQUEST_FAILED`); prohibited addition of auth, invitation, or actionable codes
- **New state**: Expanded to exactly 25 codes with the 11 codes appended by `actionable-auth-errors`: `SESSION_EXPIRED`, `INVITATION_NOT_FOUND`, `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_ALREADY_MEMBER`, `INVITATION_EMAIL_ALREADY_REGISTERED`, `TENANT_USER_LIMIT_EXCEEDED`, `INVITATION_INVALID_CREDENTIALS`, `AUTH_TOKEN_INVALID`
- **Gate**: Further growth beyond 25 codes requires explicit SDD delta
- **Added scenario**: "Frozen prefix and closed 25-code tuple" asserting first 14 remain unchanged and total is exactly 25

#### MODIFIED Requirement: Focused tolerant direct consumer
- **Previous state**: Prohibited any change to invitation copy/recovery
- **New state**: Narrowed prohibition to permit `errorCode`-driven invitation/session/token recovery copy exactly as scoped by `actionable-auth-errors`; all other constraints (status as transport authority, never-throw parsing, discarding arbitrary prose, no claim over feature parsers or BFF) unchanged
- **Rationale**: This delta enables the two invitation acceptance views and the two token-state views to branch on `errorCode` values for distinct, actionable recovery copy

#### Reconciliation: `## Explicit scope` narrative (lines 74-76)
- **Previous state**: "This child defers actionable codes; invitation/session/credential behavior; feature-parser/BFF migration; full Sentry/logging redesign; and #340/WU3a. No prose bridge or producer-outcome matrix."
- **Reconciliation performed**: Removed "actionable codes; invitation/session/credential behavior;" from the deferrals
- **Resulting state**: "This child defers feature-parser/BFF migration; full Sentry/logging redesign; and #340/WU3a. No prose bridge or producer-outcome matrix."
- **Justification**: The parent spec's trailing `## Explicit scope` section sits outside every `### Requirement:` block and therefore cannot be reached by ADDED/MODIFIED/REMOVED delta mechanics. Without this reconciliation, the merged spec would contradict its own requirements, which now include the actionable codes and invitation/session behavior the parent spec claimed to defer.

### New Capability Added: `openspec/specs/actionable-auth-errors/spec.md`

Created as a new capability spec with 6 requirements and 17 scenarios:
- **R1 — Catalog growth to twenty-five codes** (2 scenarios): Enforces exact append order of the 11 new codes after `REQUEST_FAILED`
- **R2 — Production-mode code emission at throw sites** (4 scenarios): Requires `NODE_ENV=production` for code visibility; development-mode-only assertions are insufficient
- **R3 — Enumeration protection stays collapsed** (2 scenarios): `login.use-case.ts` and `register-tenant.use-case.ts` remain intentionally vague
- **R4 — Consumer branches on errorCode and HTTP status only** (4 scenarios): Both invitation acceptance views use code map with status fallback, zero prose matching
- **R5 — Session expiry never renders credential copy** (2 scenarios): `SESSION_EXPIRED` renders session recovery copy; `INVITATION_INVALID_CREDENTIALS` renders password recovery
- **R6 — Token-state recovery copy without weakening generic DTO validation** (3 scenarios): `verify-email-view.tsx` and `reset-password-view.tsx` branch on `AUTH_TOKEN_INVALID` only, preserving generic DTO fallback

## Verification Outcome

Per `verify-report.md`:
- **Verdict**: pass_with_warnings
- **Critical Findings**: 0
- **Blockers**: 0
- **Requirements**: 8/8 verified (6 actionable-auth-errors + 2 safe-public-error-boundary MODIFIED)
- **Scenarios**: 22/22 verified
- **Test Evidence**: 314/314 tests passing (contracts, API production harness, focused matrix, view suites, e2e regression)
- **Typechecks**: 3/3 clean (contracts, api, app-new)

### Recorded Residuals (not blocking)

Three warnings recorded in the original verify-report, none blocking archive:

1. **WARNING-2 — spec wording places `INVITATION_NOT_FOUND` at 410, implementation at 404**: 
   - Spec groups it with "four distinguished 410 states"; producers throw `NotFoundException` (404)
   - Behavior unaffected because code map is code-first and status-independent
   - Recommendation: correct wording at a future archive time if spec precision is desired

2. **WARNING-3 — "Distinct 409 recovery copy" fully satisfied only by team view**:
   - Spec scenario states acceptance view must render three distinct 409 copies
   - Owner view maps only `INVITATION_EMAIL_ALREADY_REGISTERED` (the only reachable 409 in that flow)
   - Team view has all three; requirement met for every reachable state
   - Recommendation: narrow scenario text to explicitly name the team view at a future archive time

3. **Task modification (WARNING-1)**: 
   - Phase 6 was converted from a checklist task to the narrative "Archive-time reconciliation required" section in the delta spec
   - This conversion was necessary because apply could never complete a checkbox for a spec-level edit step
   - The mandatory instruction survives verbatim in `specs/safe-public-error-boundary/spec.md:42-48`; nothing was lost

## Archive Contents

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ |
| `design.md` | ✅ |
| `specs/actionable-auth-errors/spec.md` | ✅ |
| `specs/safe-public-error-boundary/spec.md` | ✅ |
| `tasks.md` | ✅ (33/33 completed) |
| `verify-report.md` | ✅ |
| `apply-progress.md` | ✅ |
| `exploration.md` | ✅ |
| `archive-report.md` | ✅ (this file) |

## Final State

**Implementation**: All five slices merged to `develop`; no pending code changes.

**Verification**: `pass_with_warnings` per strict TDD; 8/8 requirements verified, 22/22 scenarios verified.

**Task Completion**: 33/33 tasks checked `[x]`; persisted artifact reflects final state.

**Specs Merged**: Two MODIFIED requirements in parent spec updated; one new capability spec created; mandatory reconciliation performed on trailing `## Explicit scope` narrative.

**Archive Move**: Change folder successfully moved from `openspec/changes/actionable-auth-errors/` to `openspec/changes/archive/2026-08-25-actionable-auth-errors/` via `git mv`; diff verification passed (no differences).

**Untracked Artifacts**: Pre-existing untracked `exploration.md` from 2026-08-24-safe-public-error-boundary remains in its archive location, untracked and unmoved.

## Traceability

**Source of Truth for Final State**:
1. Native review authority: N/A (review disabled)
2. Persisted tasks artifact: `openspec/changes/archive/2026-08-25-actionable-auth-errors/tasks.md` (33/33 complete)
3. Explicit final-state facts from orchestrator: None (all facts derived from artifacts and repository state)
4. Verification report: `openspec/changes/archive/2026-08-25-actionable-auth-errors/verify-report.md` (pass_with_warnings, all requirements/scenarios verified)

**Engram Artifact Store**: 
- Archive report will be persisted to `sdd/actionable-auth-errors/archive-report` in Engram alongside the other phase artifacts
- Previous phase artifacts (proposal, spec, design, tasks, verify-report) will remain in Engram for historical reference

## Action Items for Future Work

Per the archived spec and verify-report recommendations, the following are documented deferrals (not blockers, not residuals):

1. **Issue #372**: `apps/viewpro-api` and `apps/viewpro-web` bounded context; separate change, not a dependency
2. **Issue #374**: Wider App New dead-branch class; separate change, not a dependency
3. **Follow-up**: Staff-side team invitation lifecycle annotations (create/resend/revoke sites, 5 sites, no current consumer); deferred as a follow-up
4. **Follow-up**: `throwForInvitationState` dedup refactor (ADR-1 improvement); deferred
5. **Deferred risk**: Per-token rate limiter closing the `AuthThrottlerGuard` `ip:path:email` residual; documented as accepted residual

## SDD Cycle Complete

The actionable-auth-errors change has completed all phases: proposal, spec, design, tasks, apply (5 merged PRs), verify (pass_with_warnings), and archive (this report). The change is ready for production deployment.
