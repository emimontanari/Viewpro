# Stage 22.6 Team Member Access Management Design

## Goal

Complete the remaining **Stage 22 — Equipo real** access-management slice: a principal manager can change active member roles and deactivate tenant access from `/dashboard/users` without database edits.

This stage closes the operational gap left after real team list, team invitations, acceptance, and pending invitation management.

## Current State

Stage 22 currently supports:

- listing real tenant members;
- creating team invitations;
- accepting invitations for new or existing users;
- listing, regenerating/copying, and revoking pending invitations.

What is still missing:

- changing an active member between `MANAGER` and `AGENT`;
- deactivating a member's access to a tenant;
- making tenant guards and assignment flows aware of deactivated memberships.

The current `TenantMembership` model has no tenant-scoped access state. It only stores `userId`, `tenantId`, `role`, and timestamps. `User.status` is global, so it cannot represent removing access to one tenant while preserving access to another tenant.

## Decision

Add explicit tenant-scoped membership status.

```prisma
enum TenantMembershipStatus {
  ACTIVE
  DEACTIVATED
}
```

Extend `TenantMembership` with:

```prisma
status              TenantMembershipStatus @default(ACTIVE)
deactivatedAt       DateTime?
deactivatedByUserId String?
```

Keep `@@unique([userId, tenantId])` so a user has one durable membership record per tenant. Deactivation changes state; it does not delete the row.

## Alternatives Considered

| Option | Decision | Why |
|---|---|---|
| Delete `TenantMembership` | Rejected | Loses audit/history and join date; makes existing property assignments harder to explain. |
| Set global `User.status = SUSPENDED` | Rejected | Not tenant-scoped; would block the user from every tenant. |
| Nullable `deactivatedAt` only | Rejected for now | Smaller, but state is implicit and less clear than existing status enums used elsewhere. |
| `TenantMembershipStatus.ACTIVE/DEACTIVATED` | Accepted | Explicit, tenant-scoped, auditable, and future-reactivation friendly. |

Terminology: use `DEACTIVATED`, not `REVOKED`. `REVOKED` is already used for invitations and owner links; membership deactivation is potentially reversible later.

## Backend Behavior

### Role update endpoint

Add:

```http
PATCH /api/team/members/:membershipId/role
```

Body:

```json
{ "role": "MANAGER" }
```

Allowed target roles:

- `MANAGER`
- `AGENT`

Not allowed:

- `PRINCIPAL_MANAGER`

Rules:

- requires auth, selected tenant, and `TEAM_MANAGE`;
- target membership must belong to the selected tenant;
- target membership must be active;
- cannot change a `PRINCIPAL_MANAGER` through this endpoint;
- cannot assign `PRINCIPAL_MANAGER`;
- response returns the updated safe team member shape.

### Deactivate endpoint

Add:

```http
POST /api/team/members/:membershipId/deactivate
```

Rules:

- requires auth, selected tenant, and `TEAM_MANAGE`;
- target membership must belong to the selected tenant;
- target membership must be active;
- cannot deactivate `PRINCIPAL_MANAGER`;
- cannot deactivate the current requester's own membership;
- updates `status = DEACTIVATED`, `deactivatedAt`, and `deactivatedByUserId`;
- response returns the updated safe team member shape.

### Access enforcement

Update the tenant membership boundary:

- `TenantMembershipGuard` must reject deactivated memberships.
- `/auth/me` should omit deactivated memberships so app-new automatically repairs stale selected-tenant cookies.
- team member list can include deactivated memberships for manager visibility.

This means a deactivated member:

- no longer receives that tenant in `/auth/me`;
- cannot use that tenant via `x-tenant-id`;
- remains visible to managers in `/dashboard/users` as historical/access state.

## Principal Manager Policy

`PRINCIPAL_MANAGER` remains bootstrap/owner-like tenant authority.

Stage 22.6 does **not** support:

- creating another `PRINCIPAL_MANAGER`;
- transferring principal ownership;
- demoting a `PRINCIPAL_MANAGER`;
- deactivating a `PRINCIPAL_MANAGER`.

