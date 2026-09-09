# Apply progress — movement-label-save-race

## Completed implementation tasks
- [x] RED, GREEN, TRIANGULATE, and REFACTOR are visibly checked in `tasks.md`.
- Propagated instance-local label pending state form → combobox → dialog; outer button and submit handler block while it is true.
- Success commits `custom:<id>` before clearing the gate; failure keeps the field error and allows outcome-less save or retry; close/cancel/unmount invalidate stale callbacks.
- Added deferred nested-flow tests plus the seeded explicit combobox-label wait.

## Verification evidence
| Cycle | Evidence |
|---|---|
| Safety net | After offline frozen install plus local contracts build: focused baseline passed 9/9. |
| RED | Focused run: 13 tests, 10 passed and 3 failed (pending button gate and callback ordering were absent). |
| GREEN | Focused run passed 13/13 after the prop chain and guard. |
| TRIANGULATE | `pnpm --filter next-shadcn-dashboard-starter test src/features/products/components/create-property-movement-dialog.test.tsx src/features/products/components/movement-outcome-combobox.test.tsx` passed 14/14. |
| REFACTOR | `lint:strict`, `typecheck`, `vitest run src/features/products/components` (170/170), and `git diff --check` passed. |

### TDD Cycle Evidence
| Task | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| Label-save race | Nested component integration | 9/9 | 3/13 failed | 13/13 | 14/14 | focused, product, lint, typecheck green |

## Seeded verification
- Existing local `viewpro_test` was confirmed before use; no database was provisioned.
- First seeded attempt failed before test execution because the offline install had skipped Prisma generation (`AnalyticsActorType` missing). Local `pnpm --filter @viewpro/api db:generate` repaired only generated artifacts.
- `DATABASE_URL=postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public pnpm --filter next-shadcn-dashboard-starter test:seeded --grep "seller can create movements with outcomes"` then passed 1/1.
- Removed generated dependencies, contract output, seeded document storage, and Playwright results after verification; the retained `viewpro_test` database is user-established test infrastructure.

## Files changed
- `movement-outcome-create-label-form.tsx`, `movement-outcome-combobox.tsx`, `create-property-movement-dialog.tsx`
- Their two focused tests and `tests/seeded/demo-smoke.spec.ts`
- `tasks.md` and this progress artifact

## Scope, workload, and status
- No API, DTO #583, schema, dependency, provider, timeout, or unrelated workflow changes; no persisted label operation is cancelled or rolled back.
- Source/test diff is 228 add/delete lines; with the approved planning and this progress artifact, measured total is 387 lines, under the 400-line budget. Single PR/work-unit boundary retained.
- Consumed parent override: `movement-label-save-race`, repo-local root `/Users/emimontanari/Work/Apps/Viewpro-worktrees/movement-label-save-race`, strict TDD, ask-on-risk; ambient null/ambiguous native status was overridden by the approved exact selection.
- Action-context warning: the native status named another worktree, so every write was restricted to the parent-authorized root and listed edit surfaces.

## Remaining lifecycle action
- [x] Complete independent static verification; RDD remains disabled/unmanaged. <!-- sdd-owner: parent -->
- First static gate found no functional blocker; corrected its exact line-accounting and RDD wording findings. Runtime results remain writer-reported; newer-pending-operation staleness lacks a dedicated regression.
