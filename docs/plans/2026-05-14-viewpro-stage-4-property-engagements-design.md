# ViewPro Stage 4 Property Assets + Engagements Design

Stage 4 creates the first real tenant-scoped business domain: physical properties and the real-estate engagements a tenant manages for them. The backend remains the authority: every tenant-scoped request uses `x-tenant-id`, validates membership, and applies role-derived permissions before reading or writing data.

## Quick path

1. Add Prisma models for property assets, engagements, and assigned agents.
2. Add backend-only NestJS modules, repositories, use cases, controllers, DTOs, and e2e tests.
3. Keep owner portal/users out of scope; store simple owner contact fields on `PropertyAsset` for now.

## Core decision

Separate the physical property from the tenant's commercial process.

```txt
PropertyAsset
  = the physical property

PropertyEngagement
  = one tenant's commercial management process for that property
```

This preserves ViewPro's privacy rule: a tenant may manage a property, but must never know if another tenant also manages the same physical asset.

## Scope

| Area | Stage 4 decision |
|------|------------------|
| UI | Out of scope |
| Owner portal | Out of scope |
| Owner users/invitations | Out of scope |
| Property owner data | Simple `ownerName` / `ownerEmail` fields on `PropertyAsset` |
| Movements/timeline | Out of scope; Stage 5 |
| Documents | Out of scope |
| Tenant context | Required through `x-tenant-id` |
| Demo endpoints | No production demo endpoints; real domain endpoints only |

## Domain model

### `PropertyAsset`

Represents the physical property. It is not tenant-owned by itself and does not contain commercial status.

Minimum fields:

- `id`
- `title`
- `addressLine`
- `city`
- `province`
- `propertyType`
- `ownerName`
- `ownerEmail`
- `createdByUserId`
- timestamps

### `PropertyEngagement`

Represents a tenant's commercial management process over a property.

Minimum fields:

- `id`
- `tenantId`
- `propertyAssetId`
- `operationType`: `SALE` | `RENT`
- `status`
- `publishedPriceCents`
- `currency`
- `createdByUserId`
- timestamps

### `PropertyAgent`

Represents an internal user assigned to an engagement.

Minimum fields:

- `id`
- `tenantId`
- `propertyEngagementId`
- `agentUserId`
- `assignedByUserId`
- `assignedAt`

## API behavior

| Endpoint | Purpose | Roles |
|----------|---------|-------|
| `POST /api/property-engagements` | Create property asset + tenant engagement | `PRINCIPAL_MANAGER`, `MANAGER` |
| `GET /api/property-engagements` | List tenant engagements with pagination/filtering | Manager roles see all; agents see assigned only |
| `GET /api/property-engagements/:id` | Read one tenant engagement detail | Manager roles see all; agents see assigned only |
| `POST /api/property-engagements/:id/agents` | Assign an agent to an engagement | `PRINCIPAL_MANAGER`, `MANAGER` |

All endpoints require:

```txt
AuthGuard → TenantMembershipGuard → PermissionGuard
```

All endpoints require `x-tenant-id`.

## Permissions

Reuse existing permissions from Stage 3.

| Permission | Stage 4 use |
|------------|-------------|
| `engagements.create` | Create engagement and assign agents |
| `engagements.view_all` | List/read every engagement inside the tenant |
| `engagements.view_assigned` | List/read only engagements assigned to current user |

No new permission strings are required for Stage 4 unless implementation exposes separate update/delete behavior, which is out of scope.

## Data access rules

- Every engagement query filters by `tenantContext.tenantId`.
- Agent reads require both `tenantId` and an assignment row in `PropertyAgent`.
- Assigning an agent validates that the assigned user has a membership in the same tenant.
- `PropertyAsset` can be shared across engagements internally, but tenant APIs only expose the current tenant's engagement.
- A tenant must not see other tenants' engagement count, statuses, agents, or existence for the same property asset.

## Error behavior

| Case | Expected response |
|------|-------------------|
| Missing `x-tenant-id` | `403 Tenant context required` from Stage 3 guard |
| No tenant membership | `403 Tenant access denied` from Stage 3 guard |
| Missing permission | `403 Insufficient permissions` |
| Agent reads unassigned engagement | `404` to avoid revealing existence |
| Engagement belongs to another tenant | `404` |
| Assigned user not in tenant | `400` or `404`; prefer `400 Agent is not a member of this tenant` for internal manager UX |

## Testing checklist

- [ ] Manager creates property + engagement.
- [ ] Created engagement is tied to `tenantContext.tenantId`.
- [ ] Tenant A cannot list or read Tenant B engagement.
- [ ] Manager can list all tenant engagements.
- [ ] Agent only lists assigned engagements.
- [ ] Agent cannot create engagements.
- [ ] Manager can assign a tenant member as agent.
- [ ] Manager cannot assign a user outside the tenant.
- [ ] Pagination and status filters work.

## Out-of-scope follow-ups

- Owner users and `property_asset_owners` move to Stage 6.
- Status history and movements move to Stage 5.
- Documents remain out of scope until the document slice.
- UI selection and screens come after backend endpoints are stable.

## Approval

Approved scope: backend-only Stage 4, simple owner contact fields, no owner-user relationship yet.
