# Apply Progress

## I1 — role, heading, and date foundation

**Structured status consumed:** `gentle-ai.sdd-status@2` reported `apply-ready` for `manager-home-reference-fidelity`, with 0/26 implementation tasks complete, no blockers/conflicts, `nextRecommended: apply`, and repo-local action context. **Action-context warning:** edits were confined to the injected I1 allowlist; the pre-existing parent-owned P4 task completion remains preserved.

Completed implementation rows (persisted as `[x]` in `tasks.md`): I1 RED, GREEN, TRIANGULATE, and REFACTOR. Exact `AGENT` keeps seller queries/content; only exact `MANAGER` and `PRINCIPAL_MANAGER` can mount the existing manager query body; unknown role and absent session identity render an unavailable-role state before that mount. The manager h1 uses `getUserDisplayName`, adjacent active-tenant context, and an injected-now Argentina calendar `<time>` seam. The route no longer owns a generic visible heading.

Files changed: `apps/app-new/src/app/dashboard/page.tsx`, `src/features/dashboard/components/operational-homepage.tsx`, `operational-homepage/helpers.ts`, `operational-homepage/states.tsx`, `operational-homepage.test.tsx`, and new `operational-homepage/manager-home.test.tsx`; plus this progress file and the four I1 checkboxes.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I1 role/heading/date | Component + pure helper | focused 9/9; owner 19/19 | expected greeting assertion failed | focused 10/10 | focused 12/12; owner 19/19 | focused 12/12; owner 19/19; typecheck/lint pass |

### Command evidence

- **Setup** — `2026-09-06T14:01:20Z`, `feat/manager-home-reference-fidelity-i1`, `0ec2b216` dirty worktree: `pnpm install --frozen-lockfile` exit 0. The pre-install test attempt exited 1 with `vitest: command not found`; it was setup, not RED. `pnpm --filter @viewpro/contracts build` exit 0 resolved the workspace contract before baseline.
- **Safety net** — `2026-09-06T14:01:36Z`, same branch/tree: focused existing operational-homepage command exit 0, `9 passed`; owner regression exit 0, `19 passed`.
- **RED** — `2026-09-06T14:02:49Z`, same branch/tree: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 1. Decisive output: no heading named `Hola, Patricio Gómez`; current heading was `Inicio operativo de Costa Norte Propiedades`.
- **GREEN** — `2026-09-06T14:04:25Z`, same branch/tree: the focused command exit 0, `2 passed`, `10 passed`.
- **TRIANGULATE** — `2026-09-06T14:05:40Z`, same branch/tree: focused command exit 0, `2 passed`, `12 passed`; owner command exit 0, `19 passed`. Coverage contrasts manager/principal against agent/unknown/absent identity and `2026-05-25T02:59:00.000Z`/`03:00:00.000Z` as Argentina dates `2026-05-24`/`2026-05-25`.
- **REFACTOR** — `2026-09-06T14:06:26Z`, same branch/tree: focused command exit 0, `12 passed`; owner exit 0, `19 passed`; `pnpm --filter next-shadcn-dashboard-starter typecheck` exit 0; `pnpm --filter next-shadcn-dashboard-starter lint:strict` exit 0. Extracted shared Argentina locale/time-zone constants without semantic change.
- **Optional preservation** — `2026-09-06T14:06:41Z`, same branch/tree: `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts` exit 0, `5 passed`.

Workload / PR boundary: stacked-to-main I1 only; rollback reverses this dispatcher/heading/date change without restoring broad non-agent manager routing. The historical I2 plan was superseded by the user-authorized I2A/I2B split; I3–I6 and the verification rows remain outside I1.

## I1 CI correction — seeded authenticated greeting

The existing seeded manager smoke assertion now checks the deterministic principal-manager greeting exactly as `Hola, Demo ViewPro`; no manager heading behavior, seed source, or additional test changed. The I1 allowlist/objective now explicitly includes this existing assertion, and all checkbox states are unchanged.

