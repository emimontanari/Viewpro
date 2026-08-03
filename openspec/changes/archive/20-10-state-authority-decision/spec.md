# Spec: Stage 20.10 — State Change Request Workflow

> **What changed**: Sellers cannot directly mutate `PropertyEngagement.status`.
> They submit a `StatusChangeRequest`; a manager approves or rejects it.
> Approval is a single atomic transaction: status update + `STATUS_CHANGE`
> movement + request resolution + notifications.
> The existing `403 Forbidden "Insufficient permissions"` API guard is preserved.

---

## Slice contract (verbatim from proposal)

| Item | Value |
|------|-------|
| Slice | Stage 20.10 |
| Name | State Change Request Workflow |
| Status authority | Cuenta Madre (manager approval gates every official status transition) |
| D1 resolved | Yes — 2026-06-14 |
| Depends on | Stage 20.13 (Movement outcomes + `outcome` field on `Movement`) |
| Guard preserved | `POST /property-engagements/:id/movements` with `newStatus` by a non-manager → `403 "Insufficient permissions"` |
| Out of scope | Custom approval workflows per agency, bulk approval, escalation, scheduled approval, owner-facing notifications, removing the 403 |

---

## Functional requirements

### Area 1 — Request creation (seller proposes a state change)

| # | Requirement |
|---|-------------|
| FR-1 | A seller (`AGENT` membership) assigned to a `PropertyEngagement` may submit a `StatusChangeRequest` specifying the desired `targetStatus` (`PropertyEngagementStatus`) and an optional `requestNote` (max 1 000 chars). |
| FR-2 | The request body must include `currentStatusSnapshot` — the `PropertyEngagementStatus` value the seller sees at submission time. This is used by the stale-state guard (see FR-19). |
| FR-3 | Only sellers assigned to the engagement via `PropertyAgent` may create a request. A seller not in `PropertyAgent` for the engagement receives `403 Forbidden`. |
| FR-4 | `PRINCIPAL_MANAGER` and `MANAGER` members may NOT create requests on their own behalf via this endpoint. The create endpoint is seller-only. |
| FR-5 | One PENDING invariant: if a `StatusChangeRequest` with `status = PENDING` already exists for the engagement, any new create attempt returns `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_ALREADY_PENDING"`. |
| FR-6 | A request targeting a `targetStatus` equal to the current `PropertyEngagement.status` is rejected with `422 Unprocessable Entity` (`errorCode: "TARGET_STATUS_SAME_AS_CURRENT"`). |
| FR-7 | The new `StatusChangeRequest` record stores: `id`, `tenantId`, `propertyEngagementId`, `requestedByUserId`, `targetStatus`, `currentStatusSnapshot`, `requestNote?`, `status` (= `PENDING`), `resolvedByUserId?`, `resolvedAt?`, `resolutionComment?`, `createdAt`, `updatedAt`. |

### Area 2 — Listing

| # | Requirement |
|---|-------------|
| FR-8 | `GET /property-engagements/:id/status-change-requests` returns all requests for the engagement, ordered by `createdAt DESC`. Accessible by any manager of the tenant or by the seller assigned to the engagement. Response includes `status`, `requestedByUserId`, `targetStatus`, `requestNote`, `resolutionComment`, `resolvedAt`. |
| FR-9 | `GET /status-change-requests` (manager bandeja) returns all PENDING requests across all engagements in the tenant, ordered by `createdAt ASC` (oldest first). Accessible to `PRINCIPAL_MANAGER` and `MANAGER` only; returns `403` for sellers. |
| FR-10 | Both listing endpoints enforce tenant isolation: only requests belonging to the authenticated user's active tenant are returned. Cross-tenant IDs return 404 (engagement lookup) or an empty list (bandeja). |

### Area 3 — Approval

