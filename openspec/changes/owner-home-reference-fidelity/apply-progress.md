# Apply Progress: Owner Home Reference Fidelity — Slice 1

## Status

**Blocked during Slice 1 GREEN/REFACTOR verification.** The bounded query and pure mapper pass their focused suites, and App New typecheck passes. The required component suite has one existing fixture that supplies timeline rows whose `propertyEngagementId` is `engagement-tenant-1` for cards keyed as `engagement-recent`, `engagement-tie-a`, and `engagement-tie-z`. Slice 1's required defensive mapper correctly rejects those mismatched rows, so the component ordering assertion now fails. Updating that fixture is outside the delegated allowed edit surfaces; no mismatch rejection was weakened and no Slice 1 checkbox was marked complete.

## Structured status consumed

```yaml
schemaName: spec-driven
changeName: owner-home-reference-fidelity
artifactStore: openspec
planningHome:
  root: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s1
  changesDir: openspec/changes
changeRoot: openspec/changes/owner-home-reference-fidelity
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: partial }
taskProgress: { total: 13, complete: 0, remaining: 13 }
applyState: ready
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s1
  allowedEditRoots:
    - viewpro-app/apps/app-new/src/features/owner/api/queries.ts
    - viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts
    - viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx
    - viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts
    - viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts
    - openspec/changes/owner-home-reference-fidelity/tasks.md
    - openspec/changes/owner-home-reference-fidelity/apply-progress.md
  warnings:
    - The launcher cwd was a different worktree; work was redirected to the supplied authoritative workspace before any edits.
    - The component fixture correction needed for the required focused command is not an allowed edit surface.
nextRecommended: resolve-blockers
```

## TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| Slice 1 bounded query/mapper | Unit | 15 tests passed after dependencies were installed and `@viewpro/contracts` was built | 3 of 18 tests failed: missing recent-query export and missing recent movement map | Query and mapper suites: 18/18 passed | Mixed-validity six-row input, mismatch, invalid date, equal-time id ordering, two agencies, unknown type, and input order: 18/18 passed | Blocked: required three-suite command has one incompatible component fixture failure |

## Evidence

- Initial runner attempt: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts` exited 254 because this worktree had no installed dependencies. `pnpm install --frozen-lockfile` and `pnpm --filter @viewpro/contracts build` restored the test environment without changing tracked source.
- Safety net: the same focused query/mapper command passed **15/15**.
- RED: the same focused query/mapper command failed **3/18**: `ownerEngagementRecentMovementsOptions is not a function` and the mapper had no `recentMovementsByEngagementId` input.
- GREEN/TRIANGULATE: the focused query/mapper command passed **18/18**.
- Required final focused command from `viewpro-app/`: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/components/owner-home.test.tsx` ran **30/31** tests; the only failure is `OwnerHome > orders cards by latest movement date and breaks ties by engagement id`, caused by its mismatched timeline fixture described above.
- TypeScript diagnostics: `pnpm --filter next-shadcn-dashboard-starter typecheck` passed.
- LSP diagnostics were unavailable to this executor; the App New TypeScript check was run as the available diagnostics substitute.
- `git diff --check` passed.

## Changed files

- `viewpro-app/apps/app-new/src/features/owner/api/queries.ts`
- `viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts`
- `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`
- `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts`
- `viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts`
- `openspec/changes/owner-home-reference-fidelity/apply-progress.md`

The implementation keeps the compact owner-home presentation. It defines the five-row limit once in the pure mapper, uses a distinct recent-movements key, aligns query results positionally by engagement, and derives card summary fields solely from normalized row zero. No design deviation was made.

## Workload and remaining tasks

