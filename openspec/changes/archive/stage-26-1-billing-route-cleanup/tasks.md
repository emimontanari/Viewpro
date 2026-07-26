# Tasks — Stage 26.1 Billing Route Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120–220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single focused fix PR |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Tasks

- [x] RED — Add/confirm failing focused tests showing billing is exposed in dashboard nav/command actions and `/dashboard/billing` renders a pilot-visible placeholder.
- [x] GREEN — Remove `Facturación` / `/dashboard/billing` from `navGroups` in `viewpro-app/apps/app-new/src/config/nav-config.ts` and update nav tests.
- [x] GREEN — Remove hard-coded `/dashboard/billing` menu links from `app-sidebar.tsx` and `user-nav.tsx` without changing profile/workspace/sign-out behavior.
- [x] GREEN — Replace the billing placeholder page with a redirect to `/dashboard` and add a focused route test.
- [x] TRIANGULATE — Verify command palette actions generated from `navGroups` do not expose billing.
- [x] REFACTOR — Remove now-unused imports/copy and keep the diff limited to route cleanup.
- [x] VERIFY — Run focused app-new tests, grep for remaining pilot-visible `/dashboard/billing` links, LSP diagnostics, and `git diff --check`.

## Acceptance

- [x] Dashboard nav and command actions do not include `Facturación` or `/dashboard/billing`.
- [x] Sidebar/user dropdowns do not link to `/dashboard/billing`.
- [x] Direct `/dashboard/billing` visits redirect to `/dashboard` and do not render billing placeholder copy.
- [x] No billing, pricing, subscription, Stripe, seed, migration, or API scope is added.
