# Apply Progress: Mandatory Agency Contact Phone at Registration (#287)

## Status and Identity
Phase 1 (WU1) complete in Strict TDD mode. Phases 2-6 not started. Delivery is `sequential-to-develop` (confirmed); WU1 ships first — everything else imports the closed 28-code catalog.

## Completed Tasks
- [x] 1.1 RED: `phoneContactPublicErrorCodes` added and folded into `expectedPublicErrorCodes` in `runtime-contract.spec.ts`; the previous 14-code `frozenPublicErrorCodes` + 11-code `appendedPublicErrorCodes` were merged into a single 25-code `frozenPublicErrorCodes` (the newly-closed prefix), matching the spec's "first 25 unchanged" scenario. `expect(contract.codes).toHaveLength(28)` added.
- [x] 1.2 GREEN: Appended `phone.required`, `phone.invalid`, `phone.country_unsupported` after `'AUTH_TOKEN_INVALID'` in `packages/contracts/src/index.ts`.
- [x] 1.3 REFACTOR: test rerun, both typechecks clean.

## Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| Safety net | `pnpm --filter @viewpro/contracts test` | 5/5 before edits |
| RED | `pnpm --filter @viewpro/contracts test` | exit 1; **2 failed, 3 passed** — catalog still 25 entries against 28 expected (`received` array missing `phone.required`, `phone.invalid`, `phone.country_unsupported`) |
| GREEN | same command unchanged | **5/5** |
| REFACTOR | `pnpm --filter @viewpro/contracts test && pnpm --filter @viewpro/contracts typecheck && pnpm --filter @viewpro/api typecheck` | test 5/5, both typechecks clean (no output) |

The command exception was honoured throughout: `pnpm --filter @viewpro/contracts test` runs `pnpm build && vitest run`, so every RED/GREEN/REFACTOR check asserted against a freshly built `dist/`, never stale output. `exec vitest run` was never used.

## Work Unit Evidence
- Focused command: `pnpm --filter @viewpro/contracts test` → 5/5.
- Runtime harness: N/A — pure catalog/type change, no live app or DB boundary exists for this unit (matches the tasks.md forecast table).
- Byte-identity of the first 25 codes verified via `git diff`: the only change to `packages/contracts/src/index.ts` is 3 appended lines after `'AUTH_TOKEN_INVALID'`; no existing line in the array was touched.
- Changed lines: `git diff --numstat` → `index.ts` 3+0, `runtime-contract.spec.ts` 14+4 = **17 additions + 4 deletions = 21 changed lines**, 379 under the 400-line budget (forecast was 45–75).
- Worktree clean after build: `git status --porcelain` shows only the two intended modified files; the pre-existing untracked `exploration.md` under `archive/2026-08-24-safe-public-error-boundary/` was left untouched.

## Deviations and Issues
None. Task 1.1's literal instruction ("add `phoneContactPublicErrorCodes` and fold it into `expectedPublicErrorCodes`") did not specify how to satisfy the spec's separate "first 25 entries unchanged" scenario; the previous two-tier `frozenPublicErrorCodes`/`appendedPublicErrorCodes` split was merged into one 25-entry `frozenPublicErrorCodes` so the existing `contract.codes.slice(0, frozenPublicErrorCodes.length)` assertion now covers exactly the newly-frozen 25-code prefix, mirroring the precedent's incremental-growth style exactly.

## Rollback Boundary
Revert `packages/contracts/src/index.ts` and `packages/contracts/test/runtime-contract.spec.ts`. Per the tasks.md forecast table: **revert last** — any surviving `phone.*` producer with no catalog entry would fail the client's `satisfies Partial<Record<PublicErrorCode,...>>` typecheck. No other unit exists yet in this worktree, so this is currently the only revertable slice.

## Engram
No `mem_*` tool was available in this session (same as prior sub-agents per the launch note). This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.

## Remaining
Phases 3-6 pending (WU2b DTO/use-case/repository wiring, WU3 registration form, WU4 settings parity, WU5 e2e). Explicitly out of scope for this batch per the launch instructions.

