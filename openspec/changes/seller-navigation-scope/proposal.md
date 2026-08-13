# Proposal: Seller Navigation Scope (#284)
## Decision

Deliver approved issue #284 as a three-step sequential chain to `develop`. PR0 is a planning baseline only; PR1 centralizes navigation policy and parity; PR2 applies that merged policy to the existing organization switcher.

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-pr1 → updated develop
                                                                                          → PR2 fix/seller-navigation-org-switcher → develop
```

## Chain contract

| PR | Start and end | Value | Forecast |
|---|---|---|---|
| 📍 PR0 | Start clean `develop`; end with versioned proposal, specification, design, and tasks | Establishes the review contract | Planning only; no code |
| PR1 | Start from `develop` after PR0; end with central context, policy, types, navigation configuration, `useNav`, readable Sidebar/KBar parity, and documentation | Removes unauthorized navigation affordances consistently | Hard stop ≤400 total public changed lines |
| PR2 | Start from `develop` after PR1 merges; end by consuming PR1 policy for the administration action and completing accessible membership switching | Completes the access boundary without backend or session-provider redesign | Hard stop ≤400 total public changed lines |

PR2 is blocked until PR1 merges. Each implementation PR targets its stated `develop` revision, not another feature branch.

**Current PR2 candidate boundary:** branch `fix/seller-navigation-org-switcher` from `develop` base `b22adfde20d705d015cba269177fb912df548c8a`.
**Exact nine-path candidate:** `openspec/changes/seller-navigation-scope/{design.md,proposal.md,specs/seller-navigation-scope/spec.md,tasks.md,verify-report.md}`; `viewpro-app/apps/app-new/src/{components/org-switcher.tsx,components/org-switcher.test.tsx,components/ui/dropdown-menu.tsx,lib/session.ts}`; 329 additions + 65 deletions = **394/400 changed lines**.

## Scope

### In scope

- A resolved context means context loading has completed; membership is a separate value.
- Role and permission requirements are conjunctive. Any protected policy requires membership; an empty role allowlist fails closed.
- PR1 filters Sidebar and KBar through one policy and tests realistic MANAGER, PRINCIPAL_MANAGER, AGENT, and loading states, including matching-role/missing-permission denial.
- PR2 renders only session memberships as Radix menu radio items with exact role labels, a visible active indicator, keyboard selection, and real storage/cookie persistence before refresh.
- PR2 consumes `workspaceAdministrationAccess` through the shared evaluator: AGENT and loading states fail closed; MANAGER/PRINCIPAL_MANAGER with `team.view` retain administration access.

### Non-goals

- #307 owns route and session hardening, including route redirects, proxy or route-tree work, and session lifecycle changes.
- #291 owns seeded CI coverage.
- No backend authorization, new roles or permissions, SessionProvider/tenant-selection redesign, routes, #307, or #291 work. The administration link remains a UX affordance; backend authorization is authoritative.

## Verification and rollback

| PR | Verification | Rollback |
|---|---|---|
| PR0 | Markdown structure review, clean-diff check, and confirmation that no application file changed | Revert the docs-only merge |
| PR1 | Focused policy and rendered Sidebar/KBar tests, app test suite, strict lint, app/root typecheck, production build, and clean diff | Revert PR1; PR0 remains valid |
| PR2 | Focused OrgSwitcher test, app test suite, strict lint, typecheck, and clean diff | Revert PR2; PR1 remains valid |

Each PR must contain only its stated work unit. PR1 stops at 400 total public changed lines; a diff over that limit is re-scoped before review.
