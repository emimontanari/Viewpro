# Tasks: Seller Navigation Scope (#284)

## Current chain marker

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-pr1 → updated develop
                                                                                         → PR2 fix/seller-org-switcher-access → develop
```

PR0 is planning only. PR2 is blocked until PR1 merges.

## PR0: planning baseline

Start from clean `develop`. Prepare the four planning artifacts. Keep every PR0 delivery checkbox unchecked until the intended files have been staged and reviewed, committed, approved in a PR, and merged to `develop`. Value: establish the review contract. Verification: Markdown structure review, staged clean-diff checks, and no application-file changes. Rollback: revert the docs-only merge.

- [ ] After staged review, commit, PR approval, and merge, the proposal is versioned in `develop` and defines the sequential chain, boundaries, forecasts, and non-goals.
- [ ] After staged review, commit, PR approval, and merge, the specification is versioned in `develop` and defines #284 semantics, #307/#291 boundaries, and acceptance scenarios.
- [ ] After staged review, commit, PR approval, and merge, the design is versioned in `develop` and lists exact planned files, independent verification, rollback, forecasts, and clean-diff rules.
- [ ] After staged review, commit, PR approval, and merge, the tasks are versioned in `develop` and leave every PR1/PR2 implementation item unchecked.

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

**Branch/base:** `fix/seller-org-switcher-access` from `develop` after PR1 merges. **Forecast:** honest target ≤180 changed lines; return blocked if that cannot be met. **Rollback:** revert PR2 only.

- [ ] Update `viewpro-app/apps/app-new/src/components/org-switcher.tsx` to consume PR1 policy and hide only the administration action for AGENT.
- [ ] Update `viewpro-app/apps/app-new/src/components/org-switcher.test.tsx` for AGENT absence, MANAGER/PRINCIPAL_MANAGER presence, loading fail-closed behavior, and existing agency switching, accessibility, and persistence.
- [ ] Run the PR2 focused test, app test suite, strict lint, typecheck, and clean-diff command.

**Clean diff:** only the two named OrgSwitcher files. Do not convert to Radix radios, add role labels, change dropdown primitives, or introduce another user-visible redesign.

## Non-goals

- #307 route/session hardening.
- #291 seeded CI.
- Backend authorization, new permissions, data-scope changes, migrations, generated work, commits, pushes, or PR operations.
