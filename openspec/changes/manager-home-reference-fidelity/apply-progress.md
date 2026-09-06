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

Workload / PR boundary: stacked-to-main I1 only; rollback reverses this dispatcher/heading/date change without restoring broad non-agent manager routing. No design deviation. Remaining exact unchecked I2 rows are:

- [ ] RED in `operational-homepage/manager-home.test.tsx`: assert sole manager summary query, no manager products request/fallback, loading not factual, all-zero successful data truthful, error precedence over stale data, disabled retry while fetching, and retry calls current summary `refetch`; run the focused component command and record the intended failure.
- [ ] GREEN only the I2 allowlist: introduce the discriminated atomic manager summary state and query container, retain tenant/range key and 10-second BFF behavior, remove manager products composition, and rerun focused components plus BFF regression successfully.
- [ ] TRIANGULATE I2 with range and tenant changes, zero-ready versus error, and retrying versus ready; rerun focused component and BFF commands successfully.
- [ ] REFACTOR I2 without changing seller queries or BFF/API code, rerun focused/BFF/frontend suite/typecheck/lint as applicable, record evidence, measure ≤400 lines, and prepare its independent rollbackable PR.

I3–I6 and the two Verification rows remain unchecked verbatim in `tasks.md`; they are outside I1.

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