| # | Requirement |
|---|-------------|
| FR-11 | `PATCH /status-change-requests/:requestId/approve` is restricted to `PRINCIPAL_MANAGER` and `MANAGER` roles. Sellers receive `403`. |
| FR-12 | Approval executes one atomic database transaction containing exactly: (a) `PropertyEngagement.status` ← `request.targetStatus`; (b) insert `Movement` with `type = STATUS_CHANGE`, `newStatus = request.targetStatus`, `previousStatus = engagement.status`, `createdByUserId = request.requestedByUserId` (the original seller), `source = SYSTEM`, `observation = "State change approved"`; (c) `StatusChangeRequest.status` ← `RESOLVED`, `resolvedByUserId` ← approving manager, `resolvedAt` ← now; (d) insert `Notification` for seller (`STATUS_CHANGE_APPROVED`). |
| FR-13 | The `Movement` inserted during approval has `newStatus` set and `builtInOutcome` / `customOutcomeLabelId` both null (per 20.13 FR-30 mutual-exclusion rule). |
| FR-14 | Stale-state guard: before committing, the use case checks that `engagement.status === request.currentStatusSnapshot`. If not, the transaction is aborted; the request stays `PENDING`; the endpoint returns `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_SUPERSEDED"` and a message indicating the property status has changed since the request was created. |
| FR-15 | Concurrent approval (two managers racing): the implementation acquires a row-level lock on the `StatusChangeRequest` row (`SELECT ... FOR UPDATE`) before reading `engagement.status`. The second concurrent call finds the request already `RESOLVED` and returns `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_ALREADY_RESOLVED"`. |
| FR-16 | Self-approval is forbidden: if `resolvedByUserId === request.requestedByUserId` the endpoint returns `403 Forbidden` (`errorCode: "SELF_APPROVAL_FORBIDDEN"`), even if the requester holds a manager role at the time of approval. |
| FR-17 | An `AnalyticsEvent` with `eventName = PROPERTY_STATUS_CHANGED` is emitted after the transaction commits (best-effort, non-blocking — same pattern as `CreateMovementUseCase`). |

### Area 4 — Rejection

| # | Requirement |
|---|-------------|
| FR-18 | `PATCH /status-change-requests/:requestId/reject` is restricted to managers. Body must include `resolutionComment` (non-empty string, max 1 000 chars). Missing or blank comment returns `400 Bad Request` (`errorCode: "RESOLUTION_COMMENT_REQUIRED"`). |
| FR-19 | Rejection does NOT mutate `PropertyEngagement.status` and does NOT create a `Movement`. It only sets `StatusChangeRequest.status` ← `RESOLVED`, `resolvedByUserId`, `resolvedAt`, `resolutionComment`, then sends a `STATUS_CHANGE_REJECTED` notification to the seller. |
| FR-20 | Self-rejection is forbidden under the same rule as self-approval (FR-16). |

### Area 5 — Invariants

| # | Requirement |
|---|-------------|
| FR-21 | At most one `StatusChangeRequest` with `status = PENDING` may exist per `propertyEngagementId` at any time. Enforced by a partial unique index on `(propertyEngagementId)` WHERE `status = 'PENDING'`. |
| FR-22 | All operations (create, list, approve, reject) are scoped to `tenantId`. Requests from a different tenant return `404` via engagement lookup or request lookup — no information leakage. |
| FR-23 | `targetStatus` must be a valid `PropertyEngagementStatus` value. Invalid values return `400 Bad Request`. |
| FR-24 | Archived engagements (`archivedAt IS NOT NULL`) do not accept new status change requests (`422`, `errorCode: "ENGAGEMENT_ARCHIVED"`). |

### Area 6 — Authorization matrix

| Role | Create request | List (per-property) | List (bandeja) | Approve | Reject |
|------|---------------|---------------------|----------------|---------|--------|
| `AGENT` (assigned) | Yes | Yes (own requests visible) | No (403) | No (403) | No (403) |
| `AGENT` (not assigned) | No (403) | No (403) | No (403) | No (403) | No (403) |
| `MANAGER` | No (404 — not in PropertyAgent) | Yes | Yes | Yes (not self) | Yes (not self) |
| `PRINCIPAL_MANAGER` | No (404 — not in PropertyAgent) | Yes | Yes | Yes (not self) | Yes (not self) |
| Owner (portal user) | No (403 or 404) | No (403 or 404) | No (403 or 404) | No (403 or 404) | No (403 or 404) |

