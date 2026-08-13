# Design: Seller Navigation PR Chain
## Chain and current boundary

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-policy → updated develop
                                                                                         → PR2 fix/seller-org-switcher-access → develop
```

PR0 ends with planning artifacts only. PR1 and PR2 are sequential `develop` PRs; PR2 is blocked until PR1 is merged.

## Policy model

PR1 introduces one readable access context and policy predicate for navigation. `resolved` answers whether context loading has completed; it does not infer membership. Membership is evaluated separately. `requireOrg`, role allowlist, and permission requirements are conjunctive; any protected requirement requires membership, and an empty role allowlist denies access.

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
| `viewpro-app/apps/app-new/AGENTS.md` | Document the navigation-policy boundary. |
| `viewpro-app/apps/app-new/docs/nav-rbac.md` | Document policy semantics and backend authority. |

**Forecast:** target ≤260 changed lines. **Verification:** focused tests, app test suite, strict lint, typecheck, and clean diff. **Rollback:** revert PR1 only.

## PR2: OrgSwitcher administration boundary

**Start:** updated `develop` after PR1. **End:** consume PR1 policy so AGENT cannot see the administration action while MANAGER and PRINCIPAL_MANAGER retain it. Existing agency switching, loading fail-closed behavior, accessibility, and persistence remain intact.

| Exact file | Intended change |
|---|---|
| `viewpro-app/apps/app-new/src/components/org-switcher.tsx` | Consume the PR1 policy for the existing administration action. |
| `viewpro-app/apps/app-new/src/components/org-switcher.test.tsx` | Verify AGENT, MANAGER, PRINCIPAL_MANAGER, loading, and preserved switching behavior. |

No radio conversion, role-label change, dropdown primitive change, or other user-visible OrgSwitcher redesign is approved. **Forecast:** honest target ≤180 changed lines; if that cannot be met, stop and return blocked. **Verification:** focused test, app test suite, strict lint, typecheck, and clean diff. **Rollback:** revert PR2 only; PR1 remains valid.

## Clean-diff rules

- PR0 changes only `openspec/changes/seller-navigation-scope/` planning artifacts.
- PR1 excludes OrgSwitcher, session, and dropdown files; PR2 excludes policy, navigation, and documentation rewrites except consuming the merged PR1 policy.
- Each PR starts from its declared `develop` revision and contains no #307 route/session hardening or #291 seeded-CI work.
- Re-scope a diff that exceeds its forecast or contains another work unit before review.
