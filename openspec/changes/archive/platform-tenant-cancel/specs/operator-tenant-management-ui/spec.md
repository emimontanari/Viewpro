# Delta for operator-tenant-management-ui

## Context

Today `TenantsTable`/`getTenantAction()` (`apps/viewpro-web/src/features/
tenants/components/tenants-table.tsx`) renders exactly one status action per
row (Activate / Suspend / Reactivate), and `TenantStatusAction` is typed
`'ACTIVE' | 'SUSPENDED'`. `CANCELLED` rows already fall through
`getTenantAction()`'s `if` chain to `null` (no action rendered) — that part
requires no change. This delta adds a distinct, destructive Cancel action
for every non-`CANCELLED` row, with its own confirmation step separate from
the existing (lighter) suspend confirmation, reusing the same invalidate-and-
refetch and error-handling patterns already in place.

---

## ADDED Requirements

### Requirement: Destructive Cancel Action

For a tenant row whose current status is `TRIAL`, `ACTIVE`, or `SUSPENDED`,
the table MUST render a "Cancelar" action distinct from the existing
activate/suspend/reactivate toggle. `TenantStatusAction` MUST widen to
include `'CANCELLED'` so the mutation can send it. Clicking "Cancelar" MUST
open a confirmation dialog that is visually and textually distinct from —
and communicates materially stronger consequences than — the existing
suspend confirmation (e.g. explicit "cannot be undone" / permanent framing).
No `PATCH` request MUST be sent before the operator confirms. Confirming
MUST call `PATCH /operators/tenants/:id/status` with `{ status: 'CANCELLED'
}`. On success, the tenant list query MUST be invalidated and refetched
(never patched optimistically, consistent with the existing status/limits
mutations), and the affected row MUST reflect the returned `status`.

#### Scenario: Cancel action renders alongside the existing action for ACTIVE, SUSPENDED, and TRIAL rows

- GIVEN a tenant row with status `ACTIVE` (or `SUSPENDED`, or `TRIAL`)
- WHEN the tenant-management table renders that row
- THEN a "Cancelar" action is visible in addition to the existing status-toggle action

#### Scenario: Cancel opens a distinct destructive confirmation before any request fires

- GIVEN an `ACTIVE` tenant row
- WHEN the operator clicks "Cancelar"
- THEN a confirmation dialog appears with copy visibly distinct from — and stronger than — the suspend confirmation
- AND no `PATCH` request is sent yet

#### Scenario: Confirming cancel PATCHes status=CANCELLED and refreshes the list

- GIVEN the destructive cancel confirmation is open for a tenant
- WHEN the operator confirms
- THEN `PATCH /operators/tenants/:id/status` is called with `{ status: 'CANCELLED' }`
- AND on success the tenant list query is invalidated and refetched
- AND the affected row shows `status: 'CANCELLED'`

#### Scenario: Dismissing the cancel confirmation sends no request

- GIVEN the destructive cancel confirmation is open
- WHEN the operator dismisses/cancels the dialog instead of confirming
- THEN no `PATCH` request is sent and the dialog closes with no change to the row

---

### Requirement: No Status Actions on a CANCELLED Row

A tenant row whose status is `CANCELLED` MUST render zero status actions —
neither the activate/suspend/reactivate toggle nor the new Cancel action.
This is largely pre-existing behavior (`getTenantAction()` already returns
`null` for `CANCELLED`); this requirement makes it explicit now that a
second, Cancel-specific action exists to also withhold.

#### Scenario: CANCELLED row shows no status actions at all

- GIVEN a tenant row with status `CANCELLED`
- WHEN the table renders that row
- THEN neither the status-toggle action nor the Cancel action is rendered

---

## MODIFIED Requirements

### Requirement: Error Handling

The existing 404 and generic-failure handling (`reportMutationError`,
`NOT_FOUND_MESSAGE`) MUST cover the new cancel mutation identically to the
existing status/limits mutations — no new error-handling code path.

#### Scenario: 404 on a cancel mutation shows the existing not-found message

- GIVEN a tenant id that no longer exists
- WHEN the destructive cancel confirmation is confirmed and the `PATCH` returns 404
- THEN the existing "tenant not found" message is shown
- AND the tenant list is not modified

#### Scenario: Generic cancel failure does not crash the page

- GIVEN a tenant's cancel `PATCH` fails with a 500
- WHEN the error is received
- THEN an error message is shown, the page remains interactive
- AND the list still shows its pre-failure data

---

## Invariants

- CANCEL MUST always be preceded by a destructive confirmation step that is
  visibly and textually distinct from — and stronger than — the SUSPEND
  confirmation.
- A `CANCELLED` row MUST render zero status actions.
- The cancel mutation follows the same invalidate-and-refetch pattern as
  every other status/limits mutation in this feature (no optimistic patch).
- The cancel action button, like every other in-flight-mutation trigger,
  MUST be disabled for the duration of the mutation (existing double-submit
  guard, unchanged).
