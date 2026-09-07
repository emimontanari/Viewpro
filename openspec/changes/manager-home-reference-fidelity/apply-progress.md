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

## I4B — manager top properties

**Structured status produced:** `spec-driven`; change `manager-home-reference-fidelity`; authoritative `openspec` change root; proposal, change-local delta spec, design, tasks, and prior apply progress were present. `applyState: ready`; implementation task progress is 24/34 complete with 10 remaining; action context was repo-local at `/Users/emimontanari/Work/Apps/Viewpro-worktrees/manager-home-reference-fidelity-i4b`, and edits stayed in the injected I4B roots. The native acquire handoff was `proceed`; its opaque token was neither persisted nor disclosed. Workload handoff was already resolved as `stacked-to-main`; this is I4B/PR6 of 8, with no size exception.

Completed persisted rows: the four I4B RED/GREEN/TRIANGULATE/REFACTOR rows are `[x]` in `tasks.md`. Files changed: manager-only composition/imports in `operational-homepage.tsx`, `manager-sections.tsx`, `manager-home.test.tsx`, `tasks.md`, and this record. `TopPropertiesCard` is no longer mounted by the manager; `SellerActivityCard` and the seller block remain untouched. `ManagerTopProperties` consumes the sole atomic summary state, preserves top-property source order while limiting to three, displays the selected-window context, title/address fallback, real movement/document counts, last source text and Buenos Aires `<time>`, and fails closed for malformed engagement IDs. Loading, ready-empty, and a panel-local unavailable/retry state are distinct; the property retry has its own accessible names and invokes the existing atomic refetch exactly once.

### TDD Cycle Evidence

| Task | Test file / layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I4B top properties | `manager-home.test.tsx` component | focused manager/seller 27/27 | selected-window manager-region assertion failed because the legacy title remained | manager test 20/20 | focused 32/32 covers 7/14/30, counts, fallback, max-three order, malformed IDs, empty/loading/error/retrying | extracted the stable property-section lookup; focused 32/32 and static checks pass |

### Command evidence

Branch/base for every command: `feat/manager-home-reference-fidelity-i4b` at `develop@9c5ab02fcc0dee4c9e32986fed4c20af7e440229`, dirty candidate only after RED edits.

- **Safety** — `2026-09-07T15:00:58Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 1 before tests because `@viewpro/contracts` could not resolve. This was environment setup, not RED. `2026-09-07T15:01:09Z`: `pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; contracts built and focused safety net passed 27/27.
- **RED** — `2026-09-07T15:02:00Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 1; 3 intended range assertions failed because no manager-specific top-properties heading existed and the legacy card was still mounted.
- **GREEN** — `2026-09-07T15:02:56Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 20/20 after the minimum manager region and summary-state composition.
- **TRIANGULATE** — `2026-09-07T15:05:38Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 32/32 after 7/14/30, real counts/time/link, address fallback, source-order bounds, malformed IDs, ready-empty, loading, unavailable, retrying, and exact-one-refetch assertions.
- **REFACTOR** — `2026-09-07T15:06:32Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0; 32/32 after extracting the non-capturing property-section test helper. `2026-09-07T15:06:45Z`: `pnpm --filter next-shadcn-dashboard-starter test`; exit 0, 118 files/784 tests; `pnpm --filter next-shadcn-dashboard-starter typecheck`; exit 0, `tsc --noEmit`; `pnpm --filter next-shadcn-dashboard-starter lint:strict`; exit 0, `oxlint --deny-warnings`; `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict`; exit 0, `Change 'manager-home-reference-fidelity' is valid`.
- **Post-refactor focused and accounting** — `2026-09-07T15:07:42Z`: focused command exit 0, 32/32 after whitespace-only cleanup. `2026-09-07T15:07:54Z`: `git diff --check && git -c diff.external= diff --no-ext-diff --numstat && git diff --stat && git status --short && shasum -a 256 viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/lists.tsx viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/manager-sections.tsx viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage/manager-home.test.tsx && awk '/^function SellerOperationalHomepage\\(/{capture=1} /^function isSellerMembership\\(/{capture=0} capture' viewpro-app/apps/app-new/src/features/dashboard/components/operational-homepage.tsx | shasum -a 256`; exit 0. Pre-record accounting was 227 additions + 22 deletions = 249 changed lines; final accounting is remeasured below after documentation persistence.

