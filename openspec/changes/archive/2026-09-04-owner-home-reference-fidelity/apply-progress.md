# Apply Progress: Owner Home Reference Fidelity

## Current cumulative status

**Slice 3A RED/GREEN core is complete; Slice 3B static TRIANGULATE, browser verification, and the final frontend gate remain pending.** The corrected persisted implementation state is **10/13 complete**, with exactly three unchecked Slice 3B tasks. Slice 3A covers the deterministic formatter/classifier, semantic bounded activity, scoped continuation, and direct unit/component behavior only; it makes no whole-home state, deliberate long-text/responsive, seeded/browser, or final-gate claim.

The candidate is measured only against worktree `HEAD` `b3304e763e0853913594e67c24567b94212fb668`; the final exact manifest and changed-line count are recorded in the current Slice 3A evidence below. The launcher began in another worktree, so every correction was performed in the supplied authoritative S3 workspace and only the four allowed edit surfaces were changed.

## Historical Slice 1 evidence

### Initial status

**Blocked during Slice 1 GREEN/REFACTOR verification.** The bounded query and pure mapper pass their focused suites, and App New typecheck passes. The required component suite has one existing fixture that supplies timeline rows whose `propertyEngagementId` is `engagement-tenant-1` for cards keyed as `engagement-recent`, `engagement-tie-a`, and `engagement-tie-z`. Slice 1's required defensive mapper correctly rejects those mismatched rows, so the component ordering assertion now fails. Updating that fixture is outside the delegated allowed edit surfaces; no mismatch rejection was weakened and no Slice 1 checkbox was marked complete.

### Structured status consumed

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
## Historical Slice 2 completion
- Status consumed: `{ schemaName: spec-driven, changeName: owner-home-reference-fidelity, artifactStore: openspec, applyState: ready, actionContext: repo-local at owner-home-reference-fidelity-s2; allowed roots honored; launcher-cwd warning resolved before edits }`.
- Completed and persisted: Slice 2 RED, GREEN, TRIANGULATE, and REFACTOR are `[x]`; parent rows unchanged.
- Files: `owner-home.tsx`, `owner-home.test.tsx`, `demo-smoke.spec.ts`, `tasks.md`, and this file only.
- Commands: initial runner lacked `vitest`; `pnpm install --frozen-lockfile` plus contracts build restored it; safety net 13/13; RED 13/14 failed for missing action group.
- GREEN 14/14 and TRIANGULATE 15/15 passed; corrective rerun added direct exactly-three `a`/`button` child cardinality coverage, the focused suite passed 15/15, and the exact six-file regression passed 53/53.
- App New typecheck passed; LSP diagnostics tool was unavailable; `git diff --check` passed.
### TDD Cycle Evidence
| Task | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| Slice 2 actions | 13/13; 13/14 missing group | 14/14 | 15/15 two agencies, seller-contact isolation, unusable agency contact | smoke selector update; 53/53 regression |
- Deviation: none. PR boundary: Slice 2 to `develop`; final candidate is 400 changed lines, within the 400-line budget.
## Historical Slice 3 corrective rerun

- Native status consumed: `openspec`, `owner-home-reference-fidelity`, `applyState: ready`; repo-local root and supplied Slice 3 roots were honored.
- The seeded owner command was rerun first; Prisma generation is no longer the blocker, but global setup stopped before scenario execution because `DATABASE_URL` is absent for `pnpm demo:seed`.
- Exact final gate: focused Vitest **37/37**, App New `typecheck` passed, and `lint:strict` passed; the seeded command then failed only at the `DATABASE_URL` global-setup precondition.

## Current Slice 3A — corrected RED/GREEN core completion