### Area 7 — Notifications

| # | Requirement |
|---|-------------|
| FR-25 | Three new `NotificationType` enum values added: `STATUS_CHANGE_REQUESTED`, `STATUS_CHANGE_APPROVED`, `STATUS_CHANGE_REJECTED`. All use `surface = INTERNAL`. |
| FR-26 | On request creation: one `STATUS_CHANGE_REQUESTED` notification is sent to every active manager (`PRINCIPAL_MANAGER`, `MANAGER`) in the tenant. `linkHref = /dashboard/status-change-requests`. |
| FR-27 | On approval: one `STATUS_CHANGE_APPROVED` notification is sent to the original requester (seller). `linkHref = /dashboard/product/:propertyEngagementId`. |
| FR-28 | On rejection: one `STATUS_CHANGE_REJECTED` notification is sent to the original requester. Body includes the `resolutionComment`. `linkHref = /dashboard/product/:propertyEngagementId`. |
| FR-29 | None of the three new notification types uses `surface = OWNER` or links to `/owner/...`. |
| FR-30 | Notification delivery failures (any new type) must not abort the transaction or the endpoint response. Log with `Logger.warn`. |
| FR-31 | `sanitizeInternalNotificationLink` must be updated to allow `/dashboard/status-change-requests` as a safe internal link (add to `SAFE_INTERNAL_LINKS` set). |

### Area 8 — Integration with the existing 403 guard

| # | Requirement |
|---|-------------|
| FR-32 | The check `if (input.newStatus && !tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE))` in `CreateMovementUseCase` is unchanged. Its error message `"Insufficient permissions"` is unchanged. |
| FR-33 | The approval transaction's internal movement insert bypasses `CreateMovementUseCase` entirely — it writes directly via `movementsRepository.create` so the guard is never triggered by the workflow path. |
| FR-34 | A test must assert that a seller calling `POST /property-engagements/:id/movements` with `type = STATUS_CHANGE` and `newStatus` still receives `403 "Insufficient permissions"` after 20.10 ships. |

### Area 9 — Backwards compatibility

| # | Requirement |
|---|-------------|
| FR-35 | Properties without any `StatusChangeRequest` continue to work normally. No existing endpoint changes its response shape. |
| FR-36 | The 20.13 `outcome` field on `Movement` is orthogonal; the approval transaction sets it to null. No migration of existing movements is needed. |

---

## Acceptance scenarios

**S-1 — Happy path: seller creates a request, manager receives notification**

- Given: seller `martin` is in `PropertyAgent` for engagement `E1` (status `CAPTURE`), no PENDING requests exist for `E1`
- When: `martin` calls `POST /property-engagements/E1/status-change-requests` with `{ targetStatus: "ACTIVE_PUBLICATION", currentStatusSnapshot: "CAPTURE", requestNote: "Listo para publicar" }`
- Then: response `201` with the new request (`status: "PENDING"`); one `STATUS_CHANGE_REQUESTED` `INTERNAL` notification created for each active manager in the tenant; `linkHref = /dashboard/status-change-requests`

**S-2 — Happy path: manager approves, full transaction**

- Given: PENDING request `R1` for engagement `E1` (`currentStatusSnapshot = CAPTURE`, `targetStatus = ACTIVE_PUBLICATION`), `E1.status = CAPTURE`, requester is `martin`, approver is `lucia` (MANAGER, not martin)
- When: `lucia` calls `PATCH /status-change-requests/R1/approve`
- Then: `E1.status = ACTIVE_PUBLICATION`; one `STATUS_CHANGE` movement inserted with `previousStatus = CAPTURE`, `newStatus = ACTIVE_PUBLICATION`, `createdByUserId = martin.id`, `source = SYSTEM`, `builtInOutcome = null`, `customOutcomeLabelId = null`; `R1.status = RESOLVED`, `resolvedByUserId = lucia.id`; one `STATUS_CHANGE_APPROVED` `INTERNAL` notification sent to `martin` with `linkHref = /dashboard/product/E1`; `PROPERTY_STATUS_CHANGED` analytics event emitted; response `200`