- **RED (GitHub CI):** PR #543 head `b9f2ae96729239ef1ae030651de4d48c4ea44696`, run `34038854991`, job `101502070963`, failed twice at `tests/seeded/demo-smoke.spec.ts:71` because it expected `Inicio operativo de ViewPro Demo Inmobiliaria`; captured evidence digest: `sha256:4990760932bc87f71e9ffbd694efe6371b1349730158bcfd52417910a4d02d24`.
- **Safety net / component regression:** `2026-09-06T14:33:33Z` — `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 0 with `2 passed`, `12 passed` after the assertion update.
- **GREEN (local Docker PostgreSQL):** `2026-09-06T14:34:00Z` — `DATABASE_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public' DIRECT_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public' VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3301 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3400 pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep "demo user can navigate the seeded operational workflow"` exited 0 with `1 passed (30.1s)`. It reseeded only the repository-local Docker database and used 3301/3400; the existing 3001/3100 previews remained running.
- **Environment note:** the first local GREEN attempt could not start the API because this worktree lacked a generated Prisma client; `DATABASE_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public' DIRECT_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro?schema=public' pnpm --filter @viewpro/api db:generate` exited 0, after which the exact targeted command above passed. This was environment generation only, with no tracked API/source change.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I1 seeded greeting correction | Seeded E2E + component | focused components 12/12 | GitHub run/job assertion failed twice | targeted seeded 1/1 | exact deterministic authenticated principal assertion, not a broadened matcher | no behavior refactor; component regression 12/12 |

Workload / PR boundary: correction remains in PR #543's I1 `stacked-to-main` unit and must remain at or below 400 additions + deletions. No design deviation and no I2/product behavior was implemented.

## I2A — atomic summary core and retry

**Structured status consumed:** native `gentle-ai.sdd-status@2` reported OpenSpec `apply: ready`, `nextRecommended: apply`, no blockers, and repo-local workspace `/Users/emimontanari/Work/Apps/Viewpro-worktrees/manager-home-reference-fidelity-i2`. **Action-context warning:** only the injected I2A surfaces were edited; seller, owner, BFF/API, browser, and lifecycle work remain untouched.

The original correct I2 candidate measured **452 additions + deletions** against `origin/develop`. The user explicitly authorized its native split into I2A and I2B; the 452-line candidate is I2A's split RED and remediates failed budget evidence `sha256:41bd48e0e58815bf936521e433f879fc3be208552b787404edb58d4169b64821`. I2A retains the serializable `nowMs` seam, one configured manager summary query, no manager products preview/fallback, loading/no-facts, zero-success empties, retained-data error precedence, and exact disabled retry. Advanced successful-refreshing, range/tenant loading, and latest-key proof are deliberately pending I2B.

Completed persisted rows: I2A RED, GREEN, TRIANGULATE, and REFACTOR are `[x]` in `tasks.md`. Files changed: `operational-homepage.tsx`, new `operational-homepage/manager-home.tsx`, `operational-homepage.test.tsx`, `manager-home.test.tsx`, `tasks.md`, and this file. No design deviation: the query adapter owns the sole manager summary query; `ManagerSummaryGate` is a behavior-preserving refactor that suppresses factual sections outside ready state.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I2A atomic manager summary | Component | focused 14/14 | 452-line split/budget failure | focused 14/14 | zero-ready vs retained-data error; retrying vs enabled retry | focused, BFF, owner, suite, typecheck, lint pass |

### Command evidence

All commands used branch `feat/manager-home-reference-fidelity-i2`, base/tree `41503b56`, and worktree `/Users/emimontanari/Work/Apps/Viewpro-worktrees/manager-home-reference-fidelity-i2`; application commands ran from `viewpro-app/`.

- **Baseline** — `2026-09-06T22:42:20Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; `14 passed`.
- **RED** — `2026-09-06T15:37:50Z`: `git diff --check && git -c diff.external= diff --no-ext-diff --numstat`; exit 0; the correct candidate measured 452 changed lines, over the mandatory 400-line budget by 52.
- **GREEN** — `2026-09-06T22:45:28Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; `14 passed` after I2A-only test rescoping.
- **REFACTOR/final focused** — `2026-09-06T22:46:54Z`: same focused command; exit 0; `14 passed` after `ManagerSummaryGate` removed only duplicated ready-state indentation.
- **Final regressions** — `2026-09-06T22:47:03Z`: `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts`; exit 0; `5 passed`; and `pnpm --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx`; exit 0; `19 passed`.
- **Final frontend suite** — `2026-09-06T22:47:09Z`: `pnpm --filter next-shadcn-dashboard-starter test`; exit 0; `118 passed`, `766 passed`.
- **Final static checks** — `2026-09-06T22:47:31Z`: `pnpm --filter next-shadcn-dashboard-starter typecheck`; exit 0; `tsc --noEmit`; and `pnpm --filter next-shadcn-dashboard-starter lint:strict`; exit 0; `oxlint --deny-warnings`.

Workload / PR boundary: I2A is the current `stacked-to-main` unit after I1 and before I2B; rollback removes the summary adapter and manager-products removal together. Browser and API tests were not run by instruction. Remaining I2B rows are:

- [ ] RED in `operational-homepage/manager-home.test.tsx`: assert successful-refreshing keeps truthful ready facts and range/tenant changes do not retain prior facts; record the focused failure. <!-- sdd-owner: implementation -->
- [ ] GREEN only the I2B allowlist: make the minimum source change only if the refreshing/range/tenant proof exposes a defect; rerun focused components. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE I2B with 7d/14d/30d and two tenant IDs, including exact latest summary query key/config; rerun focused components and BFF regression. <!-- sdd-owner: implementation -->
- [ ] REFACTOR I2B and run focused, BFF, owner, frontend suite, typecheck, lint, diff/accounting, and final seller regressions; record its independent ≤400-line boundary. <!-- sdd-owner: implementation -->

I3–I6, the two implementation verification rows, and four parent lifecycle rows remain unchecked in `tasks.md`.

## I2A loading-test evidence correction

- **Independent FAIL:** failed evidence omitted loading-state absence proof for summary-backed facts.
- **Missing proof:** all four metric labels and the three ready-empty messages are absent while the loading indicator is visible.
- **Focused GREEN:** `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 0; `2 passed`, `14 passed`.
- **Final diff:** 279 additions + 103 deletions = 382 changed lines (≤400).

