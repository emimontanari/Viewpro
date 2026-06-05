# Stage 25.1 — Admin Tenant Status Write API Design

Stage 25.1 closes the first ViewPro Admin P0 gap: ViewPro admins must be able to activate, suspend, and reactivate tenants without database edits. This slice is backend-only and creates an auditable write path for tenant status changes.

## Slice contract

```txt
Stage: 25
Slice: 25.1 — Admin tenant status write API + audit log
Objective: let ViewPro admins activate, suspend, and reactivate tenants without touching DB.
Evidence needed: API tests, global admin guard tests, tenant guard behavior, and audit record verification.
Do not touch: billing, limits, large admin UI, owner/team/document UI.
Done: admin can change tenant status; suspended tenant is blocked by existing guards; every status change is audited.
Next slice: 25.2 — Admin tenant management UI.
```

## Decision

Add a backend-only admin endpoint:

```txt
PATCH /api/admin/tenants/:tenantId/status
body: { "status": "ACTIVE" | "SUSPENDED" }
```

Only global ViewPro admins can call it. The endpoint does not use tenant membership context because this is a platform-level operation, not an agency-scoped action.

## Status policy

| Input | Meaning | Allowed in 25.1 |
| --- | --- | --- |
| `ACTIVE` | Activate a `TRIAL` tenant or reactivate a `SUSPENDED` tenant. | Yes |
| `SUSPENDED` | Block a tenant from tenant-scoped APIs while preserving data. | Yes |
| `TRIAL` | Trial plan/state management. | No — defer to limits/trial slices. |
| `CANCELLED` | Cancellation lifecycle. | No — needs separate policy. |

If the tenant already has the requested status, the endpoint returns `200` with `unchanged: true` and does not create a duplicate audit event.

## Authorization

The endpoint uses the existing admin guard stack:

1. `AuthGuard` authenticates the cookie access token.
2. `GlobalAdminGuard` reloads the user and requires:
   - `UserStatus.ACTIVE`;
   - `GlobalRole.VIEWPRO_ADMIN`.

It must not trust `x-tenant-id`, and a normal tenant manager/agent must receive `403 ViewPro admin access required`.

## Audit model

Use `analytics_events` as the audit/activity table and add one semantic event name:

```prisma
enum AnalyticsEventName {
  ...
  TENANT_STATUS_CHANGED
}
```

A real status change locks the tenant row, then writes an audit record in the same transaction as the tenant update. The row lock prevents duplicate audit records when two admins send the same transition concurrently:

```ts
{
  tenantId: targetTenantId,
  actorUserId: adminUserId,
  actorType: AnalyticsActorType.INTERNAL_USER,
  eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
  metadata: {
    previousStatus,
    newStatus
  }
}
```

Do not call `AnalyticsService.track` for this slice: it intentionally swallows failures, but this audit must be atomic.

## Tenant guard behavior

Do not duplicate tenant status checks in business controllers. The existing `TenantMembershipGuard` already rejects `SUSPENDED` and `CANCELLED` tenants with:

```txt
403 Tenant is not active
```

Stage 25.1 proves this by changing status through the admin API and then calling a tenant-scoped demo route as a normal tenant user.

## Response shape

Return a sanitized response with only operational fields:

```ts
type AdminTenantStatusUpdateResponse = {
  tenantId: string;
  previousStatus: TenantStatus;
  status: TenantStatus;
  unchanged: boolean;
  updatedAt: string;
};
```

No tenant contact data, user identity, email, metadata, or internal audit payload is returned.

## Out of scope

- Admin UI controls.
- Tenant limits model or enforcement.
- Billing, cancellation, or trial policy.
- Owner/team/document UI.
- Platform owner impersonation.
- Editing analytics read-model UI output beyond what tests require.

## Acceptance checklist

- [ ] Unauthenticated admin status writes return `401`.
- [ ] Non-ViewPro-admin users return `403`, even with `x-tenant-id`.
- [ ] ViewPro admin can set `TRIAL` or `SUSPENDED` tenant to `ACTIVE`.
- [ ] ViewPro admin can set tenant to `SUSPENDED`.
- [ ] Same-status write returns `200` with `unchanged: true` and no new audit event.
- [ ] Invalid target statuses (`TRIAL`, `CANCELLED`, arbitrary strings) return `400`.
- [ ] Unknown tenant returns `404`.
- [ ] Real status changes create exactly one `TENANT_STATUS_CHANGED` audit event.
- [ ] Suspended tenant is blocked by existing tenant guard; reactivated tenant is allowed again.
