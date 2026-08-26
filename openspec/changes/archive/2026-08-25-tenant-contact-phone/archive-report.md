# Archive Report: tenant-contact-phone (Issue #287)

**Change**: tenant-contact-phone (GitHub issue #287)
**Archive date**: 2026-08-25
**Final status**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 5 SUGGESTION; no blockers)
**Archival authority**: SDD archive phase, based on native `gentle-ai sdd-status` reporting `next: archive`, `archive: ready`, `apply: all_done`, `verify: all_done`, `tasks: 19/19`

## Artifacts Preserved

All change artifacts moved to `/openspec/changes/archive/2026-08-25-tenant-contact-phone/`:

- `proposal.md` — change proposal and rationale
- `design.md` — architectural and implementation design
- `exploration.md` — prior investigation and discovery (preserved as required)
- `specs/safe-public-error-boundary/spec.md` — delta spec against parent capability
- `specs/tenant-contact-phone/spec.md` — new capability specification
- `tasks.md` — work breakdown, 19/19 complete
- `apply-progress.md` — delivery evidence with TDD cycle records for all six work units
- `verify-report.md` — verification verdict (PASS WITH WARNINGS) from independent verification phase

## Spec Merge Completion

### Safe Public Error Boundary — Catalog Growth

Delta spec successfully merged into `/openspec/specs/safe-public-error-boundary/spec.md`:

- **Prior state**: Canonical public error catalog frozen at exactly 25 codes
- **Delta**: Append three new codes after `AUTH_TOKEN_INVALID` in exact order
- **Final state**: Canonical public error catalog now frozen at exactly 28 codes
- **Code sequence** (final 3): `phone.required`, `phone.invalid`, `phone.country_unsupported`
- **First 25 codes**: Byte-identical, order-frozen, all preserved
- **Explicit scope prose**: No reconciliation required — existing prose at §Explicit scope defers unrelated topics (feature-parser/BFF migration, Sentry/logging redesign, #340/WU3a) and sits outside all requirement blocks

**Verification**: `packages/contracts/src/index.ts` runtime catalog confirms 28 entries total; first 25 unchanged; last 3 in declared order.

### Tenant Contact Phone — New Capability Spec

New specification created at `/openspec/specs/tenant-contact-phone/spec.md`:

- Eight requirements covering registration, settings, validation, catalog growth, production-mode code emission, canonical E.164 storage, personal phone isolation, and presentation-only country selection
- Eighteen scenarios across all requirements
- Non-goals section explicitly lists scope boundaries (no Prisma migration, no event payload change, etc.)
- Merged into artifact store per hybrid openspec mode

## Verification Verdict Carried Forward

**PASS WITH WARNINGS** — recorded in `verify-report.md`:

- **Blockers**: 0 CRITICAL (single prior blocker closed by `tenants-whatsapp.use-cases.spec.ts:188-214`)
- **Tests**: 1873/1873 pass (1296 in API; 572 in App New; 5 in contracts runtime)
- **Build**: All three typechecks clean (no new diagnostics)
- **Requirements**: 9/9 implemented
- **Scenarios**: 21/21 compliant (tested and passing)
- **TDD compliance**: 6/7 checks passed (RED not re-observed for closure, per scope)

### Warnings Surviving to Archive

These three warnings are pre-existing and out of scope for this change. **All three must be carried forward as follow-ups:**

**WARNING-1 — `tenant-contact` settings feature carries its own private API client (load-bearing follow-up to issue #374)**

Location: `apps/app-new/src/features/settings/tenant-contact/api/service.ts` (`:8-37`)

Issue: This feature defines a private `apiFetch`/`parseResponse` pair and throws `Object.assign(new Error(message), { errorCode })` at `:33`, rather than using the shared `@/lib/api-client`. The fix from issue #374 never covered this feature — `rg 'lib/api-client'` across the feature returns zero matches.

Consequence: The two layers disagree on message handling:
- Shared client (`toApiError`) always substitutes the generic string `"Invalid request payload"`
- Feature client (`parseResponse`) propagates server prose verbatim
- **User-visible risk**: A user on the settings screen can see raw backend error text that would be suppressed by the shared client

Pre-existing at commit `6487d43`; not introduced by #287. Must survive archive as a named follow-up against the #374 lineage.

**WARNING-2 — Registration form's field-level phone messages lack e2e proof**

The e2e suite (`register-tenant-phone.e2e-spec.ts`) covers the HTTP 400 boundary and code propagation but no live browser test walks the real signup form against a 400 rejection. This matches the design scope: `apps/app-new` has no live BFF in this flow. Recorded rather than treated as a defect. Pre-existing design limitation.

**WARNING-3 — WU4's RED closure for three `public-error-annotations.spec.ts` cases is asserted but not evidenced**

The three `public-error-annotations.spec.ts` boundary cases (testing production-mode code emission) were never observed failing. `apply-progress.md:199` honestly discloses the closure was reasoned rather than reproduced. Verification phase did not re-attempt this (scope forbids editing source), but the cases themselves are strong and pass. Recorded for audit transparency.

## State Verification

### Archive Folder Integrity

- Source: `/openspec/changes/tenant-contact-phone`
- Destination: `/openspec/changes/archive/2026-08-25-tenant-contact-phone`
- Move verification: `git show --stat` records renames, not additions, and the source folder no longer exists
- `exploration.md` survival: Confirmed present at archive destination
- **Unrelated leftover**: `openspec/changes/archive/2026-08-24-safe-public-error-boundary/exploration.md` was deliberately left untouched (belongs to prior archive)

### Conflict Marker Scan

Command: `rg "^(<<<<<<<|=======|>>>>>>>)" /openspec/changes/archive/2026-08-25-tenant-contact-phone`

Result: **No matches** — no conflict markers present in archived folder

### Merged Spec Verification

- Safe-public-error-boundary catalog code count: **28** (confirmed)
- Three new codes present and last: `phone.required` (26), `phone.invalid` (27), `phone.country_unsupported` (28) ✓
- First 25 codes byte-identical: ✓
- Order preserved: ✓
- `## Explicit scope` reconciliation required: **No** (prose is independent of catalog changes)

## Persistence Locations

### 1. OpenSpec Archive File System

Path: `/Users/emimontanari/Work/Apps/Viewpro-worktrees/safe-public-error-boundary-plan/openspec/changes/archive/2026-08-25-tenant-contact-phone/archive-report.md`

This file, carrying forward all observations and warnings as canonical record for the change.

### 2. Engram Persistent Memory

Topic key: `sdd/tenant-contact-phone/archive-report`
Project: `viewpro`
Type: `architecture`
Capture prompt: `false`

Persisted by the orchestrator after the archive commit; the archive executor prepared the record but did not write it, so this section was corrected to describe what actually happened rather than what was planned.

## Changeset Summary

- **Merged specs**: 2 (safe-public-error-boundary catalog delta + new tenant-contact-phone spec)
- **Catalog state**: 25 → 28 codes (3 appended, first 25 frozen)
- **Archive artifacts**: 8 (proposal, design, exploration, 2 specs, tasks, apply-progress, verify-report)
- **Original source folder**: Moved (git-tracked rename), not copied
- **Deployment gate**: Receipt-driven review is disabled; ordinary repository policy applies

## Next Steps

Archive is complete. Repository delivery proceeds under ordinary policy (tests, hooks, CI). No follow-up SDD work is required unless issue #374 (feature-client consolidation) or issue #340 (logging redesign) is selected for a future cycle.

---

**Archive completed**: 2026-08-25 by SDD archive executor  
**Verify phase verdict**: PASS WITH WARNINGS (carried forward as noted)
**Ready for commit**: Yes — all specs merged, archive moved