- The maintainer-approved `stacked-to-main` split remains `P1 → P2 → Slice 1 → Slice 2 → Slice 3A → Slice 3B`; this correction changes neither production behavior nor the approved boundary.
- `tests/seeded/demo-smoke.spec.ts` is exactly equal to worktree `HEAD`; Slice 3A has no seeded/browser claim or run.
- The prior 38/38 TRIANGULATE claim is withdrawn: whole-home state, deliberate long-text/responsive proof, browser verification, and the final gate are unchecked Slice 3B work.
- The retained core case renders a within-five-row unknown movement whose stored observation contains promotion/content-like prose, keeps the raw `UNKNOWN_RAW_TYPE` label, and creates no `Promoción` or `Contenido` category.
- The exact four-file focused Vitest command passed **36/36** after the correction; App New `typecheck` and `lint:strict` are rerun below, LSP diagnostics remain unavailable, and `git diff --check` is rerun below.
- Manifest: `owner-home.tsx`, `owner-home.test.tsx`, `owner-movement-labels.ts`, `owner-movement-labels.test.ts`, `design.md`, `tasks.md`, and `apply-progress.md`; seeded changes are excluded. Candidate against `b3304e763e0853913594e67c24567b94212fb668`: **395 changed lines** (296 additions, 99 deletions, including the 44-line untracked label test).

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| Slice 3A core evidence correction | Component | Four-file command: 38/38 before the correction | Not applicable: this removed an overstated prior TRIANGULATE claim and added no production behavior | Four-file command: 36/36 with the rendered neutral/raw no-inference case | Deferred intact to unchecked Slice 3B task | No production refactor; seeded/browser scope remains deferred |

### Remaining implementation tasks

- [ ] **TRIANGULATE:** In `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`, retain/expand whole-home loading, properties failure, engagement failure, and owner-safe empty coverage; also prove local timeline error wins over empty, no activity differs from no next action, all-invalid rows are honest no activity, a successful card never receives sibling rows, long property/agency/observation/unknown-type text wraps without truncating meaning, and responsive structural classes preserve one source-ordered column below `md` and three `minmax(0, 1fr)` columns at/above `md`. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR and browser verification:** In `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`, add stable owner-home assertions for the three tiles, a real recent row, scoped `Ver más`/activity navigation, agency WhatsApp href, and intercepted contact tracking; use `page.setViewportSize` for 320px, 375px, the `md` transition, and a full `max-w-6xl` viewport with long strings. Compare the rendered composition with both stored reference assets, but require semantic controls, href/tracking assertions, no horizontal overflow, readable wrapped text, and keyboard reachability as independent oracles rather than using screenshots alone. <!-- sdd-owner: implementation -->
- [ ] Run the final frontend gate from `viewpro-app/`: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/utils/owner-movement-labels.test.ts src/features/owner/components/owner-home.test.tsx && pnpm --filter next-shadcn-dashboard-starter typecheck && pnpm --filter next-shadcn-dashboard-starter lint:strict && pnpm --filter next-shadcn-dashboard-starter test:seeded --grep 'owner'`; record any seeded-suite/environment blocker without weakening unit, semantic, or browser assertions. <!-- sdd-owner: implementation -->

### Structured status consumed

```yaml
schemaName: spec-driven
changeName: owner-home-reference-fidelity
artifactStore: openspec
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: partial }
taskProgress: { total: 13, complete: 10, remaining: 3 }
applyState: ready
dependencies: { apply: ready, verify: blocked, sync: blocked, archive: blocked }
actionContext:
  mode: repo-local
  workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s3
  allowedEditRoots: [viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx, openspec/changes/owner-home-reference-fidelity/design.md, openspec/changes/owner-home-reference-fidelity/tasks.md, openspec/changes/owner-home-reference-fidelity/apply-progress.md]
  warnings: ["Launcher cwd was another worktree; corrections used this authoritative workspace."]
