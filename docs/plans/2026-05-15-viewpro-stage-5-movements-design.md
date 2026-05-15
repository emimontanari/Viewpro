# ViewPro Stage 5 Movements + Timeline Design

Stage 5 adds the first visible progress layer for ViewPro: agents and managers can record movements on a tenant-scoped property engagement. A movement may optionally update the engagement status in the same transaction, keeping the seller workflow fast while avoiding a separate status-history table for the MVP.

## Quick path

1. Add a `Movement` model tied to `PropertyEngagement`, `Tenant`, and the creating user.
2. Add backend endpoints to create movements and read a paginated timeline.
3. Preserve Stage 4 access rules: managers see all tenant engagements; agents only access assigned engagements.

## Core decision

Use one `movements` table for the MVP.

If a movement changes status, the movement stores both statuses:

```txt
Movement
  previousStatus: ACTIVE_PUBLICATION
  newStatus: OFFER_NEGOTIATION
```

The same transaction updates `PropertyEngagement.status`.

## Scope

| Area | Stage 5 decision |
|------|------------------|
| UI | Out of scope |
| Owner portal | Out of scope |
| Status history table | Out of scope for MVP |
| Documents | Out of scope |
| Buyer/lead modeling | Out of scope |
| Timeline API | Included |
| Optional status update | Included |
| Simple activity metrics | Included as optional movement fields |

## Domain model

### `Movement`

Represents a visible progress event in a property engagement timeline.

Minimum fields:

- `id`
- `tenantId`
- `propertyEngagementId`
- `createdByUserId`
- `type`
- `observation`
- `nextStep`
- `previousStatus`
- `newStatus`
- `source`: `MANUAL`
- `interestCount`
- `visitCount`
- `offerAmountCents`
- `interestLevel`
- `createdAt`

## Movement types

Use fixed MVP enum values:

| Type | Meaning |
|------|---------|
| `GENERAL_UPDATE` | Free-form progress update |
| `INQUIRY` | Buyer/renter inquiry activity |
| `VISIT_SCHEDULED` | Visit was scheduled |
| `VISIT_COMPLETED` | Visit happened |
| `OFFER_RECEIVED` | Offer was received |
| `DOCUMENTATION_UPDATE` | Documentation-related update |
| `STATUS_CHANGE` | Explicit status transition |

## API behavior

| Endpoint | Purpose | Roles |
|----------|---------|-------|
| `POST /api/property-engagements/:id/movements` | Create movement, optionally update engagement status | Managers for any tenant engagement; agents only assigned |
| `GET /api/property-engagements/:id/movements` | Read paginated timeline | Managers for any tenant engagement; agents only assigned |

All endpoints require:

```txt
AuthGuard → TenantMembershipGuard → PermissionGuard
```

All endpoints require `x-tenant-id`.

## Permissions

Reuse Stage 3 permissions.

| Permission | Stage 5 use |
|------------|-------------|
| `movements.create` | Create movement |
| `engagements.view_all` | Read/create movement for any tenant engagement |
| `engagements.view_assigned` | Read/create movement only for assigned engagements |

Because `PermissionGuard` uses AND semantics, view scope remains a use-case concern: managers get `canViewAll`, agents get assigned-only access.

## Transaction rule

When `newStatus` is provided:

1. Load the tenant-scoped engagement with current status.
2. Create the movement with `previousStatus` and `newStatus`.
3. Update `PropertyEngagement.status` to `newStatus`.
4. Commit both changes together.

If any step fails, neither the movement nor status update should persist.

## Access rules

- Every movement query filters by `tenantContext.tenantId`.
- Manager roles can access all engagements in the tenant.
- Agents can access only engagements where they are assigned in `PropertyAgent`.
- Cross-tenant or unassigned access returns `404` to avoid revealing existence.
- A user without movement creation permission gets `403`.

## Error behavior

| Case | Expected response |
|------|-------------------|
| Missing `x-tenant-id` | `403 Tenant context required` |
| Engagement belongs to another tenant | `404 Movement target not found` or `404 Property engagement not found` |
| Agent is not assigned | `404` |
| Missing `movements.create` | `403 Insufficient permissions` |
| Empty observation | `400` validation error |
| Invalid status/type | `400` validation error |

## Testing checklist

- [ ] Manager creates movement on any tenant engagement.
- [ ] Agent creates movement only on assigned engagement.
- [ ] Agent cannot create movement on unassigned engagement.
- [ ] Movement with `newStatus` updates engagement status transactionally.
- [ ] Timeline returns movements for the tenant engagement only.
- [ ] Tenant A cannot read Tenant B movements.
- [ ] Missing `x-tenant-id` fails.
- [ ] Validation rejects empty observation and invalid enums.

## Out-of-scope follow-ups

- Dedicated `property_status_history` table.
- Owner-facing portal timeline UI.
- Documents and document requests.
- Buyer/renter/lead entities.
- Notification or WhatsApp dispatch.

## Approval

Approved scope: backend-only movements/timeline, optional status transition in the same movement, no separate status-history table for MVP.
