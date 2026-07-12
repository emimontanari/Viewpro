# Design: Stage 20.10 — State Change Request Workflow

> **What this design covers**: how to add a manager-gated approval workflow
> for `PropertyEngagement.status` changes without weakening the existing
> `403 "Insufficient permissions"` guard on `POST /property-engagements/:id/movements`.
> The seller path becomes: submit a `StatusChangeRequest` → a manager approves or
> rejects → on approval an atomic transaction updates status, inserts a
> `STATUS_CHANGE` movement, resolves the request, and notifies the seller.

---

## Architecture decisions

### A1 — New module: `status-change-requests`

A new Nest module lives at `apps/api/src/status-change-requests/`, with the
same shape as `movement-outcome-labels` (20.13) and `property-engagements`:

```
status-change-requests/
  status-change-requests.controller.ts
  status-change-requests.module.ts
  status-change-requests.repository.ts                 // interface + DI token
  prisma-status-change-requests.repository.ts          // Prisma implementation
  dto/
    create-status-change-request.dto.ts
    decide-status-change-request.dto.ts
    list-status-change-requests.query.ts
  responses/status-change-request.response.ts
  use-cases/
    create-status-change-request.use-case.ts
    list-engagement-status-change-requests.use-case.ts
    list-tenant-pending-status-change-requests.use-case.ts
    approve-status-change-request.use-case.ts
    reject-status-change-request.use-case.ts
    build-status-change-movement-payload.ts            // pure, reuses 20.13 builder
```

**Why a new module, not extending `property-engagements`**:

| Concern | Decision |
|--------|----------|
| Cohesion | The workflow is its own aggregate (state machine, invariants, transitions). Folding it into `property-engagements` would mix two responsibilities. |
| Cyclic deps | The approval use case needs to mutate `PropertyEngagement.status` and `Movement`. Keeping the writer in a new module + injecting `PropertyEngagementsRepository` and `MovementsRepository` avoids putting more behavior into the already-large engagements module. |
| Testability | Smaller module = smaller graph for use-case unit tests (RED-first under strict TDD). |
| Mirroring 20.13 | 20.13 introduced `movement-outcome-labels` as a peer module. 20.10 follows that precedent. |

The new module imports `PropertyEngagementsModule`, `MovementsModule`,
`NotificationsModule`, `AnalyticsModule`, `MembershipsModule`,
`PermissionsModule`, `TenantContextModule`, `AuthModule`, `UsersModule`,
and `DatabaseModule` (for `PrismaService`).

### A2 — Movement insertion bypasses `CreateMovementUseCase`

The approval transaction inserts the `STATUS_CHANGE` movement directly via
`movementsRepository.create` reusing `buildMovementCreatePayload` (20.13's
pure builder). It does **not** call `CreateMovementUseCase.execute`. This is
deliberate (FR-33):

- `CreateMovementUseCase` enforces the `ENGAGEMENTS_CREATE` guard that
  produces the `403 "Insufficient permissions"` (FR-32). Calling it from the
  approval path would tie the workflow to a permission check that is
  meaningful only on the seller direct-write attack path.
- The approval path acts on behalf of the manager and the original seller;
  using the pure builder keeps the payload deterministic and unit-testable
  without spinning up the whole use-case dependency graph.

`buildMovementCreatePayload` is called with `dto.newStatus = request.targetStatus`,
`dto.outcome = undefined`, `engagementCurrentStatus = engagement.status`.
Per the 20.13 contract this returns `statusUpdate: { newStatus }` and
`movementData` with both outcome fields nulled — satisfying FR-13 (20.13
mutual exclusion).

### A3 — Reuse `NotificationProducerService` with three new methods

Three new methods are added to `NotificationProducerService`:

| Method | Surface | Recipients | Link |
|---|---|---|---|
| `notifyStatusChangeRequested` | `INTERNAL` | All active managers of the tenant | `/dashboard/status-change-requests` |
| `notifyStatusChangeApproved` | `INTERNAL` | The original requesting seller | `/dashboard/product/:propertyEngagementId` |
| `notifyStatusChangeRejected` | `INTERNAL` | The original requesting seller (body includes `resolutionComment`) | `/dashboard/product/:propertyEngagementId` |

Each method wraps its writes in `try/catch` with `Logger.warn` (same pattern
as `notifyPropertyStatusChanged`). This satisfies FR-30 (notification
failure does not roll the transaction back). Recipient resolution is done
via the existing `TenantMembership` table filtered by
`role IN (PRINCIPAL_MANAGER, MANAGER)` and `status = ACTIVE` for the
requested notification, and by `userId = request.requestedByUserId` for the
approved/rejected notifications.

### A4 — Repository boundary

`StatusChangeRequestsRepository` is the only place that holds Prisma
specifics. Its surface:

- `createPending(input)` — single insert that throws on the partial unique
  constraint (`P2002`), which the use case maps to
  `409 STATUS_CHANGE_REQUEST_ALREADY_PENDING`.