**S-3 — Manager rejects with comment**

- Given: PENDING request `R2`, requester `martin`, rejector `lucia`
- When: `lucia` calls `PATCH /status-change-requests/R2/reject` with `{ resolutionComment: "Documentación incompleta" }`
- Then: `E1.status` unchanged; no `Movement` inserted; `R2.status = RESOLVED`, `resolutionComment = "Documentación incompleta"`; one `STATUS_CHANGE_REJECTED` `INTERNAL` notification sent to `martin` with the comment in the body; response `200`

**S-4 — Manager rejects without comment → 400**

- Given: PENDING request `R3`
- When: manager calls `PATCH /status-change-requests/R3/reject` with `{}` (no `resolutionComment`) or `{ resolutionComment: "" }`
- Then: `400 Bad Request` with `errorCode: "RESOLUTION_COMMENT_REQUIRED"`; `R3.status` remains `PENDING`

**S-5 — Duplicate PENDING request → 409**

- Given: PENDING request `R4` exists for engagement `E1`
- When: seller calls `POST /property-engagements/E1/status-change-requests` with any `targetStatus`
- Then: `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_ALREADY_PENDING"`; no new record created

**S-6 — Self-approval forbidden**

- Given: seller `martin` submitted request `R5` and also holds a `MANAGER` membership in the same tenant
- When: `martin` calls `PATCH /status-change-requests/R5/approve`
- Then: `403 Forbidden` with `errorCode: "SELF_APPROVAL_FORBIDDEN"`; `E1.status` unchanged; `R5.status` remains `PENDING`

**S-7 — Stale-state guard: property moved between request and approval**

- Given: request `R6` was created with `currentStatusSnapshot = CAPTURE`; between creation and approval, another manager changed `E1.status` to `DOCUMENTATION_PENDING`
- When: manager calls `PATCH /status-change-requests/R6/approve`
- Then: `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_SUPERSEDED"` and a human-readable message explaining the property status has changed; `E1.status` unchanged; `R6.status` remains `PENDING`

**S-8 — Concurrent approval: row-level lock ensures only one succeeds**

- Given: PENDING request `R7`; managers `lucia` and `pedro` both call `PATCH /status-change-requests/R7/approve` simultaneously
- When: both calls reach the use case concurrently
- Then: exactly one succeeds with `200`; the other receives `409 Conflict` with `errorCode: "STATUS_CHANGE_REQUEST_ALREADY_RESOLVED"`; exactly one `STATUS_CHANGE` movement is inserted; `E1.status` is set exactly once

**S-9 — Cross-tenant isolation**

- Given: request `R8` belongs to tenant `T2`; authenticated user belongs to tenant `T1`
- When: user calls `PATCH /status-change-requests/R8/approve` or `GET /property-engagements/E8/status-change-requests`
- Then: `404 Not Found` (request or engagement lookup fails by tenant scope); no `T2` data is leaked

**S-10 — Owner cannot access requests**

- Given: owner user `owner1` has `PropertyAssetOwner` access to the asset underlying `E1`
- When: `owner1` (authenticated via owner portal session) calls any `/status-change-requests` or `/property-engagements/:id/status-change-requests` endpoint
- Then: `403 Forbidden` (owner session does not carry tenant membership context)

**S-11 — Seller not assigned to engagement**

- Given: seller `carlos` is a tenant member with `AGENT` role but is NOT in `PropertyAgent` for engagement `E1`
- When: `carlos` calls `POST /property-engagements/E1/status-change-requests`
- Then: `403 Forbidden` (engagement lookup with `canViewAssigned = true` and no assigned record returns not-found, surfaced as 403 to match existing guard pattern)