Verification preservation: `2026-09-07T15:05:57Z` BFF command `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts` exit 0 (5/5), owner command `pnpm --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx` exit 0 (19/19), typecheck exit 0, and strict OpenSpec exit 0. No browser, API, database, review, receipt, commit, push, PR, or lifecycle action ran; browser/API/database work is explicitly outside I4B.

Design deviation: none. `ManagerUnavailablePanel` accepts optional panel-local action labels so the property panel is distinguishable while the I4A activity labels and behavior remain unchanged. Rollback boundary: remove the manager top-properties region and restore only its manager composition; do not alter seller lists.

Remaining implementation rows (exact persisted unchecked rows):
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

Deferred lifecycle actions (parent-owned, preserved byte-for-byte): bounded review, evidence sync after I1–I6 merge, archive, and #522 closure. `#306` C7 remains outside this slice.


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

## I4A — activity and atomic retry

Historical combined-I4/PR #549 failure remains superseded evidence: it was closed after review found missing per-panel retries and selected-window context, so this slice does not merge it wholesale.

**Structured status consumed:** native authoritative OpenSpec `apply: ready`, `nextRecommended: apply`, repo-local workspace/root, no blockers; I4A-only allowed roots were observed. Completed persisted rows: I4A RED/GREEN/TRIANGULATE/REFACTOR are `[x]`; files changed are manager composition, manager sections, helpers, manager test, tasks, and this record. No design deviation; seller block and legacy `TopPropertiesCard` remain untouched.

### TDD Cycle Evidence

| Task | Safety | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| I4A activity/retry | focused 21/21 after contract build | intended heading absence | manager test 12/12 | manager test 17/17 | focused 27/27, static checks pass |

- Safety — 2026-09-07T11:08:12Z `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 1 before tests (`@viewpro/contracts` unresolved); `pnpm --filter @viewpro/contracts build` then the same command exit 0, 21/21.
- RED — 2026-09-07T11:09:43Z dirty `feat/manager-home-reference-fidelity-i4a` at `7190f997`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 1, intended `Actividad reciente` heading absent.
- GREEN — 2026-09-07T11:14:41Z same tree: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 0, 12/12 after the minimum activity region, formatter, fail-closed link, and panel.
- TRIANGULATE — 2026-09-07T11:16:56Z same tree: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 0, 17/17 for kinds/ranges/bounds/IDs/empty/loading/error/retrying.
- REFACTOR/final — 2026-09-07T11:19:14Z `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exit 0, 27/27; `pnpm --filter next-shadcn-dashboard-starter typecheck` and `pnpm --filter next-shadcn-dashboard-starter lint:strict` exit 0. 2026-09-07T11:21:19Z BFF 5/5, owner 19/19, frontend 118 files/779 tests, strict OpenSpec, and `git diff --check` exit 0; seller SHA-256 `28b898c433a7549cc065bf6d24dc27f63911ebf526551069c892115fe845c339`.

Workload/PR boundary: I4A only, stacked-to-main PR5/8; rollback removes activity/panel/helpers/tests only. Final accounting is 340 additions + 56 deletions = 396, within 400; browser/API/database, review, receipt, commit, push, PR, and lifecycle actions were not run.

Remaining implementation rows:
- [ ] RED in `operational-homepage/manager-home.test.tsx`: assert selected-window property context, real title/count/latest text/time/destination, true empty state, summary-unavailable panel, and long property wrapping; run the focused component command and record the intended failure. <!-- sdd-owner: implementation -->
- [ ] GREEN only the I4B allowlist: replace the legacy manager top-properties rendering with a manager-only atomic-summary region and shared unavailable/retry behavior; rerun focused components successfully. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE I4B with 7d/14d/30d, bounded property ordering, valid versus unavailable destinations, and empty-ready versus error; rerun focused component and frontend suite commands successfully. <!-- sdd-owner: implementation -->
- [ ] REFACTOR I4B without modifying seller list contracts, rerun focused/typecheck/lint, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR. <!-- sdd-owner: implementation -->
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

