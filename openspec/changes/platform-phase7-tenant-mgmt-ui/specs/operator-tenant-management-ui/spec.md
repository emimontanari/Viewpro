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
