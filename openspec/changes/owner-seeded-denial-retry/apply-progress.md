# Apply Progress — issue599 owner-seeded denial retry

## Status
- Produced: `{changeName:"owner-seeded-denial-retry", artifactStore:"openspec", applyState:"apply-ready", actionContext:{mode:"repo-local", allowedEditRoots:["/Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-seeded-denial-retry"]}}`; remediation runtime `proceed3243/remediates942e` supplied the exact workspace and no ambient status was queried.

## Completed
- Added local `retryOwnerDetailRead` to the two owner detail options only; typed `BffError(404)` is terminal, all other failures retain `failureCount < 3`.
- Added callback coverage for both options and replaced Martin's three immediate flags with bounded `expect.poll` waits after reload/heading.
- Updated all eight implementation-owned task rows to `[x]`; the parent-owned lifecycle row is deferred unchanged, and planning now matches the local owner predicate plus seeded-only Martin synchronization.

## TDD Cycle Evidence
| Task | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| Owner retry | Unit | 3 failures (missing callbacks) | 8 passing | 9 passing, adds 500 | No extra extraction |
| Martin flags | Seeded E2E | Existing direct assertions replaced | Static poll guard restored | Three flags required | No scope expansion |

## Verification
- `pnpm --filter @viewpro/contracts build` passed (test setup); focused owner Vitest passed: 9 tests.
- `pnpm --filter next-shadcn-dashboard-starter typecheck` and `lint:strict` passed.
- Mutants: `404→403` and `<3→<2` each failed focused tests; removing an activity poll failed the static three-poll guard; all restored.
- Targeted `test:seeded --grep 'Martin seller home|isolation'` skipped: `DATABASE_URL` is absent and global setup runs `pnpm demo:seed` (P1001 limitation); no DB was touched.

## Boundary and rollback
- Files: owner queries/tests, Martin seeded smoke; OpenSpec `proposal.md`, `design.md`, all three delta specs, `tasks.md`, and this progress; entire candidate is 300 physical lines / 400 hard cap.
- Roll back by removing the local predicate/retry assignments and restoring the three direct Martin assertions; generated dependencies/build artifacts were cleaned and no data repair is needed.
