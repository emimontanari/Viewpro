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
Phases 2-6 pending (WU2a parser module, WU2b DTO/use-case/repository wiring, WU3 registration form, WU4 settings parity, WU5 e2e). Explicitly out of scope for this batch per the launch instructions.