- PR boundary: Slice 1 only, targeting `develop` after the parent resolves the fixture/edit-scope blocker; no chained PR or size exception decision is needed because the parent selected `stacked-to-main` and this candidate remains below 400 changed lines.
- Exact candidate diff: **326 changed lines** = 248 tracked source/test changes plus 78 `apply-progress.md` additions; the pre-existing parent-owned `tasks.md` 1-addition/1-deletion is excluded. This is within the 400-line budget.
- Persisted Slice 1 checkboxes: **none changed** because the required focused verification is not green.
- Remaining implementation tasks:
  - `- [ ] **RED:** In \`viewpro-app/apps/app-new/src/features/owner/api/queries.test.ts\` and \`viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.test.ts\`, add failing characterization for the exact \`['owner', 'engagements', engagementId, 'timeline', { order: 'desc', page: 1, pageSize: 5 }]\` home key/query call, its distinction from the 25-row detail key, five-row input bound, engagement-id rejection, invalid-date rejection, newest-first ordering, equal-time movement-id tie breaking, normalized-row-zero latest/next-action/card ordering, no-activity-last, and input/query-arrival independence. <!-- sdd-owner: implementation -->`
  - `- [ ] **GREEN:** In \`viewpro-app/apps/app-new/src/features/owner/api/queries.ts\`, export \`ownerEngagementRecentMovementsOptions\` with the shared \`OWNER_HOME_RECENT_MOVEMENT_LIMIT = 5\`; in \`viewpro-app/apps/app-new/src/features/owner/utils/owner-home-engagement-cards.ts\`, normalize only each card's bounded movement array into \`recentMovements\`; and in \`viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx\`, replace the latest-movement query/index with the aligned recent-movements query/index while retaining the current compact visual summary. <!-- sdd-owner: implementation -->`
  - `- [ ] **TRIANGULATE:** Extend the same mapper/query tests with two agencies on one property, more than five mixed-validity rows, a mismatched \`propertyEngagementId\`, and completion/input permutations, proving neither the index nor sorting can borrow a sibling engagement's movement and unknown movement types remain eligible for ordering. <!-- sdd-owner: implementation -->`
  - `- [ ] **REFACTOR:** Keep the limit defined once in \`owner-home-engagement-cards.ts\`, keep query/service dependencies out of the pure mapper, remove the retired latest-home helper/index names from \`queries.ts\` and \`owner-home.tsx\`, and rerun \`pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/components/owner-home.test.tsx\`. <!-- sdd-owner: implementation -->`

## Deferred lifecycle actions

Parent-owned review, verify, sync, and archive gates remain byte-for-byte unchanged in `tasks.md`. No review, receipt, commit, push, PR action, or Slice 2/3 work was started.

## Corrective rerun — resolved

- The ordering fixture now passes `propertyEngagementId: 'engagement-recent'`, `'engagement-tie-a'`, and `'engagement-tie-z'` to its three corresponding movement rows; defensive mismatch rejection remains unchanged.
- Reconciled Slice 1 planning: `components/owner-home.test.tsx` is the sixth allowed file in both design and tasks, and rollback names all six files including its corrected fixture.
- `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/components/owner-home.test.tsx` passed **31/31**; `pnpm --filter next-shadcn-dashboard-starter typecheck` passed; `git diff --check` passed.
- Relevant LSP diagnostics were not available in this executor; the successful App New TypeScript check is the available diagnostics evidence.
- All four Slice 1 implementation checkboxes are now visibly `[x]` in `tasks.md`. No production behavior changed during remediation.

## TDD Cycle Evidence — correction

| Task | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- |
| Slice 1 fixture correction | Component | Prior required command reproduced the truthful mismatch failure (30/31) | Corrected the fixture identity; required command passed 31/31 | Recent plus equal-time `tie-a`/`tie-z` rows each exercise their matching engagement | No production refactor; defensive mapper remained intact |

## Final Slice 1 handoff

- Changed-file manifest: `api/queries.ts`, `api/queries.test.ts`, `components/owner-home.tsx`, `components/owner-home.test.tsx`, `utils/owner-home-engagement-cards.ts`, `utils/owner-home-engagement-cards.test.ts`, `design.md`, `tasks.md`, and this `apply-progress.md`.
- Candidate budget including this OpenSpec evidence: **393 changed lines** (331 additions, 62 deletions), under the 400-line Slice 1 limit; `git diff --check` is clean.
- Remaining unchecked implementation tasks are the exact persisted `- [ ]` rows under Slice 2 and Slice 3 in `tasks.md`; they are out of this completed Slice 1 boundary. Parent-owned lifecycle rows remain unchanged.
- Blockers: none for Slice 1. Next action is parent-owned lifecycle handling; do not start Slice 2.

## Structured status after remediation

```yaml
changeName: owner-home-reference-fidelity
artifactStore: openspec
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: done }
taskProgress: { implementationTotal: 13, complete: 4, remaining: 9 }
actionContext: { mode: repo-local, workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s1, warning: "Only the parent may advance lifecycle or Slice 2" }
nextRecommended: parent-lifecycle
```
