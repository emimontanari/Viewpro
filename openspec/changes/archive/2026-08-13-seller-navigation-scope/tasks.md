# Tasks: Seller Navigation Scope (#284)

## Current chain marker

```text
develop → ✅ PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-pr1 → updated develop
                                                                                         → PR2 fix/seller-navigation-org-switcher → develop
```

PR0 is complete: PR #309 merged exactly these four planning artifacts as `2e0bd2a`; the prior PR #308 is closed. PR1 and PR2 implementation items remain independently tracked below.

## PR0: planning baseline

Started from clean `develop`. PR #309 staged, reviewed, approved, and merged these four planning artifacts to `develop` as `2e0bd2a`; PR #308 is closed. Value: establish the review contract. Verification: Markdown structure review, staged clean-diff checks, and no application-file changes. Rollback: revert the docs-only merge.

- [x] PR #309 versioned the proposal in `develop` as part of `2e0bd2a`, defining the sequential chain, boundaries, forecasts, and non-goals.
- [x] PR #309 versioned the specification in `develop` as part of `2e0bd2a`, defining #284 semantics, #307/#291 boundaries, and acceptance scenarios.
- [x] PR #309 versioned the design in `develop` as part of `2e0bd2a`, listing exact planned files, independent verification, rollback, forecasts, and clean-diff rules.
- [x] PR #309 versioned the tasks in `develop` as part of `2e0bd2a`, leaving every PR1/PR2 implementation item unchecked at the planning baseline.

## Commands

Run application commands from `viewpro-app`. Run PR0 Git evidence commands from the worktree root after staging only the intended files.

| Purpose | Command |
|---|---|
| PR1 focused tests | `pnpm --filter next-shadcn-dashboard-starter test src/lib/navigation-access.test.ts src/components/layout/app-sidebar.test.tsx src/components/kbar/palette.test.ts` |
| PR2 focused tests | `pnpm --filter next-shadcn-dashboard-starter test src/components/org-switcher.test.tsx` |
| App test suite | `pnpm --filter next-shadcn-dashboard-starter test` |
| Strict lint | `pnpm --filter next-shadcn-dashboard-starter lint:strict` |
| App typecheck | `pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit` |
| Root typecheck | `pnpm typecheck` |
| Production build | `pnpm --filter next-shadcn-dashboard-starter build` |
| Stage intended PR0 artifacts | `git add openspec/changes/seller-navigation-scope` |
| PR1 public diff count (worktree root) | `{ git diff --numstat origin/develop; git ls-files --others --exclude-standard -z \| xargs -0 -r -n1 sh -c 'git diff --no-index --numstat /dev/null "$0" \|\| true'; } \| awk '{a+=$1; d+=$2} END {print "additions=" a ", deletions=" d ", total=" a+d}'` |

## PR1: navigation policy and Sidebar/KBar parity

**Branch/base:** `fix/seller-navigation-pr1` from `develop` after PR0. **Forecast:** hard stop ≤400 total public changed lines. **Rollback:** revert PR1 only.

- [x] Add `viewpro-app/apps/app-new/src/lib/navigation-access.ts` and `navigation-access.test.ts` with separate resolved context and membership semantics; require role and permission conjunctively; deny empty role allowlists and matching-role/missing-permission access.
- [x] Update `viewpro-app/apps/app-new/src/types/index.ts`, `config/nav-config.ts`, and `hooks/use-nav.ts` to use the central policy; export immutable `workspaceAdministrationAccess` for PR2 and reuse it for `Inmobiliarias` and `Equipo`.
- [x] Create `viewpro-app/apps/app-new/src/components/layout/app-sidebar.test.tsx`; verify realistic MANAGER, PRINCIPAL_MANAGER, AGENT, and loading sets. (Post-hoc causal reconstruction; user-approved exception; not historical RED.)
- [x] Update `viewpro-app/apps/app-new/src/components/kbar/palette.test.ts` for parity. (Post-hoc causal reconstruction; user-approved exception; not historical RED.)
- [x] Update `viewpro-app/apps/app-new/AGENTS.md` and `docs/nav-rbac.md` with the policy and backend-authorization boundary.
- [x] Run the PR1 focused tests, app test suite, strict lint, app/root typecheck, production build, and clean-diff command.

**Clean diff:** these four OpenSpec contract files plus only the app files named above, including `src/test/navigation-access-fixtures.ts`. No OrgSwitcher, session, dropdown, #307 route/session hardening, or #291 seeded-CI work. Re-scope before review if the total public diff exceeds 400 changed lines.

## PR2: OrgSwitcher administration access

**Branch/base:** `fix/seller-navigation-org-switcher` from `develop` at `b22adfde20d705d015cba269177fb912df548c8a` after PR1 merges. **Forecast:** hard stop ≤400 total public changed lines. **Delivery:** `auto-chain`, `stacked-to-main`, sequential `develop`. **Rollback:** revert PR2 only.

- [x] Add `org-switcher.test.tsx` first and prove AGENT/loading denial, shared-policy manager/principal access, session-only options, exact labels, radio semantics/indicator, keyboard selection, and real persistence-before-refresh.
- [x] Update `org-switcher.tsx` with the smallest policy/radio implementation; update canonical labels and ItemIndicator surface only if required by the rendered contract.
- [x] Reconcile the four active OpenSpec files, then run the PR2 focused test, app test suite, strict lint, app/root typechecks, production build, and untracked-aware clean-diff command.

**Clean diff:** these four OpenSpec contract files plus `org-switcher.tsx`, `org-switcher.test.tsx`, and only the minimal `session.ts`/`dropdown-menu.tsx` surfaces required by the contract. No SessionProvider/tenant-selection, backend/routes, #307, #291, CI, commits, pushes, or PR operations.

## Non-goals

- #307 route/session hardening.
- #291 seeded CI.
- Backend authorization, new permissions, data-scope changes, migrations, generated work, commits, pushes, or PR operations.