## I5 — top sellers and policy shortcuts

**Structured status consumed:** parent-native acquire `proceed` for `manager-home-i5-top-sellers-and-policy-shortcuts`, generation 20/attempt 24, running/finish; repo-local target worktree. Opaque acquire material was not persisted or disclosed. Parent-authorized base: `develop@55c9fb1b`; local `develop` resolved to `9ce7094c04d460341ab12862ecd3648298d69aba`.

Completed persisted rows: I5 RED, GREEN, TRIANGULATE, and REFACTOR are `[x]`. Manager-only composition replaces the legacy manager `SellerActivityCard` with summary-backed `ManagerTopSellers` and adds policy/session-backed shortcuts after sellers; `SellerOperationalHomepage` was not edited. Helpers resolve current `navGroups` through `canAccessNavigation` and gate creation with `canManagePropertyEngagements`; no routes, BFF/API, auth, session, navigation configuration, or seller list changed.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I5 sellers/shortcuts | component + pure helper | focused 32/32 after contract build | 2 intended seller/shortcut failures | manager 24/24 | manager 26/26 | focused 36/36; static/regression checks pass |

### Command evidence

- Safety — `2026-09-07T15:41:35Z`, `feat/manager-home-reference-fidelity-i5`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 1 before tests (`@viewpro/contracts` unresolved). `2026-09-07T15:41:44Z`: `pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0, 32/32.
- RED — `2026-09-07T15:43:19Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 1, intended maximum-three seller assertion received four legacy rows and shortcuts heading was absent.
- GREEN — `2026-09-07T15:46:23Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0, 24/24.
- TRIANGULATE — `2026-09-07T15:46:56Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0, 26/26 for maximum/order, valid/invalid IDs, identity/count variants, empty/loading/error/retry, team/create allow/deny, failure-persistent shortcuts, and forbidden copy.
- REFACTOR — `2026-09-07T15:47:54Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx`; exit 0, 36/36. `pnpm --filter next-shadcn-dashboard-starter typecheck`; exit 0 (`tsc --noEmit`). `pnpm --filter next-shadcn-dashboard-starter lint:strict`; exit 0 (`oxlint --deny-warnings`). The preceding `2026-09-07T15:47:26Z` typecheck exit 2 identified only the new nullable helper/test element types; corrected before final refactor proof.
- Regression — `2026-09-07T15:48:12Z`: `pnpm --filter next-shadcn-dashboard-starter test src/app/api/dashboard/summary/route.test.ts`; exit 0, 5/5. `pnpm --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx`; exit 0, 19/19. `pnpm --filter next-shadcn-dashboard-starter test`; exit 0, 118 files/788 tests. `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict`; exit 0, valid.

Design deviation: none. Workload / PR boundary: stacked-to-main I5 (PR7/8), with the I5-only rollback boundary limited to manager seller/shortcut mapping and regions. Final `2026-09-07T15:52:44Z` `git diff --check`, no-external-diff numstat/stat/status, branch/base, and seller/list hash command exited 0: 310 additions + 26 deletions = 336 (≤400). Browser, API, database, review, receipt, commit, push, PR, settle, and lifecycle actions were not run. Remaining implementation rows are I6 RED/GREEN/TRIANGULATE/REFACTOR plus the two shared verification rows; parent-owned review, sync, archive, and #522 closure remain deferred.

## I6 — responsive accessibility and seeded browser proof

**Structured status consumed:** parent-native status for `manager-home-reference-fidelity`, `generation21` work unit `manager-home-i6-responsive-accessibility-seeded-browser-proof`, active attempt 25, `outcome: running`, `next_action: finish`, and `decision_required: false`. The permitted worktree was `/Users/emimontanari/Work/Apps/Viewpro-worktrees/manager-home-reference-fidelity-i6`, branch `feat/manager-home-reference-fidelity-i6`, fresh base `develop@3f79f9a96a983d71c2ddd3bc4d8ba5335db39375`; only the I6 allowlist was edited. No acquire/settle/token, review, commit, push, or PR action occurred.