- `findByIdForTenant({ id, tenantId })`
- `findActivePendingByEngagement({ engagementId, tenantId })`
- `listByEngagementForTenant({ engagementId, tenantId })`
- `listPendingForTenant({ tenantId, take })`
- `resolveInTransaction(tx, input)` — internal, used by the approval/rejection
  use cases. Performs the `SELECT ... FOR UPDATE` + status mutation +
  `updatedAt` bump in one call so the transactional path is centralized.

This boundary matches `property-engagements.repository.ts` and
`movement-outcome-labels.repository.ts`.

### A5 — Manager bandeja lives at `GET /tenants/me/status-change-requests`

Spec text uses `GET /status-change-requests` in places and the BFF link
`/dashboard/status-change-requests` for UI. To stay aligned with the
existing API convention (every tenant-scoped collection in this codebase is
under `/tenants/me/...` or `/property-engagements/:id/...`), the API path
is `GET /tenants/me/status-change-requests?status=PENDING&take=...`. The
BFF route `/dashboard/api/tenants/me/status-change-requests` proxies it.
The link in notifications still points to `/dashboard/status-change-requests`
(the UI page).

This is purely a **path naming** decision; it does not change behavior or
FRs and the spec's authorization rules carry over verbatim.

---

## Database design

### New model: `StatusChangeRequest`

```prisma
model StatusChangeRequest {
  id                    String                     @id @default(uuid())
  tenantId              String
  propertyEngagementId  String
  requestedByUserId     String
  targetStatus          PropertyEngagementStatus
  currentStatusSnapshot PropertyEngagementStatus
  requestNote           String?                    // app-validated max 1000
  status                StatusChangeRequestStatus  @default(PENDING)
  resolvedByUserId      String?
  resolvedAt            DateTime?
  resolutionComment     String?                    // app-validated max 1000
  createdAt             DateTime                   @default(now())
  updatedAt             DateTime                   @updatedAt

  tenant             Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  propertyEngagement PropertyEngagement @relation(fields: [propertyEngagementId], references: [id], onDelete: Cascade)
  requestedByUser    User               @relation("StatusChangeRequestRequestedBy", fields: [requestedByUserId], references: [id])
  resolvedByUser     User?              @relation("StatusChangeRequestResolvedBy", fields: [resolvedByUserId], references: [id])

  // NOTE: a partial unique index on (propertyEngagementId) WHERE status='PENDING'
  // is added via raw SQL in the migration (see R2). Do NOT add @@unique here.
  @@index([tenantId, status, createdAt])
  @@index([propertyEngagementId, status])
  @@index([requestedByUserId])
  @@index([resolvedByUserId])
  @@map("status_change_requests")
}

enum StatusChangeRequestStatus {
  PENDING
  RESOLVED  // single terminal state per spec FR-12/FR-19 — covers both approved and rejected; readers tell them apart via resolutionComment + the linked STATUS_CHANGE Movement
}
```

**Notes on the enum**: the spec's resolved state is a single `RESOLVED`
value (FR-12/FR-19). Whether the request was approved or rejected is
derivable from `Movement` linkage (approved requests produce one
`STATUS_CHANGE` movement with `createdByUserId = requestedByUserId` and
`createdAt` ≈ `resolvedAt`) and from the presence of `resolutionComment`
without an associated movement (rejection). If the spec is intended to
distinguish them at the enum level, that is a `Spec deltas required` item
(see end of doc). For this design we follow the spec verbatim.

### Tenant backref

Add to `model Tenant`:
```
statusChangeRequests StatusChangeRequest[]
```

Add to `model User`:
```
statusChangeRequestsRequested StatusChangeRequest[] @relation("StatusChangeRequestRequestedBy")
statusChangeRequestsResolved  StatusChangeRequest[] @relation("StatusChangeRequestResolvedBy")
```

Add to `model PropertyEngagement`:
```
statusChangeRequests StatusChangeRequest[]
```

### Indexes (managed by Prisma)

| Index | Purpose |
|---|---|
| `(tenantId, status, createdAt)` | Manager bandeja query (filter by tenant + status, sort by createdAt) — R4 |
| `(propertyEngagementId, status)` | Per-property list + pending lookup (FR-5) |
| `(requestedByUserId)` | Foreign-key support |
| `(resolvedByUserId)` | Foreign-key support |

### Partial unique index (raw SQL — R2)

Appended to the migration, **after** the Prisma-generated blocks, with the
exact same comment structure as
`apps/api/prisma/migrations/20260615003659_add_movement_outcomes/migration.sql`:

```sql
-- PARTIAL UNIQUE INDEX — manually managed, do NOT drop
-- Purpose: enforce the FR-21 invariant "at most one PENDING
-- StatusChangeRequest per PropertyEngagement". Prisma cannot express
-- partial unique indexes natively; this index is invisible to
-- `prisma migrate dev`.
CREATE UNIQUE INDEX "status_change_requests_pending_engagement_key"
  ON "status_change_requests" ("propertyEngagementId")
  WHERE "status" = 'PENDING';
```

The constraint name `status_change_requests_pending_engagement_key` is
the literal string the create use case checks against when it catches
`Prisma.PrismaClientKnownRequestError` with `code = 'P2002'`. Mapping:

```ts
if (err.code === 'P2002' && err.meta?.constraint === 'status_change_requests_pending_engagement_key') {
  throw new ConflictException({ errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_PENDING', message: '...' })
}
```

---

## API design

### Endpoint catalog

| Method | Path | Auth | DTO / Query | Success | Errors |
|---|---|---|---|---|---|
| `POST` | `/property-engagements/:engagementId/status-change-requests` | `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard(MOVEMENTS_CREATE)` + assignment check in use case | `CreateStatusChangeRequestDto` | `201` + `StatusChangeRequestResponse` | `400` invalid enum / `403` not assigned or wrong role / `404` engagement not found / `409 STATUS_CHANGE_REQUEST_ALREADY_PENDING` / `422 TARGET_STATUS_SAME_AS_CURRENT` / `422 ENGAGEMENT_ARCHIVED` |
| `GET` | `/property-engagements/:engagementId/status-change-requests` | `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard(TENANT_VIEW)` + visibility check | none | `200` + `StatusChangeRequestResponse[]` (DESC by `createdAt`) | `403` / `404` |
| `GET` | `/tenants/me/status-change-requests?status=PENDING&take=` | `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard(ENGAGEMENTS_VIEW_ALL)` (manager-only — sellers fail here) | `ListStatusChangeRequestsQuery { status?: 'PENDING'; take?: 1..200 }` | `200` + `StatusChangeRequestResponse[]` (ASC by `createdAt`, default `take = 200`) | `403` |
| `PATCH` | `/status-change-requests/:requestId/approve` | `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard(ENGAGEMENTS_CREATE)` | none body | `200` + `StatusChangeRequestResponse` | `403 SELF_APPROVAL_FORBIDDEN` / `404` / `409 STATUS_CHANGE_REQUEST_ALREADY_RESOLVED` / `409 STATUS_CHANGE_REQUEST_SUPERSEDED` / `422 ENGAGEMENT_ARCHIVED` |
| `PATCH` | `/status-change-requests/:requestId/reject` | `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard(ENGAGEMENTS_CREATE)` | `RejectStatusChangeRequestDto { resolutionComment: string (1..1000) }` | `200` + `StatusChangeRequestResponse` | `400 RESOLUTION_COMMENT_REQUIRED` / `403 SELF_APPROVAL_FORBIDDEN` (self-rejection too) / `404` / `409 STATUS_CHANGE_REQUEST_ALREADY_RESOLVED` |

`PermissionGuard(ENGAGEMENTS_CREATE)` filters out `AGENT` cleanly because
`AGENT` does not hold `engagements.create`. This satisfies FR-9 (sellers
fail the manager-bandeja query with 403) and FR-11/FR-18 (sellers fail
approve/reject with 403). The "approver must not equal requester" rule
runs in the use case (R5).

### DTOs (class-validator)

```ts
// create-status-change-request.dto.ts
export class CreateStatusChangeRequestDto {
  @IsEnum(PropertyEngagementStatus)
  targetStatus!: PropertyEngagementStatus            // 400 if invalid (FR-23)

  @IsEnum(PropertyEngagementStatus)
  currentStatusSnapshot!: PropertyEngagementStatus   // 400 if invalid

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requestNote?: string
}

// reject-status-change-request.dto.ts
export class RejectStatusChangeRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'RESOLUTION_COMMENT_REQUIRED' })
  @MaxLength(1000)
  resolutionComment!: string                          // 400 if missing/blank (FR-18)
}

// list-status-change-requests.query.ts
export class ListStatusChangeRequestsQuery {
  @IsOptional()
  @IsIn(['PENDING'])
  status?: 'PENDING'                                  // bandeja is PENDING-only for MVP

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)                                           // R4 hard cap
  take?: number
}
```

### 400 vs 422 mapping (carrying 20.13's convention)

| Category | HTTP |
|---|---|
| Schema-level: wrong enum value, missing required field, length overflow, blank string | `400` |
| Business-rule violation that depends on current DB state | `422` (`TARGET_STATUS_SAME_AS_CURRENT`, `ENGAGEMENT_ARCHIVED`) |
| Concurrency / invariant collision | `409` (`STATUS_CHANGE_REQUEST_ALREADY_PENDING`, `STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`, `STATUS_CHANGE_REQUEST_SUPERSEDED`) |
| Authorization | `403` (insufficient role, not assigned, self-approval) |
| Not found / cross-tenant | `404` |

### Response shape

```ts
type StatusChangeRequestResponse = {
  id: string
  tenantId: string
  propertyEngagementId: string
  requestedByUserId: string
  targetStatus: PropertyEngagementStatus
  currentStatusSnapshot: PropertyEngagementStatus
  requestNote: string | null
  status: 'PENDING' | 'RESOLVED'
  resolvedByUserId: string | null
  resolvedAt: string | null     // ISO
  resolutionComment: string | null
  createdAt: string             // ISO
  updatedAt: string             // ISO
}
```

---

## Approval transaction design

