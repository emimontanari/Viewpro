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
