# Stage 25.3 — Tenant Limits Model and API Design

## Canonical slice

```txt
Stage: 25
Slice: 25.3 — Tenant limits model and API
Objective: configure pilot limits for users/team, active property engagements, and documents/storage.
Evidence needed: schema/migration review, API tests, admin permission tests, default-limit behavior.
Do not touch: billing, paid plans, Stripe, Clerk Billing.
Done: tenant limits are persisted, readable, editable by ViewPro admin, and have safe defaults.
Next slice: 25.4 — Tenant limits enforcement.
```

## Decision

Add optional operational limit controls to `Tenant` without changing commercial positioning. Limits default to `null`, which means **unlimited**. This lets ViewPro Admin configure pilot controls or emergency caps tenant-by-tenant while keeping unlimited properties available by default.

## Model

Add nullable integer fields to `Tenant`:

- `maxUsers Int?` — active team/user capacity for the tenant.
- `maxActivePropertyEngagements Int?` — active property operation/publication capacity. This intentionally does not cap raw property assets or historical closed/cancelled operations.
- `maxDocumentsStorageMb Int?` — document storage capacity in megabytes.

Semantics:

- `null` = unlimited / no configured cap.
- `0` = zero available capacity, useful as an operational block.
- `> 0` = configured cap.
- negative values are invalid.

## API

Add admin-only endpoint:

```http
PATCH /api/admin/tenants/:tenantId/limits
```

Request:

```json
{
  "maxUsers": 10,
  "maxActivePropertyEngagements": null,
  "maxDocumentsStorageMb": 512
}
```

Rules:

- Protected by existing `AuthGuard` + `GlobalAdminGuard`.
- Accept only integer values greater than or equal to zero, or explicit `null`.
- Unknown tenant returns `404 Tenant not found`.
- Invalid input returns `400 Unsupported tenant limits` or DTO validation error.
- Same-value writes return `unchanged: true` and do not create audit events.
- Changed writes update tenant limits and create a sanitized `TENANT_LIMITS_UPDATED` analytics event.

## Read models

Extend admin tenant list responses with:

```ts
limits: {
  maxUsers: number | null
  maxActivePropertyEngagements: number | null
  maxDocumentsStorageMb: number | null
}
```

The response remains sanitized: no user emails, document storage keys, private document URLs, or raw metadata.

## Admin UI

Extend app-new `/admin` tenant management:

- show a compact limits summary in the tenant table;
- label active-property control as **Publicaciones activas** to avoid implying that product-level properties are commercially capped;
- show `Sin límite` for `null`;
- add `Editar límites` dialog with numeric inputs and “Sin límite” checkboxes/actions;
- refresh dashboard data after successful save;
- keep Spanish-facing messages consistent with Stage 25.2.

## Explicit non-goals

- No billing, paid plans, Stripe, or Clerk Billing.
- No enforcement yet. Stage 25.4 will block writes when a configured limit is exceeded.
- No tenant self-service settings.
- No admin access to private tenant document content.