The approve use case runs a single `prisma.$transaction(async (tx) => { ... })`
with the following ordered steps. Any thrown error rolls everything back.

```ts
async approve(tenant, currentUser, requestId): Promise<StatusChangeRequestResponse> {
  return this.prisma.$transaction(async (tx) => {
    // 1. LOCK: acquire row-level lock on the request row (R1 strategy).
    //    If the row does not exist or belongs to another tenant: 404.
    const locked = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status, "tenantId"
      FROM status_change_requests
      WHERE id = ${requestId} AND "tenantId" = ${tenant.tenantId}
      FOR UPDATE
    `
    if (locked.length === 0) throw new NotFoundException()

    // 2. RELOAD: read the request through Prisma now that the row is locked.
    const request = await tx.statusChangeRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException()

    // 3. SELF-APPROVAL GUARD (R5).
    if (request.requestedByUserId === currentUser.id) {
      throw new ForbiddenException({ errorCode: 'SELF_APPROVAL_FORBIDDEN', message: '...' })
    }

    // 4. ALREADY-RESOLVED GUARD (FR-15 race winner / loser).
    if (request.status !== 'PENDING') {
      throw new ConflictException({ errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED', message: '...' })
    }

    // 5. LOAD ENGAGEMENT (no lock needed — the request row lock serializes the
    //    workflow per engagement because of the PENDING invariant).
    const engagement = await tx.propertyEngagement.findFirst({
      where: { id: request.propertyEngagementId, tenantId: tenant.tenantId },
    })
    if (!engagement) throw new NotFoundException()
    if (engagement.archivedAt) {
      throw new UnprocessableEntityException({ errorCode: 'ENGAGEMENT_ARCHIVED', message: '...' })
    }

    // 6. STALE-STATE GUARD (FR-14).
    if (engagement.status !== request.currentStatusSnapshot) {
      throw new ConflictException({ errorCode: 'STATUS_CHANGE_REQUEST_SUPERSEDED', message: '...' })
    }

    // 7. MUTATE STATUS.
    await tx.propertyEngagement.update({
      where: { id: engagement.id },
      data: { status: request.targetStatus },
    })

    // 8. BUILD + INSERT MOVEMENT (FR-12, FR-13). Reuse 20.13 builder.
    const { movementData } = buildMovementCreatePayload({
      tenantId: tenant.tenantId,
      propertyEngagementId: engagement.id,
      createdByUserId: request.requestedByUserId,        // original seller, per FR-12
      engagementCurrentStatus: engagement.status,        // pre-update value
      dto: {
        type: MovementType.STATUS_CHANGE,
        observation: 'State change approved',
        newStatus: request.targetStatus,
      } as CreateMovementDto,
    })
    const movement = await tx.movement.create({
      data: { ...movementData, source: MovementSource.SYSTEM },
    })

    // 9. RESOLVE REQUEST.
    const resolved = await tx.statusChangeRequest.update({
      where: { id: request.id },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: currentUser.id,
        resolvedAt: new Date(),
      },
    })

    // 10. AUDIT LOG (non-failing).
    this.logger.log(`[StatusChangeRequest] ${request.id} → RESOLVED (approved) by ${currentUser.id}`)

    return { movement, resolved }
  })
  // ^ on commit, run post-transaction side effects (not inside the transaction):
  .then(async ({ resolved, movement }) => {
    // FR-17: best-effort analytics
    await this.trackAnalytics(...).catch(() => {})
    // FR-27: best-effort seller notification (FR-30 swallows failures)
    await this.notificationProducer.notifyStatusChangeApproved({ ... })
    return mapStatusChangeRequest(resolved)
  })
}
```

### Why analytics and seller notification run **after** commit

Spec scenario S-12 says notification failure during the approval transaction
must NOT roll back the status update, movement insert, or request
resolution. Putting these side effects after the `$transaction` boundary
guarantees the contract by construction: if the producer throws, the
already-committed state is unaffected. This mirrors `CreateMovementUseCase`,
which runs `trackAnalytics` and `notifyOwnersOfStatusChange` after the
movement insert and swallows their errors.

This means S-12's "transaction rollback on notification failure" outcome is
satisfied by **not putting** the notification inside the transaction —
which is what the existing 20.13 pattern already does and what the FR
language ("best-effort, non-blocking") requires.

### Why the row lock is on `StatusChangeRequest`, not `PropertyEngagement`

Two concurrent approvals on the same request both try to `SELECT ... FOR UPDATE`
the same `status_change_requests` row. Postgres serializes them. The second
caller wakes up, re-reads the row, sees `status = 'RESOLVED'`, and returns
`409`. There is no need to lock `PropertyEngagement` because no other
write path can mutate its `status` once 20.10 ships (the seller path is
blocked by the existing 403 guard; the workflow path is funneled through
this use case).

---

## Rejection design

```ts
async reject(tenant, currentUser, requestId, dto): Promise<StatusChangeRequestResponse> {
  return this.prisma.$transaction(async (tx) => {
    // 1. LOCK + LOAD (same as approve, steps 1–2).
    // 2. SELF-REJECTION GUARD (FR-20: same rule as FR-16).
    // 3. ALREADY-RESOLVED GUARD.
    // 4. MARK REJECTED.
    const resolved = await tx.statusChangeRequest.update({
      where: { id: request.id },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: currentUser.id,
        resolvedAt: new Date(),
        resolutionComment: dto.resolutionComment,
      },
    })
    this.logger.log(`[StatusChangeRequest] ${request.id} → RESOLVED (rejected) by ${currentUser.id}`)
    return resolved
  })
  .then(async (resolved) => {
    // FR-28: best-effort seller notification with comment in body.
    await this.notificationProducer.notifyStatusChangeRejected({
      tenantId: tenant.tenantId,
      recipientUserId: resolved.requestedByUserId,
      propertyEngagementId: resolved.propertyEngagementId,
      resolutionComment: resolved.resolutionComment!,
    })
    return mapStatusChangeRequest(resolved)
  })
}
```

The DTO's `@IsNotEmpty` + `@MaxLength(1000)` already covers FR-18 at the
HTTP layer (`400 RESOLUTION_COMMENT_REQUIRED`). The use case does not need
to re-validate; the DTO is the contract boundary.

---

## Notification producer wiring

### New enum values

Add to `enum NotificationType` in `schema.prisma`:

```prisma
STATUS_CHANGE_REQUESTED
STATUS_CHANGE_APPROVED
STATUS_CHANGE_REJECTED
```

Migration: a single `ALTER TYPE "NotificationType" ADD VALUE 'X'` line per
value, in a new migration.

### Producer call sites

| Producer | Called from | Recipients | Body |
|---|---|---|---|
| `notifyStatusChangeRequested` | `CreateStatusChangeRequestUseCase` after the request is committed | All active managers in the tenant (`role IN (PRINCIPAL_MANAGER, MANAGER)`, `status = ACTIVE`); excludes the requester even if they hold a manager membership | `"New status change request: <targetStatus>"` (title); body is the `requestNote` (or empty) |
| `notifyStatusChangeApproved` | After approve transaction commits | The seller (`requestedByUserId`) | `"Your status change was approved → <targetStatus>"` |
| `notifyStatusChangeRejected` | After reject transaction commits | The seller (`requestedByUserId`) | `<resolutionComment>` |

All three call `notificationsRepository.createInternal` with
`surface = INTERNAL` and `linkHref` set per FR-26/27/28. The recipient
manager list is fetched with a single query:

```ts
tx.tenantMembership.findMany({
  where: {
    tenantId,
    status: TenantMembershipStatus.ACTIVE,
    role: { in: [TenantRole.PRINCIPAL_MANAGER, TenantRole.MANAGER] },
    userId: { not: requestedByUserId }, // excludes requester
  },
  select: { userId: true },
})
```

### Recipient resolution at create-request time

`CreateStatusChangeRequestUseCase` calls this query **after** the request is
committed (outside the create transaction) so that a notification failure
cannot abort the request creation (FR-30). The 201 response is returned
even if zero managers are reachable.

---

## BFF design

### Routes (under `apps/app-new/src/app/api/`)

| Method + path | Proxies | Notes |
|---|---|---|
| `POST /api/products/[id]/status-change-requests` | `POST /property-engagements/:id/status-change-requests` | Seller path. Mirrors `/api/products/[id]/movements` pattern. |
| `GET /api/products/[id]/status-change-requests` | `GET /property-engagements/:id/status-change-requests` | Per-property list. |
| `GET /api/tenants/me/status-change-requests` | `GET /tenants/me/status-change-requests` | Manager bandeja. Forwards query string. |
| `PATCH /api/status-change-requests/[id]/approve` | `PATCH /status-change-requests/:id/approve` | Empty body. |
| `PATCH /api/status-change-requests/[id]/reject` | `PATCH /status-change-requests/:id/reject` | Forwards JSON body. |

Each route uses `bffFetch` + `proxyJsonResponse` exactly like the existing
movements/owners routes. No client-side authorization happens at the BFF
layer; the upstream API is the source of truth.

### Zod validators (BFF input only — defensive, not authoritative)

```ts
// apps/app-new/src/features/status-change-requests/api/types.ts
export const createStatusChangeRequestSchema = z.object({
  targetStatus: z.enum([...]),
  currentStatusSnapshot: z.enum([...]),
  requestNote: z.string().max(1000).optional(),
})
export const rejectStatusChangeRequestSchema = z.object({
  resolutionComment: z.string().min(1).max(1000),
})
```

Both schemas match the API DTOs (dual-layer validation pattern from 20.13).

### TanStack Query keys

```ts
// features/status-change-requests/api/queries.ts
export const statusChangeRequestKeys = {
  all: ['status-change-requests'] as const,
  pendingBandeja: () => [...statusChangeRequestKeys.all, 'pending-bandeja'] as const,
  byEngagement: (engagementId: string) =>
    [...statusChangeRequestKeys.all, 'by-engagement', engagementId] as const,
}
```

### Mutations + optimistic updates

| Mutation | Optimistic strategy |
|---|---|
| Create request | Optimistically prepend a `PENDING` placeholder to `byEngagement(engagementId)`. On error, roll back. On success, invalidate `byEngagement` and the engagement detail query (to refresh the pending chip). |
| Approve | Optimistically mark the request `RESOLVED` in `pendingBandeja()` and `byEngagement(...)`. On success invalidate engagement detail (status moved) and movements list (new STATUS_CHANGE row). |
| Reject | Optimistically mark `RESOLVED` in both cached lists. On success invalidate `byEngagement` only. |

---

## UI design

### Page: `/dashboard/status-change-requests` (manager bandeja)

Composition:

- Uses `PageContainer` + the existing layout header pattern.
- A single `<DataTable>` of `PendingRequestRow` records sorted by `createdAt ASC`.
- Each row exposes: property title (linked to `/dashboard/product/:id`),
  current status chip, `→`, target status chip, requester name, time ago,
  request note (truncated), and two buttons: **Approve** (primary) and
  **Reject** (destructive).
- Empty state: "No pending status change requests."
- Approve button opens an inline confirmation; Reject opens a small modal
  with a required `<Textarea>` for `resolutionComment` (1..1000 chars).

Accessibility minima (per spec NF block):

- Each row renders as `<tr>` with `aria-label={"`${propertyTitle}` to `${targetStatus}`, requested by `${requesterName}`"}`.
- Approve/Reject buttons are reachable by tab; modal traps focus and
  returns it to the row's Approve/Reject button on close.
- Screen-reader copy for the pending badge: `"Pending approval"`.
- Live region announces the optimistic resolution: `aria-live="polite"`.

### Property detail view (`/dashboard/product/:id`)

Three additions:

1. **Pending status chip** next to the existing `StatusBadge` when the
   engagement has an open request. Visible to both sellers and managers.
2. **Manager-only `PendingRequestCard`** (inline at the top of the detail
   view) when a PENDING request exists, showing the diff
   "current → target", requester, request note, and the two action
   buttons. Behaves identically to the bandeja row.
3. **Seller-only request modal** triggered by a new "Request status
   change" button (replaces the seller's previous direct status edit
   control). Modal fields: `targetStatus` dropdown (excluding current),
   `requestNote` textarea (optional, max 1000). On success, the modal
   closes and the inline "Pending status change" notice appears with
   `role="status"` + `aria-live="polite"`.

The seller's previous direct status edit control is **removed from the
UI**. The API 403 guard is preserved for defense-in-depth; the UI simply
no longer exposes a path that would trigger it.

### Toasts

| Trigger | Recipient | Copy |
|---|---|---|
| Successful create (seller) | seller | "Status change request submitted" |
| Approve (seller, via notification or next view) | seller | (notification surface, no extra toast on view) |
| Reject (seller, via notification or next view) | seller | (notification surface, no extra toast on view) |
| Approve action result (manager) | manager | "Approved · status updated to `<target>`" |
| Reject action result (manager) | manager | "Request rejected" |
| Race: stale-state 409 | manager | "The property status changed since this request was created. Please review." |
| Race: already-resolved 409 | manager | "This request was already resolved." |

---

## R1 strategy — `SELECT ... FOR UPDATE` via Prisma 6

**Chosen approach**: `tx.$queryRaw\`SELECT id, status, "tenantId" FROM status_change_requests WHERE id = ${id} AND "tenantId" = ${tenantId} FOR UPDATE\`` inside an interactive `prisma.$transaction(async (tx) => ...)`.