---

## Phase 2 (WU2a) — AR Contact Phone Parser Module

### Completed Tasks
- [x] 2.1 RED: `apps/api/src/common/phone/ar-contact-phone.spec.ts` created against the not-yet-existing module; full four-verdict matrix (required ×5, invalid ×4, unsupported ×3, ok ×5 incl. legacy `3510000000`).
- [x] 2.2 GREEN: `libphonenumber-js@1.13.1` (default/min entry, already the transitive-resolved version in the lockfile) added to `apps/api/package.json` dependencies; `pnpm install` run; `apps/api/src/common/phone/ar-contact-phone.ts` created implementing `parseArContactPhone` per ADR-1's four-step ordered verdict.
- [x] 2.3 REFACTOR: focused command rerun plus `src/common/whatsapp`, both typechecks clean.

### Strict TDD Cycle Evidence

| Step | Command | Result |
|---|---|---|
| RED | `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts` | exit 1; **1 failed suite, 0 tests collected** — `Cannot find module './ar-contact-phone'`, the module did not exist yet |
| GREEN | same command unchanged | **17/17 passed** |
| REFACTOR | `pnpm --filter @viewpro/api exec vitest run src/common/phone src/common/whatsapp && pnpm --filter @viewpro/api typecheck` | **33/33 passed** (17 phone + 16 whatsapp, unchanged); typecheck clean (no output) |

Real, verified library behaviour (not assumed) drove every expected `e164`/verdict in the matrix — each case was probed directly against `libphonenumber-js@1.13.1` before being pinned in the spec, including the ordering case `+56 abc` → `phone.invalid` (unparseable, so validity fails before country is ever read) and `+800 1234 5678` → `phone.country_unsupported` (valid, `country: undefined`).

### Work Unit Evidence
- Focused command: `pnpm --filter @viewpro/api exec vitest run src/common/phone/ar-contact-phone.spec.ts` → 17/17.
- Runtime harness: N/A — pure function, colocated unit spec only, no live app or DB boundary (matches the tasks.md forecast table).
- Changed lines (excluding lockfile): `package.json` +1, `ar-contact-phone.ts` +43, `ar-contact-phone.spec.ts` +102 = **146 additions, 0 deletions = 146 changed lines**, well under the 400-line budget (forecast was 175–210; came in lower because the module ended up smaller than estimated). `pnpm-lock.yaml` +3, tracked separately, not counted against the review budget.

### Deviations and Issues
- Task 2.1's own text said "required ×4"; design ADR-1 collapses five distinct falsy shapes (`not a string`, `null`, `undefined`, `''`, whitespace-only) into `phone.required`. Implemented and pinned all five as five separate assertions (it is the more precise reading of ADR-1's own numbered table) and corrected the count in `tasks.md` to "required ×5" rather than silently leaving the stale count.
- `libphonenumber-js@1.13.1` was already present as a transitive dependency in `pnpm-lock.yaml` (pulled in by another package) before this task. Declaring it directly in `apps/api/package.json` pins it as an explicit first-party dependency at the same resolved version; `pnpm install` only added 3 lockfile lines (no new package version fetched).
- None otherwise — implementation matches ADR-1 and ADR-2 exactly: default (min) entry, not `/mobile` or `/max`; default region `AR`; `whatsapp-phone.utils.ts` untouched (proven by the unchanged 16/16 in the REFACTOR run).

### Rollback Boundary
Delete `apps/api/src/common/phone/`; revert the one added line in `apps/api/package.json` (and optionally the lockfile). Per the tasks.md forecast table, safe only once WU2b and WU4 (not yet implemented) no longer import it — currently nothing imports this module, so it is fully self-contained and revertable in isolation right now.

### Engram
No `mem_*` tool was available to this sub-agent, matching every prior sub-agent noted in the launch instructions. This file and the `tasks.md` `[x]` marks are the persisted record; hand back to the orchestrator to mirror into Engram if needed.