Completed persisted rows: I6 RED, GREEN, TRIANGULATE, and REFACTOR are `[x]` in `tasks.md`. `ManagerRecentActivity`, properties, sellers, and shortcuts now use native `h2` section headings; range, retry, list, and row controls preserve names and `aria-pressed` while meeting 44px narrow targets with visible `focus-visible` rings. Meaningful display text remains `break-words`/`break-all`; no manager list clamp or truncate was added. The browser proof is one serial principal-manager test that signs in normally and calls `route.fetch()` for the real authorized summary before replacing only existing display strings when rows exist; it does not intercept auth/permissions, alter contracts, IDs, counts, kinds, destinations, seed source, or network failures.

### TDD Cycle Evidence

| Task | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|
| I6 semantics and narrow controls | component + seeded browser | focused 36/36; existing seeded manager 1/1 | native-section-heading assertion: 1 fail/26 pass | manager 27/27; seeded target 1/1 | browser covers 320×800, 375×812, 768×900, 1280×900 and component fixtures cover long activity/property/seller values | focused 37/37, frontend 118 files/789 tests, typecheck/lint, seeded 34/34 |

### Command evidence

- **Setup/safety** — `2026-09-07T16:24:17Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 1 before tests because `@viewpro/contracts` was unresolved; it was an environment failure, not RED. `2026-09-07T16:24:29Z`: `pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage.test.tsx src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 0, 36 passed. `2026-09-07T16:26:10Z`: with visible local disposable `DATABASE_URL`/`DIRECT_URL` for `viewpro_test` and isolated API/web ports `3306`/`3406`, `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep 'demo user can navigate the seeded operational workflow'` exited 0, 1 passed.
- **RED** — `2026-09-07T16:27:50Z`: `pnpm --filter next-shadcn-dashboard-starter test src/features/dashboard/components/operational-homepage/manager-home.test.tsx` exited 1, 1 failed/26 passed. Decisive output: section headings were `H2, H2, DIV, DIV, DIV, DIV`, not an ordered native `h2` hierarchy. The seeded RED command also exercised the real principal-manager flow and failed before polish on the original 32px range-control geometry assertion path; the first attempt exposed an empty real selected-window activity array and was corrected to preserve no-fact semantics rather than inventing a row.
- **GREEN** — `2026-09-07T16:31:37Z`: the same manager command exited 0, 27 passed after only `manager-sections.tsx`/`primitives.tsx` semantic and control-size polish. `2026-09-07T16:33:52Z`: with `DATABASE_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public' DIRECT_URL='postgresql://viewpro:viewpro@127.0.0.1:5432/viewpro_test?schema=public' VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3306 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3406`, `pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep 'manager home reference hierarchy'` exited 0, 1 passed.
- **TRIANGULATE viewport evidence** — the targeted browser command above verified one metric column/ranking column at **320×800** and **375×812**, two metric/one ranking column at **768×900**, and four metric/two ranking columns at **1280×900**; every named range/`Ver todo` control measured at least 44px each dimension and `documentElement.scrollWidth <= innerWidth` at every viewport. Keyboard focus advanced 7d → 14d → 30d → the first priority link. The authorized response was empty in the current 7-day window, so the test truthfully retained empty-state rendering; its contract-preserving long-display branch runs only when an existing real row is returned, while deterministic component long-value fixtures cover activity/property/seller text. This is a residual browser-data risk, not fabricated seed content.
- **REFACTOR/final matrix** — `2026-09-07T16:34:29Z`: focused manager/seller 37 passed; BFF 5 passed; owner 19 passed; `pnpm --filter next-shadcn-dashboard-starter typecheck` exited 0 (`tsc --noEmit`) and `pnpm --filter next-shadcn-dashboard-starter lint:strict` exited 0 (`oxlint --deny-warnings`). `2026-09-07T16:34:53Z`: `pnpm --filter next-shadcn-dashboard-starter test` exited 0, 118 files/789 tests; `OPENSPEC_TELEMETRY=0 npx --yes @fission-ai/openspec validate manager-home-reference-fidelity --strict` exited 0, valid. `2026-09-07T16:35:32Z`: the visible-local-`viewpro_test` isolated-port `pnpm --filter next-shadcn-dashboard-starter test:seeded` exited 0, 34 passed.