**Why this and not the alternatives**:

| Option | Verdict |
|---|---|
| (a) `tx.$queryRaw` `FOR UPDATE` | **Chosen**. Already in use at `apps/api/src/property-engagements/prisma-property-engagements.repository.ts:100` (`lockTenantRow`). Prisma 6 supports it via `$queryRaw` on the `TransactionClient`. Maps cleanly to existing test infrastructure. |
| (b) `isolationLevel: 'Serializable'` | Rejected. Adds wide-blast-radius serialization that fails on unrelated concurrent writes (e.g. a manager listing engagements). Disproportionate for a per-row guard. |
| (c) `pg_advisory_xact_lock(hashtext(id))` | Rejected. Adds an extra moving part. The 20-byte hash collision domain is fine but the team has zero advisory-lock idioms in the repo today, so this would be a precedent change for no incremental safety benefit. |

**Prisma 6 support note**: `$queryRaw` is available on the
`Prisma.TransactionClient` interface in Prisma 6 (the project's current
version per `package.json`). The existing `lockTenantRow` helper is the
proof; the type guard `typeof tx.$queryRaw !== 'function'` there is a
defensive check that exists only because some test doubles strip the
method.

**Testable boundary**: the `approve` use case takes a `PrismaService`
through its constructor; tests can replace `prisma.$transaction` with a
fake that yields a `TransactionClient` whose `$queryRaw` is stubbed.
Concurrency is asserted at the integration level by spinning two
parallel `approve(...)` calls in a `Promise.all` and checking that exactly
one returns `200` and the other returns `409 STATUS_CHANGE_REQUEST_ALREADY_RESOLVED`.