## I2B — refreshing, range, and tenant proof
**Structured status consumed:** `gentle-ai.sdd-status@2` was native `apply-ready` for `manager-home-reference-fidelity` and `manager-home-i2b-transition-proof`; OpenSpec artifacts were present, action context was repo-local, and edits stayed within the injected I2B test/docs roots.
**Completed persisted rows:** I2B RED, GREEN, TRIANGULATE, and REFACTOR are `[x]` in `tasks.md`. The new behavioral characterization proves ready facts (including truthful empties) survive `isFetching`; 7d→14d→30d and tenant-1→tenant-2 show loading with no prior factual metrics/empty facts; every inspected latest `useQuery` config has only `queryKey`, `queryFn`, `enabled`, and both disabled background-refetch flags with the exact current tenant/range key. No production defect appeared, so `manager-home.tsx` stayed byte-identical (SHA-256 before/after `462fffee250e5600d859049ff3cb50b819d3b29d2d617590dc13e90c78f68e16`).
### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I2B transitions | Component behavior | focused 14/14 baseline could not run before dependency setup | not manufactured: I2A already supplied the behavior | GREEN-on-arrival after I2A split, focused 17/17 | 7d/14d/30d plus two realistic memberships/current key/config | test helpers only; focused 17/17, static/full regressions pass |
**Evidence:** `2026-09-07T00:48:00Z` focused manager/seller command exit 0 (17/17); `00:48:20Z` BFF summary command exit 0 (5/5), owner command exit 0 (19/19), and strict OpenSpec validation exit 0; `00:48:20Z` frontend suite exit 0 (118 files, 769 tests); `00:48:00Z` typecheck and strict lint both exit 0. The first post-install execution had non-behavioral test-selector assertions (`Últimos 14/30 días` instead of current `14/30 días`) and TypeScript/lint test-helper issues, all corrected in the test only; no fresh behavioral RED is reproducible because I2A's existing adapter/gate already implements the specified mechanism.