nextRecommended: parent-lifecycle
```

- Deviation: the prior S3A whole-home/long-text TRIANGULATE claim was removed because it lacked deliberate long fixtures; the scoped S3A core behavior is unchanged.
- Workload/PR boundary: Slice 3A only, under the 400-line budget; Slice 3B owns the three remaining tasks. Parent-owned review, verify, sync, and archive actions remain deferred.

## Slice 3B — static/browser evidence attempt (blocked final gate)

- Consumed status: `openspec`, `owner-home-reference-fidelity`, `applyState: ready`, `10/13` implementation tasks complete, repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s3b`, and only the delegated component/seeded-test/OpenSpec roots. The approved delivery path is the assigned `stacked-to-main` Slice 3B boundary.
- Local-only environment: Docker `viewpro-postgres` at `127.0.0.1:5432`; both `DATABASE_URL` and `DIRECT_URL` were `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public`; seeded API/web used free ports `3301`/`3400`. No external database was accessed.
- Static TRIANGULATE added whole-home loading/properties-error/engagement-error coverage, all-invalid-row no-activity coverage, and deliberate long property/agency/observation/unknown-label preservation plus sibling-row rejection and responsive grid classes. Existing tests retain local-error-before-empty, no-activity versus no-next-action, successful-card isolation, action source order, and three-column behavior.
- Browser REFACTOR added the seeded owner composition check: three semantic tiles, real ordered activity, scoped `Ver más`/continuation navigation, agency WhatsApp href and intercepted tracking, Tab order, 44px target, overflow/readable real-text checks at 320px, 375px, 768px (`md`), and 1280px (`max-w-6xl`). Deliberately long strings are covered by the static fixture; the test explicitly compares the rendered hierarchy/grouping/action order/timeline/continuation against both stored references while keeping semantic, href, tracking, keyboard, and overflow assertions independent of screenshots.

### TDD Cycle Evidence

| Task | Safety net | RED | GREEN / TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| Static TRIANGULATE | component suite 16/16 | Coverage-only test additions were green immediately because the completed S3A production behavior already satisfied them; no honest production RED or production edit was possible in this test-only slice | component suite 19/19; four-file focused suite 39/39 | Focused assertions remain scoped to the existing component contract |
| Browser verification | focused seeded owner follow-up could not run through the requested double-dash script because Playwright received a literal `--` and found no tests | New owner browser assertions were green on first execution against the existing S3A UI; no production edit was permitted | direct seeded Playwright scenario 1/1 passed | Stable role/test-id locators and independent behavioral oracles added; no screenshots retained |

### Commands and results

- `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/components/owner-home.test.tsx` → safety net **16/16**, then static coverage **18/18**, then final static coverage **19/19**.
- `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep 'demo owner home keeps the reference hierarchy usable at every supported viewport'` → **1/1 passed**.
- `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/api/queries.test.ts src/features/owner/utils/owner-home-engagement-cards.test.ts src/features/owner/utils/owner-movement-labels.test.ts src/features/owner/components/owner-home.test.tsx` → **39/39 passed**.
- `pnpm --filter next-shadcn-dashboard-starter typecheck` → passed; `pnpm --filter next-shadcn-dashboard-starter lint:strict` → passed; relevant LSP diagnostics were not available to this executor.
- The historical double-dash invocation passed a literal delimiter to Playwright and returned **No tests found**. Its executable owner-filter rerun reached **5 passed, 1 failed, 5 skipped** because the manager rejection prerequisite did not match `owner`; that superseded evidence is corrected below without weakening any assertion.

### Cleanup, manifest, and blocker

- Restored the local deterministic seed with `pnpm demo:seed`, stopped child listeners on `3301`/`3400`, and verified both ports free; removed `.document-storage-seeded`, `test-results`, and `playwright-report` with no generated artifacts remaining.
- Manifest: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`, `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`, and this `apply-progress.md`; no production or fixture source changed. `git diff --check` is clean. Current Slice 3B diff is **211 changed lines** (205 additions, 6 deletions), under the 400-line boundary.
- **Blocker:** the required owner-grep seeded gate is not self-contained and therefore does not pass. The three S3B implementation checkboxes deliberately remain `[ ]`; persisted task state is still **10/13**, not ready for verify. Parent-owned lifecycle rows remain unchanged.

```yaml
changeName: owner-home-reference-fidelity
artifactStore: openspec
applyState: blocked
taskProgress: { implementationTotal: 13, complete: 10, remaining: 3 }
actionContext: { mode: repo-local, workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s3b, warnings: ["owner-grep seeded gate has excluded-test ordering dependency"] }
nextRecommended: resolve-blocker
```

## Slice 3B corrective rerun — complete

- Consumed native OpenSpec status for `owner-home-reference-fidelity`: `applyState: ready`, repository-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s3b`, and the delegated test/OpenSpec edit roots. The approved delivery path remains the assigned `stacked-to-main` S3B work unit; no production, seed-source, or fixture-source file changed.
- **Owner-grep correction:** renamed the existing serial T18a manager rejection test to `manager can reject an uploaded document request for owner follow-up`. The `owner` grep now selects it before unchanged T18b, preserving serial order and all rejection assertions without duplicating behavior.
- **Command correction:** the owned task, design, and progress references now use the executable `pnpm --filter next-shadcn-dashboard-starter test:seeded --grep 'owner'` form.
- **Long-content browser correction:** the existing owner-home test locally intercepts authorized seeded property, engagement, and timeline responses. It overlays deliberate property, agency, observation, and unknown structured-label strings, retains and asserts one unmodified seeded observation, asserts full text, wrappable non-overflow geometry, semantic tiles/list/continuation, scoped hrefs, tracking, and keyboard order at 320, 375, 768, and 1280px. No screenshot is retained or used as the oracle.