---

## R2 strategy — Partial unique index via raw SQL

**Chosen approach**: append a `CREATE UNIQUE INDEX ... WHERE status='PENDING'`
block to the migration that creates the `status_change_requests` table,
using the same header comment template as the 20.13 migration. The index
name is fixed and load-bearing for the `P2002` catch in the use case.

**Constraint name**: `status_change_requests_pending_engagement_key`.

**Use case mapping**:

```ts
try {
  return await this.repo.createPending(input)
} catch (err) {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    (err.meta?.constraint === 'status_change_requests_pending_engagement_key'
      || (Array.isArray(err.meta?.target) && err.meta.target.includes('propertyEngagementId')))
  ) {
    throw new ConflictException({
      errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_PENDING',
      message: 'A pending status change request already exists for this property.',
    })
  }
  throw err
}
```

The dual `meta.constraint` + `meta.target` check is defensive because
Prisma's `meta` shape for partial unique indexes is not stable across
versions; both names are safe to test against.

---

## R3 strategy — `sanitizeInternalNotificationLink` path allowlist

**Chosen approach (MVP)**: extend the `SAFE_INTERNAL_LINKS` set in
`apps/app-new/src/lib/notification-link.helper.ts` (and any backend
counterpart) to include `/dashboard/status-change-requests`. This is one
extra entry alongside `/dashboard/seguimiento` and `/dashboard/users`.

