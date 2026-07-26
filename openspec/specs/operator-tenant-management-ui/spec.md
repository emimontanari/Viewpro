<!-- Consolidated 2026-07-26 from implemented SDD changes. Do not edit history; add new requirements through a new change. -->
<!-- Source: openspec/changes/archive/platform-phase7-tenant-mgmt-ui (delta dated 2026-07-15) -->

# operator-tenant-management-ui Specification

## Purpose

The `operator-tenant-management-ui` capability gives an authenticated operator
a viewpro-web console page to view every InmoView tenant and control its
status and limits — consuming the existing `GET /operators/tenants` and the
two PATCH endpoints on viewpro-api directly (no BFF route, no InmoView call).

---

## Requirements

### Requirement: Paginated Tenant List

The page MUST render the tenant list from `GET /operators/tenants?offset&limit`,
displaying the returned `total` and `items` (name, slug, status, limits),
sorted name ASC as served by the API. The pager MUST NOT request a `limit`
value above the API's cap of 200.

#### Scenario: List renders from the paginated response

- GIVEN the API returns `{ total: 3, items: [...] }` for the first page
- WHEN the tenant-management page loads
- THEN all 3 tenants render in name-ASC order with their status and limits

#### Scenario: Pager navigates offset/limit pages

- GIVEN a tenant list with more items than the current page size
- WHEN the operator clicks "next page"
- THEN a new request is issued with an increased `offset`
- AND the list re-renders with the next page's items

#### Scenario: Requested limit never exceeds the API cap

- WHEN the operator changes the page size control
- THEN the `limit` query parameter sent never exceeds 200

#### Scenario: Empty registry shows an empty state

- GIVEN the API returns `{ total: 0, items: [] }`
- WHEN the page loads
- THEN an empty-state message renders instead of a table row

---

### Requirement: Status Toggle with Suspend Confirmation

Suspending a tenant MUST require an explicit confirmation step before
`PATCH /operators/tenants/:id/status` is called with `{ status: 'SUSPENDED' }`.
Activating a tenant MUST call the same endpoint with `{ status: 'ACTIVE' }`
directly, without a confirmation step. On success, the list MUST be
invalidated and refetched (not updated optimistically) to reflect the
returned `status`.

#### Scenario: Suspend requires confirmation before the PATCH fires

- GIVEN an ACTIVE tenant row
- WHEN the operator clicks "Suspend"
- THEN a confirmation dialog appears and no PATCH request is sent yet
- AND confirming the dialog sends `PATCH .../status` with `{ status: 'SUSPENDED' }`

#### Scenario: Activate PATCHes without confirmation

- GIVEN a SUSPENDED tenant row
- WHEN the operator clicks "Activate"
- THEN `PATCH .../status` is sent immediately with `{ status: 'ACTIVE' }`

#### Scenario: List reflects the new status after success

- WHEN a status PATCH resolves successfully
- THEN the tenant list query is invalidated and refetched
- AND the affected row shows the returned `status`

#### Scenario: unchanged:true is handled gracefully

- GIVEN a status PATCH response with `unchanged: true`
- WHEN the mutation resolves
- THEN no error is shown and the row still reflects the returned `status`

---

### Requirement: Limits Editing via Modal Dialog

Editing a tenant's limits MUST open a modal Dialog pre-filled with its
current `maxUsers`, `maxActivePropertyEngagements`, and
`maxDocumentsStorageMb`. Each field MUST accept an optional `number|null`
value; clearing a field MUST send `null` for that field in
`PATCH /operators/tenants/:id/limits`. On success, the list MUST be
invalidated and refetched to reflect the returned `limits`.

#### Scenario: Modal opens pre-filled with current limits

- WHEN the operator clicks "Edit limits" on a tenant row
- THEN a modal opens with the three fields pre-filled from that row's `limits`

#### Scenario: Saving edited limits PATCHes and refreshes the list

- GIVEN the operator changes one or more limit fields and submits
- WHEN the modal is confirmed
- THEN `PATCH .../limits` is sent with the edited `number|null` fields
- AND on success the list is refetched and reflects the returned `limits`

#### Scenario: Clearing a field sends null

- GIVEN the operator clears the `maxUsers` field
- WHEN the modal is submitted
- THEN the PATCH body includes `maxUsers: null`

---

### Requirement: Double-Submit Guard

The action control triggering any in-flight mutation (status PATCH or
limits PATCH) MUST be disabled for the duration of that mutation.

#### Scenario: Action button disabled while pending

- GIVEN a status or limits mutation is in flight
- WHEN the operator looks at the triggering button
- THEN the button is disabled and a second click issues no additional request

---

### Requirement: Error Handling

Failures from the list query or either mutation MUST be surfaced to the
operator without crashing the page. A 404 from a status/limits mutation
(unknown tenant) MUST show a clear, specific message. On any mutation
failure, the tenant list MUST remain unchanged (no partial or corrupted
state).

#### Scenario: 404 on mutation shows a clear message

- GIVEN a tenant id that no longer exists
- WHEN a status or limits PATCH returns 404
- THEN a clear "tenant not found" message is shown
- AND the list is not modified

#### Scenario: Generic mutation failure does not crash the page

- GIVEN a status or limits PATCH fails with a 500
- WHEN the error is received
- THEN an error message is shown and the page remains interactive
- AND the list still shows its pre-failure data

---

### Requirement: viewpro-api-Only Isolation

The feature MUST issue requests only to viewpro-api (no BFF route, no direct
call to InmoView). Every authenticated operator MUST have full access to all
list, status, and limits actions — the UI MUST NOT hide or disable any action
based on role.

#### Scenario: All requests target viewpro-api

- WHEN the list loads or any mutation fires
- THEN every request is made via `apiRequest` against viewpro-api
- AND no request is made to InmoView or any BFF route

#### Scenario: No role-based hiding of actions

- GIVEN any authenticated operator session (no role field)
- WHEN the tenant-management page renders
- THEN all list, status, and limits actions are visible and enabled

---

## Invariants

- The tenant list MUST be re-fetched (invalidated), never patched
  optimistically, after a successful status or limits mutation.
- `limit` sent to `GET /operators/tenants` MUST NOT exceed 200.
- The action button for an in-flight mutation MUST be disabled until that
  mutation settles.
- SUSPEND MUST always be preceded by an explicit confirmation step; ACTIVATE
  MUST NOT be.
- No request in this feature MUST target InmoView directly or a BFF route.

---

<!-- Source: openspec/changes/archive/platform-tenant-cancel (delta dated 2026-07-15) -->

## Delta — platform-tenant-cancel

> Requirements below were added by a later change on top of the sections above.
> Where a requirement title repeats, the version in this section is the newer one.

### Delta scope: operator-tenant-management-ui

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