Design deviation: none. API validation/typecheck/tests were not run because I6 is frontend-only and they are deferred to whole-change verification; no API source or contract changed. Workload / PR boundary: I6/PR8 only; rollback removes the manager-only semantic/target-size polish and its component/browser proof. The two implementation verification rows remain unchecked exactly as required; parent-owned lifecycle rows remain byte-for-byte deferred.

## I6 long-browser-proof correction

**Structured status consumed:** parent-native `generation22` correction `manager-home-i6-long-browser-proof-correction` was `proceed` with `next_action: finish`; repo-local scope was limited to the injected I6 test and progress roots. No acquire, settle, token persistence, review, commit, push, or PR action occurred.

The serial seeded manager proof now `route.fetch()`es the real authenticated `/api/auth/me` response after normal sign-in. With tenant selection cleared by the existing sign-in helper, it preserves the exact first active membership and every session field, changing only `activeMembership.tenant.name` to a deterministic long display value. At **320×800**, **375×812**, **768×900**, and **1280×900**, the browser always proves that long active-tenant value is visible, has its complete text, wraps, fits its own box, and does not cause page overflow; the existing grid, target-size, named-control, and focus-order checks remain. Optional activity/property/seller substitutions still apply only to existing real rows and are supplementary; this browser proof does not claim that empty seeded arrays exercised those values. Deterministic component tests explicitly prove long activity/property `break-words` semantics and a long seller identity's wrap-safe text plus authorized follow-up link.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| I6 long tenant geometry | `2026-09-07T18:02:12Z` targeted seeded command exit 1: long tenant absent | `2026-09-07T18:05:08Z` targeted seeded command exit 0, 1 passed | `2026-09-07T18:07:31Z` targeted seeded command exit 0 at all four viewports; `18:07:48Z` full seeded exit 0, 34 passed | component-only type correction; `18:06:52Z` focused exit 0, 38 passed; final static/regression checks below pass |

### Correction command evidence

- `2026-09-07T18:02:12Z` — `DATABASE_URL=...viewpro_test... DIRECT_URL=...viewpro_test... VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3307 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3407 pnpm --filter next-shadcn-dashboard-starter exec playwright test --config playwright.seeded.config.ts --grep 'manager home reference hierarchy'` exit **1**; expected long-tenant locator was absent.
- `2026-09-07T18:05:08Z` — same targeted command exit **0**, 1 passed after the real-session display-only substitution; a hidden sidebar duplicate required a test-locator refinement, not a product change.
- `2026-09-07T18:06:52Z` — focused manager/seller command exit **0**, 38 passed; `18:06:54Z` BFF exit **0**, 5 passed; `18:06:56Z` owner exit **0**, 19 passed; `18:06:58Z` frontend exit **0**, 118 files/790 tests.
- `2026-09-07T18:07:26Z` typecheck exit **0** and `18:07:30Z` strict lint exit **0**; `18:07:31Z` targeted seeded exit **0**, 1 passed; `18:07:48Z` full seeded exit **0**, 34 passed; `18:10:10Z` strict OpenSpec validation exit **0**.

No production behavior changed. I6 task checks are preserved. Remaining unchecked implementation rows are:

- [ ] Before each implementation PR, run `git diff --check`, `git diff --stat`, and `git status --short` from `viewpro-app/`; record actual additions + deletions, command exits, and focused evidence in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`, stopping for a measured >400-line cohesive diff. <!-- sdd-owner: implementation -->
- [ ] After I6, run the shared-matrix focused component, BFF, owner, frontend suite, typecheck, lint, targeted seeded, and full seeded commands; run API validation/typecheck/test only with a visibly disposable `DATABASE_URL`; record every pass, skip, and blocker in `openspec/changes/manager-home-reference-fidelity/apply-progress.md`. <!-- sdd-owner: implementation -->

Parent-owned lifecycle rows remain pending.