```ts
const SAFE_INTERNAL_LINKS = new Set([
  '/dashboard',
  '/dashboard/seguimiento',
  '/dashboard/users',
  '/dashboard/status-change-requests', // ← Stage 20.10
])
```

`/dashboard/product/:id` is already accepted via the per-engagement
template branch (lines 22–28 of `notification-link.helper.ts`), so the
APPROVED/REJECTED links work without further change.

**Why this and not the alternatives**:

| Option | Verdict |
|---|---|
| (a) Extend the `Set` | **Chosen.** One-line change, matches the existing idiom, low blast radius. |
| (b) Per-NotificationType safe-prefix parameter | Deferred. Useful if the producer grows toward many type-specific routes, but premature with three new types. |
| (c) `NotificationTypeRegistry` | Future refactor. Track as tech debt once the count of notification types crosses ~12. |

**Test**: add unit cases asserting that `sanitizeInternalNotificationLink({ linkHref: '/dashboard/status-change-requests' })` returns the same string, and that `/owner/...` inputs continue to return `null`.

---

## R4 strategy — Manager bandeja pagination

**Chosen approach**: keep the bandeja unpaginated for pilot scale.
Implement the following defenses:

1. The DB index `(tenantId, status, createdAt)` already declared above
   covers the dominant query plan.
2. The DTO enforces `take` ∈ `[1, 200]`. The use case applies `take: 200`
   as a default when the query omits `take`. This is a hard ceiling — no
   manager bandeja response can exceed 200 rows.
3. The UI does not paginate; if the response is truncated at 200 the
   bandeja shows a banner "Showing the 200 oldest pending requests" and
   the user can clear some via approve/reject to surface the rest.

**Future**: when pilot tenants approach the cap, switch the use case to
cursor pagination keyed on `createdAt + id`. Tracked as a follow-up
slice, not in this change.

---

## R5 strategy — Self-approval identity check

**Chosen approach**: the check `request.requestedByUserId === currentUser.id`
runs at step 3 of the approval transaction (immediately after reload, before
all business guards). The same check runs at the equivalent step of the
rejection transaction (FR-20). The check is **identity-based, not
role-based**, so a user who holds both `AGENT` and `MANAGER` memberships
is still blocked from approving their own request.

```ts
if (request.requestedByUserId === currentUser.id) {
  throw new ForbiddenException({
    errorCode: 'SELF_APPROVAL_FORBIDDEN',
    message: 'You cannot approve or reject your own status change request.',
  })
}
```

**Why it sits in the use case, not the guard**:

- `currentUser.id` and `request.requestedByUserId` are both known only
  after the request is loaded by id — the `PermissionGuard` runs before
  the use case body and does not have the request context.
- Putting it just after the lock + reload guarantees it cannot be
  bypassed by a different code path; the existing 403 guard on `POST .../movements`
  (FR-32) remains untouched and orthogonal.

**Testable boundary** (strict TDD):

- **Unit RED**: write `approve.use-case.spec.ts` with a fake repository
  that returns a request whose `requestedByUserId` equals the
  `currentUser.id` passed in; assert `ForbiddenException` with
  `errorCode: 'SELF_APPROVAL_FORBIDDEN'`. No transaction needed because
  the check fires before any write.
- **Integration**: seed a tenant where one user holds both
  `AGENT` and `MANAGER` `TenantMembership` rows; have that user create a
  request as the agent, then call `PATCH /status-change-requests/:id/approve`
  as the same user; assert `403 SELF_APPROVAL_FORBIDDEN`. This is the
  scenario S-6 from the spec.