Current permissions make `TEAM_MANAGE` principal-manager-only. This stage keeps that behavior. Expanding `TEAM_MANAGE` to regular managers is a separate product decision.

## Property Assignment Impact

Existing property agent assignment logic checks tenant membership but not deactivation state. Stage 22.6 should make assignment flows access-state aware:

- assignable agents list excludes deactivated memberships and globally suspended users;
- assigning a deactivated member is rejected;
- existing `PropertyAgent` rows are not deleted when a member is deactivated.

Historical assignments remain visible to managers. Deactivated users cannot use those assignments to access tenant routes because the tenant guard blocks them first.

Role eligibility is not tightened in this slice beyond active tenant access. If product wants “only `AGENT` can be assigned as seller”, that should be a separate behavior change.

## App-new Behavior

`/dashboard/users` should show active and deactivated memberships.

For each member row:

- email/name;
- role badge;
- user status;
- membership status badge;
- actions when allowed.

Actions:

- change role `MANAGER ↔ AGENT`;
- deactivate access.

UI rules:

- only render/enable actions if the active tenant session has `team.manage`;
- never show role/deactivate actions for `PRINCIPAL_MANAGER`;
- never show self-deactivation action;
- disabled/deactivated members show status and no mutating actions;
- backend remains the source of truth for all authorization.

BFF routes should mirror backend team semantics instead of extending old placeholder user mutations:

```http
PATCH /api/team/members/[membershipId]/role
POST  /api/team/members/[membershipId]/deactivate
```

The existing users feature service may call these BFF routes while keeping UI files under `features/users`.

## Response Shape

Extend team member responses with tenant-membership access metadata:

```ts
type TeamMemberResponse = {
  membershipId: string
  userId: string
  email: string
  firstName: string
  lastName: string | null
  userStatus: 'ACTIVE' | 'SUSPENDED'
  role: 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT'
  membershipStatus: 'ACTIVE' | 'DEACTIVATED'
  deactivatedAt: string | null
  deactivatedByUserId: string | null
  createdAt: string
  updatedAt: string
}
```

Do not expose password hashes, tokens, unrelated memberships, or cross-tenant data.

## Error Handling

Use existing Nest exception patterns:

- `403` for missing auth/tenant permission;
- `400` for invalid role or invalid state transition;
- `404` for target membership not found in selected tenant;
- `400` for self-deactivation and protected principal-manager operations.

App-new should show Spanish toast fallbacks:

- role update: `No se pudo actualizar el rol.`
- deactivate: `No se pudo desactivar el acceso.`

## Testing Strategy

Backend:

- repository tests for active/deactivated filtering and scoped updates;
- use-case tests for role update/deactivate rules;
- e2e tests for auth, tenant scoping, permission, principal-manager protection, self-deactivation protection, and `/auth/me` behavior;
- assignment tests proving deactivated users cannot be assigned and are not listed as assignable.

App-new:

- BFF route tests for role/deactivate proxying and errors;
- users service tests for new mutation methods;
- component tests for status badges and actions;
- team management section tests for successful role update, successful deactivation, and error toasts.

## Out of Scope

- Reactivating a deactivated membership.
- Transferring principal manager ownership.
- Deleting memberships.
- Automatically reassigning property assignments.
- Changing global `User.status`.
- Trial/user limits and billing/admin limit enforcement; defer to Stage 25 Admin ViewPro.
- Changing manager permission policy to grant `TEAM_MANAGE` to regular managers.

## Acceptance Criteria

- Principal manager can change an active non-principal member between `MANAGER` and `AGENT` from `/dashboard/users`.
- Principal manager can deactivate an active non-principal member from `/dashboard/users`.
- Deactivated membership cannot access selected-tenant protected APIs.
- `/auth/me` no longer returns deactivated memberships.
- Deactivated members remain visible in the team list with status for manager audit context.
- `PRINCIPAL_MANAGER` cannot be changed or deactivated through normal team management.
- Current requester cannot deactivate their own membership.
- Deactivated/suspended users are excluded from assignable property-agent flows.
- Tests cover backend, BFF, service, and UI behavior.