**S-12 — Approval transaction rollback on notification failure**

- Given: PENDING request `R9`, valid approval conditions, but the notification repository throws during `STATUS_CHANGE_APPROVED` insert
- When: manager calls `PATCH /status-change-requests/R9/approve`
- Then: the transaction is NOT rolled back — the status update, movement insert, and request resolution are committed; the notification failure is caught, logged via `Logger.warn`, and the `200` response is still returned (per FR-30 best-effort pattern)

**S-13 — Existing 403 guard unaffected**

- Given: seller `martin` is authenticated, `E1` exists
- When: `martin` calls `POST /property-engagements/E1/movements` with `{ type: "STATUS_CHANGE", newStatus: "ACTIVE_PUBLICATION", observation: "..." }`
- Then: `403 Forbidden` with message `"Insufficient permissions"` — identical to pre-20.10 behavior

**S-14 — Target status same as current → 422**

- Given: `E1.status = ACTIVE_PUBLICATION`
- When: seller calls `POST /property-engagements/E1/status-change-requests` with `{ targetStatus: "ACTIVE_PUBLICATION", currentStatusSnapshot: "ACTIVE_PUBLICATION" }`
- Then: `422 Unprocessable Entity` with `errorCode: "TARGET_STATUS_SAME_AS_CURRENT"`

---

## Non-functional notes (load-bearing only)

**Row-level locking**: The approve use case must acquire a `SELECT ... FOR UPDATE` lock on the `StatusChangeRequest` row at the start of the transaction (via raw Prisma `$queryRaw` or equivalent) before reading `PropertyEngagement.status`. This prevents the TOCTOU race described in S-8.

**Notification idempotency**: Each approval or rejection triggers exactly one notification per recipient. The use case is the write-once boundary; no deduplication table is needed for beta scale.

**Audit log**: Every state transition in the lifecycle of a request must emit a structured log line via `Logger.log` at INFO level: `[StatusChangeRequest] {requestId} → {newStatus} by {userId} at {timestamp}`. This enables tracing without a separate audit table.

**Observability hints**: One log line per lifecycle event — `CREATED`, `APPROVED`, `REJECTED`, `SUPERSEDED`. Include `requestId`, `engagementId`, `tenantId`, `actorUserId` in each line.

**Bandeja accessibility**: The manager bandeja (`/dashboard/status-change-requests`) must support full keyboard navigation (tab through rows, Enter/Space to open a request), maintain visible focus indicators, and expose each request row as a `<tr>` with an `aria-label` that includes the property title and target status. Screen-reader copy for the pending badge: `"Pending approval"`.

**Pending card accessibility** (seller view on `/dashboard/product/:id`): The inline pending state card must have `role="status"` or `aria-live="polite"` so screen readers announce it when it appears after submission.

---

## Open questions

None. D1 resolved 2026-06-14.

---

## FR-to-proposal trace

| FR | Proposal scope item |
|----|---------------------|
| FR-1 – FR-7 | "seller create request" + "currentStatusSnapshot guard" + "requestNote" |
| FR-8 – FR-10 | "list per-property" + "manager bandeja at /dashboard/status-change-requests" |
| FR-11 – FR-17 | "atomic approval transaction" + "stale-state guard" + "row-level lock" + "analytics event" |
| FR-18 – FR-20 | "rejection with required comment" + "no status change on reject" |
| FR-21 – FR-24 | "one-PENDING-per-property invariant" + "tenant isolation" + "archived engagement guard" |
| FR-25 – FR-31 | "3 new NotificationType values: STATUS_CHANGE_REQUESTED/APPROVED/REJECTED, all INTERNAL" + "sanitizeInternalNotificationLink update" |
| FR-32 – FR-34 | "existing 403 guard preserved" + "gate G1 evidence" |
| FR-35 – FR-36 | "backwards compatibility" + "20.13 outcome field coexistence" |
