# ViewPro app-new Auth

`app-new` uses ViewPro API authentication. It does not use any third-party template auth provider in the frontend runtime.

## Session source

The session contract lives in `src/lib/session.ts`.

| Operation       | API endpoint                 |
| --------------- | ---------------------------- |
| Login           | `POST /auth/login`           |
| Register tenant | `POST /auth/register-tenant` |
| Current session | `GET /auth/me`               |
| Refresh session | `POST /auth/refresh`         |
| Logout          | `POST /auth/logout`          |

The API owns cookies, refresh behavior, user status, global roles, tenant memberships, and permissions.

## Client session state

`src/lib/session-context.tsx` provides:

- `session`
- `memberships`
- `activeMembership`
- `activeTenantId`
- `selectedTenantId`
- `isAuthenticated`
- `isLoading`
- `isTenantLoading`
- `needsTenantSelection`
- `signOut()`

The provider reads the selected tenant from `src/lib/tenant-selection.ts` and keeps the selected tenant cookie/header aligned with the active membership.

## Route protection

`src/proxy.ts` protects app routes before rendering. It redirects unauthenticated users to `/auth/sign-in` with a safe redirect URL.

This is not a replacement for backend authorization. API and BFF routes must still enforce auth, role, tenant, and owner access rules.

## Global admin boundary

ViewPro Admin surfaces use `session.user.globalRole === 'VIEWPRO_ADMIN'` for client UX, and backend admin endpoints enforce `AuthGuard` + `GlobalAdminGuard`.

Admin BFF routes must disable tenant workspace header forwarding:

```ts
await bffFetch('/admin/summary', { includeTenantHeader: false });
```

## Do not add

- Third-party template auth packages or imports.
- Retired template auth env vars.
- External organization or billing assumptions.
- Client-only authorization as a security source of truth.
