# Proposal: Seller Navigation Scope (#284)
## Decision

Deliver approved issue #284 as a three-step sequential chain to `develop`. PR0 is a planning baseline only; PR1 centralizes navigation policy and parity; PR2 applies that merged policy to the existing organization switcher.

```text
develop → 📍 PR0 docs/seller-navigation-scope-plan → develop
                                                    → PR1 fix/seller-navigation-policy → updated develop
                                                                                         → PR2 fix/seller-org-switcher-access → develop
```

## Chain contract

| PR | Start and end | Value | Forecast |
|---|---|---|---|
| 📍 PR0 | Start clean `develop`; end with versioned proposal, specification, design, and tasks | Establishes the review contract | Planning only; no code |
| PR1 | Start from `develop` after PR0; end with central context, policy, types, navigation configuration, `useNav`, readable Sidebar/KBar parity, and documentation | Removes unauthorized navigation affordances consistently | Target ≤260 changed lines |
| PR2 | Start from `develop` after PR1 merges; end by consuming PR1 policy to hide the administration action for AGENT | Completes the access boundary without redesigning switching | Target ≤180 changed lines; stop and return blocked if not honest |

PR2 is blocked until PR1 merges. Each implementation PR targets its stated `develop` revision, not another feature branch.

## Scope

### In scope

- A resolved context means context loading has completed; membership is a separate value.
- `requireOrg`, role, and permission requirements are conjunctive. An empty role allowlist fails closed.
- PR1 filters Sidebar and KBar through one policy and tests realistic MANAGER, PRINCIPAL_MANAGER, AGENT, and loading states, including matching-role/missing-permission denial.
- PR2 preserves existing agency switching, manager/principal administration access, loading fail-closed behavior, accessibility, and persistence while hiding only the AGENT administration action.

### Non-goals

- #307 owns route and session hardening, including route redirects, proxy or route-tree work, and session lifecycle changes.
- #291 owns seeded CI coverage.
- No backend authorization, new roles or permissions, OrgSwitcher/session/dropdown primitive redesign, Radix radio conversion, new role labels, or other unapproved user-visible redesign.

## Verification and rollback

| PR | Verification | Rollback |
|---|---|---|
| PR0 | Markdown structure review, clean-diff check, and confirmation that no application file changed | Revert the docs-only merge |
| PR1 | Focused policy and rendered Sidebar/KBar tests, app test suite, strict lint, typecheck, and clean diff | Revert PR1; PR0 remains valid |
| PR2 | Focused OrgSwitcher test, app test suite, strict lint, typecheck, and clean diff | Revert PR2; PR1 remains valid |

Each PR must contain only its stated work unit. A diff over its forecast is re-scoped before review; it is not approved by adding unrelated work.