**Companion test for the existing 403 (FR-34)**: the same integration
suite asserts that a seller calling `POST /property-engagements/:id/movements`
with `type: STATUS_CHANGE, newStatus: ACTIVE_PUBLICATION` still receives
`403 "Insufficient permissions"`. The check at line 66–68 of
`apps/api/src/movements/use-cases/create-movement.use-case.ts` is
unchanged.

---

## Non-goals

- Per-tenant custom approval workflows (e.g., multi-step approval, named
  approver groups).
- Bulk approve / bulk reject endpoints.
- Scheduled / time-based escalation of unresolved requests.
- Owner-facing notifications for status change requests (owners learn of
  status changes through the existing `PROPERTY_STATUS_CHANGED` owner
  notification once the approval fires).
- Removing the existing `403 "Insufficient permissions"` guard on
  `POST /property-engagements/:id/movements`. This guard MUST remain
  intact (FR-32 / FR-34).
- Allowing managers to call the create-request endpoint on their own
  behalf (FR-4).
- Approval analytics dashboards / reporting beyond the existing
  `PROPERTY_STATUS_CHANGED` analytics event (FR-17).
- Distinguishing `APPROVED` vs `REJECTED` at the enum level — single
  `RESOLVED` terminal state per spec; readers derive intent from
  resolution comment + linked movement.

---

## Rollout & rollback

### Migration order

1. Generate a Prisma migration `add_status_change_requests` containing:
   - `CREATE TYPE "StatusChangeRequestStatus" AS ENUM ('PENDING', 'RESOLVED');`
   - `CREATE TABLE "status_change_requests"` with all columns and FK constraints.
   - All four standard `@@index` blocks (CreateIndex statements).
   - `ALTER TYPE "NotificationType" ADD VALUE 'STATUS_CHANGE_REQUESTED';`
     plus the other two new values (Postgres requires one per `ALTER TYPE` and
     each in its own statement; Prisma generates them).
2. **Append** the partial unique index block at the bottom of the same
   migration file with the manually-managed header comment (mirroring
   the 20.13 migration). Do **not** add `@@unique` in `schema.prisma`.

### Rollout

- The migration is online-safe: it only adds a table, indexes, an enum,
  and three enum values. No existing rows are touched (FR-35, FR-36).
- API ships behind no flag; the seller UI removes the direct status edit
  control on the same release. Pre-existing automation that sets
  `newStatus` via `POST .../movements` already failed with `403` and
  continues to do so.

### Rollback

- Revert the API + UI deploy: the seller direct-edit control was never
  bound to the deprecated path because the 403 was already in place;
  reverting the UI simply restores the prior page bundle.
- Optional `down` migration: `DROP INDEX "status_change_requests_pending_engagement_key";`
  followed by `DROP TABLE "status_change_requests";` and
  `DROP TYPE "StatusChangeRequestStatus";`. Enum values added to
  `NotificationType` are kept (Postgres cannot drop enum values without
  recreating the type; orphan values are harmless).

---

## Risks (design-level — for tasks/apply to watch)

| Risk | Mitigation |
|---|---|
| **`P2002` `meta.constraint` shape varies across Prisma minor versions.** | Use case checks both `meta.constraint === 'status_change_requests_pending_engagement_key'` and `meta.target` array as a fallback. Add a unit test asserting both shapes raise `409 STATUS_CHANGE_REQUEST_ALREADY_PENDING`. |
| **Manager list at request-create time may be slow on a large tenant.** | Pilot scale is bounded; add the existing `(tenantId, status)` index on `TenantMembership` (already present). Track p99 in observability hints. |
| **Race between create-request and approve-of-another-pending.** | Impossible by construction: partial unique index makes at most one PENDING row exist; the create path fails with 409 before any approve can target a second row. |
| **Self-approval bypass via switching tenant context mid-flight.** | The `TenantMembershipGuard` resolves `currentUser` and `tenantId` per request; the identity check uses `currentUser.id`, which is the authenticated user, not a switchable token. Document this assumption in the use case JSDoc. |
| **`MovementSource.SYSTEM` may not exist in the enum yet.** | Verify in apply phase; if missing, add to schema in the same migration (no extra cost). |
| **Notification recipients exclude requester at create-request time but two managers may share a `userId` somehow (impossible by schema but worth asserting in the unit test).** | Add a unit test that the recipient deduplication step uses a `Set<string>` on `userId`. |
| **R3 future drift**: if more pages get linked from notifications, the `Set` will grow unboundedly. | Track as tech debt; revisit after 20.10 ships. |

---

## Spec deltas required

None. The spec is internally consistent and matches the design. Two
interpretive choices were made without spec change:

1. **Manager bandeja path** uses `/tenants/me/status-change-requests`
   (API) and `/dashboard/status-change-requests` (UI). The spec uses
   `GET /status-change-requests` in prose; the design tightens it to the
   project's `/tenants/me/...` convention without changing behavior.
2. **Single `RESOLVED` enum value** is used per FR-12 / FR-19 verbatim.
   If product later wants the bandeja to show "Rejected" badges in a
   `RESOLVED` history table, that is a UI-derived label (from
   `resolutionComment` presence + linked `Movement`), not a schema
   change.
