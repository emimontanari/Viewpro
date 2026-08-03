# Proposal — Stage 26.1 Billing Route Cleanup

## Intent

Close the Stage 26.1 route-cleanup regression blocking Stage 26.2: pilot users must not discover or reach unfinished billing UI.

## Problem

Validation found `/dashboard/billing` still exposed after Stage 26.1:

- `nav-config.ts` links `Facturación` to `/dashboard/billing`.
- `app-sidebar.tsx` and `user-nav.tsx` include hard-coded billing menu links.
- `dashboard/billing/page.tsx` renders a tenant-visible billing/plans placeholder.
- Existing tests did not block dashboard billing exposure.

## Scope

- Remove billing from pilot-visible dashboard navigation, account menus, and command actions.
- Make direct `/dashboard/billing` access redirect or otherwise avoid rendering billing placeholder UI.
- Add focused tests for nav, command actions, and direct route behavior.
- Keep the fix limited to route cleanup.

## Out of scope

Billing implementation, paid plans, pricing, invoices, Stripe, subscription state, billing schema/migrations, billing seeds, billing env vars, and broad navigation redesign.

## Success criteria

- No pilot-visible nav/menu/action links to `/dashboard/billing`.
- Direct `/dashboard/billing` does not render billing placeholder copy.
- Focused tests and grep validation pass.
- Stage 26.1 route cleanup can pass the billing portion of the Stage 26.2 gate.