**Workload / PR boundary:** stacked-to-main I2B only, 120 test additions before SDD evidence/task metadata and no source correction; final accounting is 156 additions + 4 deletions = 160 changed lines (≤400), and rollback removes only these transition-characterization tests. No design deviation, browser/API/database run, review, receipt, commit, or lifecycle task occurred.

**Remaining implementation tasks (exact unchecked rows):**
- [ ] RED in `operational-homepage/manager-home.test.tsx`: assert bounded permitted activity/property records, real kind/text/time/destination, true empty states, summary-unavailable panels, and long property/activity wrapping; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [ ] GREEN only the I4 allowlist: render manager-only recent activity and top-properties lists from summary data with authorized engagement links and Argentina-local times; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE I4 with permitted versus excluded/inactive fixtures, link present versus unavailable destination, and empty-ready versus error; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [ ] REFACTOR I4 without modifying shared seller list contracts, rerun focused/typecheck/lint, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->
- [ ] RED in `operational-homepage/manager-home.test.tsx`: assert bounded top-seller real identities/counts and encoded follow-up links; assert navigation-policy and create-permission allowed/denied cases; assert forbidden facts/actions/terms never render; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [ ] GREEN only the I5 allowlist: map sellers and existing authorized property/follow-up/team/create shortcuts through centralized policy/capability helpers, failing closed on missing policy/route; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE I5 with create permission on/off, team policy on/off, seller identity/count variants, and forbidden #306/#327/reference-only copy; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [ ] REFACTOR I5 without role-name-only action authority or new destinations, rerun focused/typecheck/lint and owner/seller regressions, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->
- [ ] RED in `operational-homepage/manager-home.test.tsx` and `tests/seeded/demo-smoke.spec.ts`: assert names/focus/DOM order, long-text readability, target sizes, viewport geometry, and the seeded manager hierarchy; record a meaningful focused assertion failure without mutating seed data or mocking auth/permissions. <!-- sdd-owner: implementation -->
- [ ] GREEN only the I6 allowlist: apply semantic responsive/focus/wrapping polish and the one bounded serial seeded manager case; run focused components and the targeted seeded manager command successfully. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE I6 at 320×800, 375×812, 768×900, and 1280×900 with short/long display values while preserving real response semantics; rerun targeted seeded and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [ ] REFACTOR I6 without shell/mobile-chrome changes, rerun focused/typecheck/lint/targeted seeded/full seeded checks as environment permits, record skips accurately, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->
- [ ] Before each implementation PR, run `git diff --check`, `git diff --stat`, and `git status --short` from `viewpro-app/`; record actual additions + deletions, command exits, and focused evidence in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`, stopping for a measured >400-line cohesive diff. <!-- sdd-owner: implementation -->
- [ ] After I6, run the shared-matrix focused component, BFF, owner, frontend suite, typecheck, lint, targeted seeded, and full seeded commands; run API validation/typecheck/test only with a visibly disposable `DATABASE_URL`; record every pass, skip, and blocker in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`. <!-- sdd-owner: implementation -->


## I2B independent test-isolation correction

