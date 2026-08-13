# Design: Seller Navigation PR Chain
## Chain and current boundary

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-pr1 → updated develop
                                                                                          → PR2 fix/seller-navigation-org-switcher → develop
```

PR0 ends with planning artifacts only. PR1 and PR2 are sequential `develop` PRs; PR2 is blocked until PR1 is merged.

## Policy model

PR1 introduces one readable access context and policy predicate for navigation. `resolved` answers whether context loading has completed; it does not infer membership. Membership is evaluated separately. Role allowlists and permission requirements are conjunctive; any protected requirement requires membership, and an empty role allowlist denies access.

This model keeps protected navigation fail-closed during loading, including when an earlier membership value is retained. It controls user-interface affordances only; backend authorization remains authoritative.

## PR1: navigation policy and parity

**Start:** clean `develop` after PR0. **End:** policy, types, navigation configuration, `useNav`, rendered Sidebar/KBar parity, and documentation. OrgSwitcher, session, and dropdown primitives remain unchanged.

| Exact file | Intended change |
|---|---|
| `viewpro-app/apps/app-new/src/lib/navigation-access.ts` | Add access context, policy definitions, and predicate. |
| `viewpro-app/apps/app-new/src/lib/navigation-access.test.ts` | Cover resolution, membership, conjunction, empty roles, and missing permission. |
| `viewpro-app/apps/app-new/src/types/index.ts` | Add policy role-allowlist typing. |
| `viewpro-app/apps/app-new/src/config/nav-config.ts` | Attach navigation policies to existing entries. |
| `viewpro-app/apps/app-new/src/hooks/use-nav.ts` | Build and consume the shared context. |
| `viewpro-app/apps/app-new/src/components/layout/app-sidebar.test.tsx` | Create this new test file to verify rendered Sidebar parity for MANAGER, PRINCIPAL_MANAGER, AGENT, and loading. |
| `viewpro-app/apps/app-new/src/components/kbar/palette.test.ts` | Update the existing KBar test for parity with the rendered Sidebar cases. |
| `viewpro-app/apps/app-new/src/test/navigation-access-fixtures.ts` | Share exact role and loading destinations across Sidebar and KBar tests. |
| `viewpro-app/apps/app-new/AGENTS.md` | Document the navigation-policy boundary. |
| `viewpro-app/apps/app-new/docs/nav-rbac.md` | Document policy semantics and backend authority. |

`workspaceAdministrationAccess` is the immutable PR2 seam: `MANAGER`/`PRINCIPAL_MANAGER` + `team.view`, reused by `Inmobiliarias` and `Equipo`. **Public boundary:** these four OpenSpec contract files plus the app files listed above. **Forecast:** hard stop ≤400 total public changed lines. **Verification:** focused policy, Sidebar, and KBar tests; app suite; strict lint; app/root typecheck; production build; clean diff. **Rollback:** revert PR1 only.

## PR2: OrgSwitcher administration boundary

**Start:** branch `fix/seller-navigation-org-switcher` from updated `develop` base `b22adfde20d705d015cba269177fb912df548c8a` after PR1. **End:** consume `workspaceAdministrationAccess` through `canAccessNavigation`, so AGENT and loading states cannot see administration while MANAGER and PRINCIPAL_MANAGER with `team.view` retain it. Existing agency switching becomes one `DropdownMenuRadioGroup` of session memberships with canonical role labels, `DropdownMenuRadioItem`/ItemIndicator state, and the existing persistence-before-refresh function.
**Exact nine-path candidate:** `openspec/changes/seller-navigation-scope/{design.md,proposal.md,specs/seller-navigation-scope/spec.md,tasks.md,verify-report.md}`; `viewpro-app/apps/app-new/src/{components/org-switcher.tsx,components/org-switcher.test.tsx,components/ui/dropdown-menu.tsx,lib/session.ts}`; 329 additions + 65 deletions = **394/400 changed lines**.

| Exact file | Intended change |
|---|---|
| `viewpro-app/apps/app-new/src/components/org-switcher.tsx` | Consume the policy and render session membership radio switching. |
| `viewpro-app/apps/app-new/src/components/org-switcher.test.tsx` | Verify access, loading, labels, radio semantics, keyboard input, and real persistence ordering. |
| `viewpro-app/apps/app-new/src/lib/session.ts` | Provide exact canonical membership role labels. |
| `viewpro-app/apps/app-new/src/components/ui/dropdown-menu.tsx` | Expose the existing radio ItemIndicator to visible-state coverage. |

No SessionProvider/tenant-selection redesign, backend/routes, #307, or #291 work is approved. **Forecast:** hard stop ≤400 total public changed lines. **Verification:** focused test, app test suite, strict lint, app/root typecheck, production build, and clean diff. **Rollback:** revert PR2 only; PR1 remains valid.

## Clean-diff rules

- PR0 changes only `openspec/changes/seller-navigation-scope/` planning artifacts.
- PR1 excludes OrgSwitcher, session, and dropdown files; PR2 excludes policy/navigation rewrites but includes the four reconciled OpenSpec contract files and only the minimal OrgSwitcher/session/dropdown surfaces named above.
- Each PR starts from its declared `develop` revision and contains no #307 route/session hardening or #291 seeded-CI work.
- Re-scope a PR1 diff that exceeds 400 total public changed lines or contains another work unit before review.
