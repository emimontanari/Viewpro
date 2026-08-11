# Tasks: Seller Navigation Scope (#284)

## Current chain marker

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-policy → updated develop
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
| PR1 focused tests | `pnpm --filter next-shadcn-dashboard-starter test src/lib/navigation-access.test.ts src/components/layout/app-sidebar.test.tsx` |
| PR2 focused tests | `pnpm --filter next-shadcn-dashboard-starter test src/components/org-switcher.test.tsx` |
| App test suite | `pnpm --filter next-shadcn-dashboard-starter test` |
| Strict lint | `pnpm --filter next-shadcn-dashboard-starter lint:strict` |
| Typecheck | `pnpm typecheck` |
| Stage intended PR0 artifacts | `git add openspec/changes/seller-navigation-scope` |
| Staged whitespace check | `git diff --cached --check` |
| Staged path/stat evidence | `git diff --cached --name-status && git diff --cached --stat && test -z "$(git diff --cached --name-only -- . ':(exclude)openspec/changes/seller-navigation-scope/**')"` |

## PR1: navigation policy and Sidebar/KBar parity

**Branch/base:** `fix/seller-navigation-policy` from `develop` after PR0. **Forecast:** target ≤260 changed lines. **Rollback:** revert PR1 only.

- [ ] Add `viewpro-app/apps/app-new/src/lib/navigation-access.ts` and `navigation-access.test.ts` with separate resolved context and membership semantics; require `requireOrg`, role, and permission conjunctively; deny empty role allowlists and matching-role/missing-permission access.
- [ ] Update `viewpro-app/apps/app-new/src/types/index.ts`, `config/nav-config.ts`, and `hooks/use-nav.ts` to use the central policy.
- [ ] Update `viewpro-app/apps/app-new/src/components/layout/app-sidebar.test.tsx` to verify rendered Sidebar and KBar parity for complete realistic MANAGER, PRINCIPAL_MANAGER, AGENT, and loading sets.
- [ ] Update `viewpro-app/apps/app-new/AGENTS.md` and `docs/nav-rbac.md` with the policy and backend-authorization boundary.
- [ ] Run the PR1 focused tests, app test suite, strict lint, typecheck, and clean-diff command.

**Clean diff:** only the files named above. No OrgSwitcher, session, dropdown, #307 route/session hardening, or #291 seeded-CI work.

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