**Structured status consumed:** native `gentle-ai.sdd-status@2` reported authoritative OpenSpec `apply: ready`, `nextRecommended: apply`, 16/38 implementation rows complete, no blockers, and repo-local action context rooted at this worktree. **Action-context warning:** only the injected I2B test and apply-progress surfaces were edited; task checkboxes, production source, lifecycle, and delivery operations remain untouched.

- **Independent FAIL** — 2026-09-07T01:01:13Z: the settled candidate evidence `sha256:5b54580bd32b21d36b4b82ff59feaf7f2203409002d680ce62901fc9d26caf3f` was reproduced with `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx --sequence.shuffle --sequence.seed=1`; exit 1, 2 failed/5 passed because stale secondary tenant context yielded `tenant-2` where the tests required `tenant-1`.
- **Correction** — added `beforeEach` isolation that clears cumulative `useQueryMock` calls and `refetch`, then restores a typed primary tenant context. A concise typed helper creates both primary and secondary manager contexts; the tenant-transition test now uses the secondary helper, and the date-rendering test explicitly sets its own query state.
- **Focused GREEN** — 2026-09-07T01:01:13Z: the same seed-1 command exited 0 (7/7), seed-2 exited 0 (7/7), and `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 0 (2 files, 17/17).
- **Strict OpenSpec** — 2026-09-07T01:01:13Z: `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict` exited 0: `Change 'manager-home-reference-fidelity' is valid`.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I2B test isolation | Component test harness | focused manager/seller 17/17 | shuffled seed 1: 2 failures from leaked tenant context | seed 1: 7/7 | seed 2: 7/7 | helper/isolation only; focused 17/17 |

**Final accounting:** `git diff --check` exited 0; aggregate candidate numstat is 194 additions + 20 deletions = 214 changed lines (≤400). Production `manager-home.tsx` remains byte-identical at SHA-256 `462fffee250e5600d859049ff3cb50b819d3b29d2d617590dc13e90c78f68e16`. No task checkbox was changed, and no full suite, typecheck, lint, BFF, owner, browser, API, review, commit, push, PR, or lifecycle operation ran.

## I3 — blocked before RED by allowlist contradiction

**2026-09-07T01:30:15Z — status consumed:** parent supplied native `apply-ready` / `proceed` for `manager-home-i3-hierarchy-metrics-priorities`, fresh `develop@000f59ba`, and repo-local allowed roots. The reference asset was inspected and its SHA-256 was independently confirmed as `97cf2dc9a6a48b816e66090b2f62b7f8b465bdb7a0f52f8fa8f7976f0f75d3c9`. Task ownership markers are valid; `tasks.md` has 30 implementation-owned rows, 12 complete, and 18 unchecked.

**Blocker:** I3 cannot truthfully render the required DOM order from only its supplied edit surfaces. The actual manager composition, including greeting/date, the dominant-card placement, range selector, metric group, and `ManagerSummaryGate`, is defined in `apps/app-new/src/features/dashboard/components/operational-homepage.tsx`. That file is not an allowed I3 edit surface. The permitted `manager-home.tsx` contains only the atomic `useManagerSummary` adapter/gate and is imported by the disallowed parent; `manager-sections.tsx` does not exist or have a call site. Editing the adapter, shared primitives, or manager-only priority panel alone cannot move priorities after metrics or replace the local manager composition, and changing shared `KpiCard` semantics risks violating seller byte-identical behavior.

**Safety-net attempt:** from `viewpro-app/`, `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 1 before test execution because this fresh worktree has no `node_modules` and `vitest` was not found. This is environment setup failure, not RED evidence. No test or production file was changed; no I3 checkbox was marked.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I3 hierarchy/metrics/priorities | Component | blocked: `vitest` unavailable before execution | not started: source seam is outside allowlist | not started | not started | not started |

