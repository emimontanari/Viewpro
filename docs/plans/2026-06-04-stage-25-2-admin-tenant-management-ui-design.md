# Stage 25.2 — Admin Tenant Management UI Design

Stage 25.2 exposes the Stage 25.1 tenant status write API in `app-new` with the same production UI system used across the current dashboard. This slice is intentionally narrow: ViewPro admins can see tenants and activate, suspend, or reactivate them without database work, while tenant-scoped app behavior remains unchanged.

## Slice contract

```txt
Stage: 25
Slice: 25.2 — Admin tenant management UI
Objective: expose minimal tenant operations in app-new for ViewPro admins.
Evidence needed: UI tests for tenant list, status badge, status action confirmation, loading/error states.
Do not touch: limits, billing, impersonation, private tenant content browsing.
Done: ViewPro admin can list tenants and activate/suspend/reactivate them from UI.
Next slice: 25.3 — Tenant limits model and API.
```

## Decision

Add a global admin route in `app-new`:

```txt
/admin
```

The route uses the existing app-new visual system: shadcn-style UI components, cards, badges, dialogs, buttons, toasts, spacing, and Spanish user-facing copy. It must not introduce a separate admin visual language.

## Authentication and product boundary

ViewPro Admin uses the same login as the tenant application. After login, access is determined by the authenticated session/user role, not by hard-coded email checks:

```txt
session.user.globalRole === 'VIEWPRO_ADMIN'
```

If a user is not a global admin, `/admin` shows the existing restricted-access pattern. Backend and BFF routes remain the real authorization boundary.

The admin surface can coexist in the same app during MVP because the boundaries are explicit:

- `/dashboard` remains tenant workspace UI.
- `/admin` is global ViewPro Admin UI.
- `/admin` does not depend on selected tenant state.
- `/admin` does not forward `x-tenant-id` to backend admin endpoints.
- `/admin` does not impersonate tenants or browse private tenant content.

A future `admin.viewpro.com` split can reuse the same auth/session model if the admin product grows, but it is not needed for this MVP slice.

## BFF architecture

Create local app-new route handlers that proxy the existing backend admin endpoints:

```txt
GET   /api/admin/summary
GET   /api/admin/tenants
GET   /api/admin/activity
PATCH /api/admin/tenants/:tenantId/status
```

Modify `bffFetch` to support an explicit opt-out for tenant context forwarding:

```ts
includeTenantHeader?: boolean // default true
```

All `/api/admin/*` handlers must call `bffFetch` with tenant header forwarding disabled. Auth cookies are still forwarded.

The local PATCH route must also enforce the UI/BFF allowlist before proxying:

```txt
ACTIVE | SUSPENDED
```

This prevents client mistakes from sending `TRIAL`, `CANCELLED`, or arbitrary values even though the backend remains the final policy boundary.

## UI behavior

The admin page loads dashboard data from local BFF routes and renders:

1. safe-boundary intro card;
2. global summary cards;
3. tenant list/table with status badges;
4. optional activity section if existing read-only admin activity is ported in the same cohesive component;
5. status action buttons where the current status is actionable.

Status actions:

| Tenant status | Button | Target status |
| --- | --- | --- |
| `TRIAL` | `Activar` | `ACTIVE` |
| `ACTIVE` | `Suspender` | `SUSPENDED` |
| `SUSPENDED` | `Reactivar` | `ACTIVE` |
| `CANCELLED` | none | — |

Every status mutation opens a confirmation dialog before the PATCH request. Success and failure use the existing toast system.

## Copy

Use Spanish UI copy consistent with the rest of app-new:

- `Cargando consola admin…`
- `Acceso restringido a ViewPro Admin`
- `Necesitás rol global VIEWPRO_ADMIN para abrir este comando operativo. Los roles tenant no conceden acceso admin.`
- `No pudimos cargar el admin`
- `Frontera segura`
- `Sin impersonación, billing ni acceso a documentos privados.`
- `Activar tenant`
- `Suspender tenant`
- `Reactivar tenant`
- `Actualizando estado…`
- `Tenant activado.`
- `Tenant suspendido.`
- `Tenant reactivado.`
- `El tenant ya tenía ese estado.`
- `No se pudo actualizar el estado del tenant.`

## Files

Create:

```txt
viewpro-app/apps/app-new/src/app/admin/page.tsx
viewpro-app/apps/app-new/src/app/api/admin/summary/route.ts
viewpro-app/apps/app-new/src/app/api/admin/tenants/route.ts
viewpro-app/apps/app-new/src/app/api/admin/activity/route.ts
viewpro-app/apps/app-new/src/app/api/admin/tenants/[tenantId]/status/route.ts
viewpro-app/apps/app-new/src/features/admin/api/types.ts
viewpro-app/apps/app-new/src/features/admin/api/service.ts
viewpro-app/apps/app-new/src/features/admin/api/queries.ts
viewpro-app/apps/app-new/src/features/admin/api/service.test.ts
viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.tsx
viewpro-app/apps/app-new/src/features/admin/components/admin-tenant-management-page.test.tsx
```

Modify:

```txt
viewpro-app/apps/app-new/src/lib/bff-api.ts
```

Do not touch login implementation unless a test proves that current session access is insufficient.

## Acceptance checklist

- [x] `/admin` shows loading while session/data loads.
- [x] non-`VIEWPRO_ADMIN` users see restricted access.
- [x] admin users can see tenant list and status badges.
- [x] `TRIAL` tenants can be activated from UI.
- [x] `ACTIVE` tenants can be suspended from UI.
- [x] `SUSPENDED` tenants can be reactivated from UI.
- [x] `CANCELLED` tenants have no status action.
- [x] status actions require confirmation before the service call.
- [x] mutation success updates or invalidates the tenant list.
- [x] mutation failure shows a Spanish error toast/state.
- [x] admin BFF routes do not forward `x-tenant-id`.
- [x] commands use `pnpm`, not `bun`.

## Evidence

- Service tests: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/api/service.test.ts` → `1 passed`, `6 passed`.
- UI tests: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/admin/components/admin-tenant-management-page.test.tsx` → `1 passed`, `9 passed`.
- TypeScript: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit` → PASS.
- Strict lint: `cd viewpro-app && pnpm --filter next-shadcn-dashboard-starter lint:strict` → PASS.
- Whitespace: `git diff --check` → PASS.
