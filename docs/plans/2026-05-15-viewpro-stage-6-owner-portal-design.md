# ViewPro Stage 6 Owner Portal Backend Design

Stage 6 makes ViewPro's promise real for property owners: owners can log in and see their properties, tenant engagements, current status, and visible movement timeline without becoming tenant members. This is backend-first: it creates access rules and read-only portal APIs, while UI, invitations, documents, and WhatsApp tracking remain future work.

## Quick path

1. Add `PropertyAssetOwner` access records between existing `User` accounts and `PropertyAsset`.
2. Add owner portal read-only endpoints under `/api/owner/*` using `AuthGuard`, not `TenantMembershipGuard`.
3. Return sanitized property, engagement, agent, and movement data suitable for an owner-facing portal.

## Core decision

Owners are users, but they are not tenant members.

```txt
TenantMembership
  = internal real-estate agency access

PropertyAssetOwner
  = owner portal access to a physical property
```

This keeps tenant staff permissions separate from owner visibility and avoids turning owners into billable/internal users.

## Scope

| Area | Stage 6 decision |
|------|------------------|
| Owner access model | Included via `PropertyAssetOwner` |
| Owner read-only API | Included |
| Owner login | Uses existing auth login for existing user accounts |
| Owner registration/invitation | Out of scope |
| Tenant staff UI | Out of scope |
| Owner UI | Out of scope |
| Documents | Out of scope |
| WhatsApp tracking | Out of scope; expose safe contact target only if already available |
| Tenant internal data | Never exposed |

## Domain model

### `PropertyAssetOwner`

Represents an owner user's access to a physical property.

Minimum fields:

- `id`
- `propertyAssetId`
- `userId`
- `isPrimary`
- `accessStatus`: `INVITED` | `ACTIVE` | `REVOKED`
- `createdAt`
- `updatedAt`

Rules:

- A user can be linked to many property assets.
- A property can have many owners.
- Stage 6 owner endpoints only expose records with `ACTIVE` access.
- `INVITED` exists for future invitation flow but does not grant portal access yet.

## API behavior

| Endpoint | Purpose |
|----------|---------|
| `GET /api/owner/properties` | List properties the authenticated owner can access |
| `GET /api/owner/properties/:propertyAssetId` | Read one owner-visible property detail |
| `GET /api/owner/properties/:propertyAssetId/engagements` | List owner-visible engagements under the property |
| `GET /api/owner/engagements/:engagementId/timeline` | Read owner-visible movement timeline for one engagement |

All endpoints require:

```txt
AuthGuard
```

Owner endpoints must not require `x-tenant-id`, because the owner is not operating inside one tenant workspace.

## Response boundaries

### Owner may see

- Property basic data:
  - title
  - address
  - city/province
  - property type
- Engagement owner-facing data:
  - engagement id
  - tenant public name
  - operation type
  - status
  - published price/currency
  - assigned agents' safe contact fields
- Movements:
  - type
  - observation
  - next step
  - status transition fields
  - simple metrics
  - created date
  - creator safe display fields

### Owner must not see

- Tenant memberships
- Internal tenant user lists
- Refresh tokens/auth internals
- Other owners on the same property
- Other properties not linked to the owner
- Internal-only metrics beyond movement fields already chosen for owner visibility
- Whether a cross-tenant engagement exists unless it is attached to an owned property

## Access rules

- Every owner endpoint starts from `request.user.id`.
- Property access requires `PropertyAssetOwner(userId, propertyAssetId, ACTIVE)`.
- Engagement access requires the engagement's `propertyAssetId` to be owner-accessible.
- Timeline access requires the movement's engagement to belong to an owner-accessible property.
- Unknown, revoked, or unauthorized resources return `404` to avoid leaking existence.

## Error behavior

| Case | Expected response |
|------|-------------------|
| Not authenticated | `401 Authentication required` |
| Property not owned / revoked | `404 Owner property not found` |
| Engagement not under owned property | `404 Owner engagement not found` |
| Timeline for inaccessible engagement | `404 Owner engagement not found` |

## Testing checklist

- [ ] Owner lists only ACTIVE owned properties.
- [ ] Owner cannot see properties for another owner.
- [ ] Revoked owner access returns no property.
- [ ] Owner reads property detail with sanitized fields.
- [ ] Owner lists engagements for owned property.
- [ ] Owner cannot read engagement timeline for non-owned property.
- [ ] Owner reads movement timeline for owned engagement.
- [ ] Owner endpoints do not require `x-tenant-id`.
- [ ] Internal tenant-only data is not present in owner responses.

## Out-of-scope follow-ups

- Owner invitation emails.
- Owner registration/self-service onboarding.
- Owner portal frontend.
- Document visibility/upload/download.
- WhatsApp click tracking.
- Analytics event `owner_viewed_property`.

## Approval

Approved scope: backend-first owner portal access and read-only sanitized APIs using existing auth users, with owners separated from tenant memberships.