**Required decision:** authorize `apps/app-new/src/features/dashboard/components/operational-homepage.tsx` for I3 (and then permit dependency installation to run the strict-TDD safety net), or provide an already-wired manager presentation seam within the current allowlist. I4+, verification, and lifecycle rows remain unchecked. No design deviation, review, receipt, commit, push, PR, browser/API/database operation, or token disclosure occurred.

## I3 — corrected hierarchy, metrics, priorities, and range

**Structured status:** authoritative OpenSpec apply-ready/proceed handoff; repo-local roots only. **Candidate:** `feat/manager-home-reference-fidelity-i3`, base `000f59ba7b1d69628e3628baeca795b074915ccc`, corrected dirty tree; seller block SHA-256 `28b898c433a7549cc065bf6d24dc27f63911ebf526551069c892115fe845c339`. **Rescope authority:** emimontanari authorized the bounded rescope to permit manager composition/imports only.

### TDD Cycle Evidence

| Phase | UTC / branch-base | Exact command, exit, decisive output |
|---|---|---|
| RED | 2026-09-07T10:23:08Z / `feat/manager-home-reference-fidelity-i3` @ `000f59ba` dirty | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 1; named metrics list was absent. |
| GREEN | 2026-09-07T10:27:26Z / same candidate | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 11 passed. |
| TRIANGULATE | 2026-09-07T10:28:45Z / same candidate | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 21 passed, including 7d/14d/30d and zero/nonzero distinctions. |
| REFACTOR | 2026-09-07T10:35:24Z / same candidate | `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 21 passed after the concise order helper refactor. |

Final corrected-candidate checks: 2026-09-07T10:35:43Z BFF `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts` exit 0 (5 passed); owner `pnpm --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx` exit 0 (19 passed). Final proof correction: 2026-09-07T10:49:47Z `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx --sequence.shuffle --sequence.seed=1` exit 1 (ambiguous stale label), then test-only selector correction; 10:50:26Z BFF same exact command exit 0 (5 passed); 10:50:28Z owner same exact command exit 0 (19 passed).
2026-09-07T10:36:12Z `pnpm --filter next-shadcn-dashboard-starter typecheck` exit 0 (`tsc --noEmit`); 10:36:16Z `pnpm --filter next-shadcn-dashboard-starter lint:strict` exit 0 (`oxlint --deny-warnings`); 10:36:17Z `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict` exit 0 (`Change ... is valid`). 2026-09-07T10:51:30Z final `pnpm --filter next-shadcn-dashboard-starter typecheck`, `pnpm --filter next-shadcn-dashboard-starter lint:strict`, and `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict` each exited 0 (`tsc --noEmit`; `oxlint --deny-warnings`; `Change 'manager-home-reference-fidelity' is valid`).
2026-09-07T10:35:46Z `pnpm --filter next-shadcn-dashboard-starter test` exit 0 (118 files, 773 tests). Seeded correction: GitHub CI run/job `34115189670 / 101720852018` failed at `tests/seeded/demo-smoke.spec.ts:70` because removed `Ver propiedades` was still expected; 2026-09-07T11:30Z local-Docker targeted seeded manager smoke exit 0 (1 passed) and full seeded suite exit 0 (33 passed). Parent primary-LSP reran after correction across 7 changed TS/TSX files with 0 diagnostics. The final focused manager/seller command exits 0 (21 passed) after the activity-region expectation uses `Ver todo`; the full frontend suite exits 0 (118 files, 773 tests). No API command ran.

Completed persisted rows: I3 RED, GREEN, TRIANGULATE, and REFACTOR remain `[x]`; I4–I6 and the two verification rows remain pending. Files changed: manager composition, manager sections, primitives, priority panel, manager tests, the corrected focused manager expectation, the existing seeded manager smoke assertion, tasks, and this record. No design deviation; the only post-summary follow-up keeps its existing destination while the three greeting shortcuts are removed. Workload boundary: I3 only; final `git diff --check` exit 0 and accounting is 285 additions + 115 deletions = 400 changed lines (≤400).