### TDD Cycle Evidence — corrective rerun

| Task | Safety net / RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| Owner-grep prerequisite | Prior executable owner grep: 5 passed, 1 failed, 5 skipped because T18a was excluded | Existing T18a received an explicit owner-follow-up title; final grep passed 12/12 | T18a remains serially before unchanged T18b and preserves the rejection notification/reason assertions | No production behavior or duplicate test added |
| Browser long-content proof | First long-label geometry assertion exposed that `Range` rect-count is unreliable for the inline unknown-label element, not a product overflow | Full text plus `scrollWidth <= clientWidth` and non-`nowrap` wrapping behavior passed | All four long fields plus a genuine seeded observation passed at all four target viewports | Test-local response interception only; no screenshots retained |

### Exact corrective evidence

- Component suite: `pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/components/owner-home.test.tsx` → **19/19 passed**.
- Targeted browser scenario with local Docker PostgreSQL and ports API `3301` / web `3400` → **1/1 passed**.
- Final gate with `DATABASE_URL` and `DIRECT_URL` both set to `postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public`: focused four-file Vitest **39/39 passed**; App New `typecheck` passed; `lint:strict` passed; executable seeded owner grep **12/12 passed**.
- Cleanup: reran `pnpm demo:seed`, stopped child servers, confirmed ports `3301` and `3400` have no listeners, and removed `.document-storage-seeded`, `test-results`, `playwright-report`, traces, videos, screenshots, and reports. The shared Docker PostgreSQL container was left running.
- Final manifest: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`, `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`, `openspec/changes/owner-home-reference-fidelity/design.md`, `tasks.md`, and this `apply-progress.md`. `git diff --check` passes; final candidate is **344 changed lines**, under the 400-line S3B budget.
- Persisted implementation task state is **13/13 `[x]`**. The two unchanged parent-owned lifecycle rows remain deferred; no blockers remain for implementation and the next action is parent lifecycle.

### Structured status after correction

```yaml
changeName: owner-home-reference-fidelity
artifactStore: openspec
applyState: all_done
implementationTaskProgress: { total: 13, complete: 13, remaining: 0 }
actionContext: { mode: repo-local, workspaceRoot: /Users/emimontanari/Work/Apps/Viewpro-worktrees/owner-home-reference-fidelity-s3b, warnings: [] }
nextRecommended: parent-lifecycle
```

## Slice 3B review-readiness correction

- Corrected independent findings without production or seed-source edits: engagement/timeline loading now explicitly assert the whole-home skeleton; seeded coverage proves detail/activity/continuation share one engagement id and contact → continuation Tab order.
- Focused component safety net was 19/19; the initial new state test exposed only a stale mock setup, and the corrected component suite is 19/19.
- Targeted browser scenario passed 1/1 twice with local-only `DATABASE_URL`/`DIRECT_URL` and ports 3301/3400; the final gate passed focused 39/39, typecheck, exact `pnpm --filter next-shadcn-dashboard-starter lint:strict`, and seeded owner 12/12.
- Temporary authenticated 1280px full-page capture was inspected against both JPEGs: it retains grouped three ordered tiles and a grouped recent-activity panel with timeline cues; continuation is present but top-right rather than the activity reference's centered footer treatment.
- Cleanup reran `pnpm demo:seed`, removed `.document-storage-seeded`, `test-results`, reports/traces/videos/screenshots, and the temporary capture; ports 3301/3400 have no listeners and PostgreSQL 5432 is accepting connections.
- Manifest remains `owner-home.test.tsx`, `demo-smoke.spec.ts`, and this progress file; the final candidate is 390 changed lines (378 additions, 12 deletions), all 13 implementation rows remain visibly `[x]`, parent lifecycle rows remain deferred, and `git diff --check` is clean.
- Native OpenSpec status is `applyState: ready` only because 2 parent-owned lifecycle rows remain unchecked; implementation is 13/13 complete, repo-local action context is safe with no warnings, and this executor returns `parent-lifecycle`.

### TDD Cycle Evidence — review correction

| Task | Safety net / RED | GREEN / TRIANGULATE | REFACTOR |
| --- | --- | --- | --- |
| State, scoped-navigation, and keyboard evidence | 19/19; initial test isolated a stale mock rather than a product defect | 19/19 component; 1/1 targeted browser; 39/39 final focused suite | No production refactor; assertions only |

## Recovered contemporaneous Slice 3A strict-TDD provenance

This is recovered historical evidence, not a newly manufactured RED. The append-only Pi session transcript for session `01a068ee-ad29-7b29-9320-7497e70516e9` retains both original `sdd-apply` result envelopes:

- Record `58cbb895`, timestamp `2026-09-04T20:07:15.116Z`, subtask `subtask_sdd-apply_1788551893237_795c8dda`, exact result-content SHA-256 `bdd9f553c88959f9c3a70cf316ef7a335fff154eaaa24eb52cd68a19d271e312`:
  - safety net: existing focused suites **33/33 passed**;
  - RED: the new date/type/component tests failed **4/19** because the formatter, classifier, semantic list, and continuation did not exist;
  - GREEN: date/type/component suites **19/19 passed**, and the exact focused suite passed **37/37**.
- Native attempt ordinal 6 independently binds that run to finish tree `d494cc2ea536dcffd8895b32ca80b03b833928a3` and evidence revision `sha256:6710b18437a831dcd289ed32b5df3c84d70ebaa338c1ee30ad827ce4169c4433`; its failed outcome concerned Prisma browser startup after the static GREEN, not the RED/GREEN core.
- Git object comparison proves the final S3A movement-label production blob is byte-identical to that first GREEN tree (`519963cb301b02735265496404253da844071840` in both). The only later S3A production delta is the agency-name `break-words` class in `owner-home.tsx`.
- Record `e5d35ac6`, timestamp `2026-09-04T20:25:13.530Z`, subtask `subtask_sdd-apply_1788553179702_bd4709e0`, exact result-content SHA-256 `251fd4c3e5fb664f712bf244260c3f8410710eeddabc2fce4b3a1b81d4d2b54d`, records that wrapping delta as **37/38 RED** for missing agency wrapping and **38/38 GREEN/TRIANGULATE**.

Together, the two contemporaneous records cover the final S3A production bytes: the formatter/classifier/semantic recent-activity core was test-first, and the sole later production change had its own failing wrapping assertion before GREEN. Current whole-change gates remain separate evidence and do not substitute for these historical RED results.

## Parent lifecycle closeout

- Fresh `gentle-ai review mode status`: receipt-driven development is **off**, decided by `clone_local`; no native receipt review was run and no receipt approval is claimed.
- Ordinary repository-policy evidence: #525→`17d22911`, #526→`3655452a`, #528→`a704a3dd`, #529→`b3304e76`, #531→`85b7c10a`, and #534→`3dcaacc5`; each started from fresh, non-overlapping `develop`, stayed within its authorized review budget, was independently checked and CI-green, then squash-merged.
- Authoritative verify PASS evidence is revision `sha256:9215218ce86de92b806b7ad438f73a58339a4149702c3cea5db6cb251b0bf0c6`, including validated recovered S3A RED provenance.
- Sync is complete: six ADDED requirements and eleven scenarios merged exactly once; canonical totals are 13 requirements and 24 scenarios; strict validations pass.
- Archive is ready at `openspec/changes/archive/2026-09-04-owner-home-reference-fidelity`. Issue #521 remains open until archived closeout is delivered because merges into `develop` do not auto-close it.
