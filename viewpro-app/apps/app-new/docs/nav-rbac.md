# Navigation Filtering and Access Boundaries

Navigation filtering in app-new is a UX convenience. It is not an authorization layer.

## Source of truth

The active tenant membership comes from `SessionProvider` in `src/lib/session-context.tsx`.

`src/hooks/use-nav.ts` builds a `src/lib/navigation-access.ts` context from that membership:

```ts
{
  resolved: !isTenantLoading,
  membership: activeMembership
}
```

Then it filters `src/config/nav-config.ts` items.

## Supported nav access flags

| Flag | Meaning |
| --- | --- |
| `permissions` | Requires every named active-membership permission. |
| `roles` | Requires an exact active-membership role allowlist match. |

Example:

```ts
{
  title: 'Equipo',
  url: '/dashboard/users',
  icon: 'teams',
  access: { roles: ['MANAGER', 'PRINCIPAL_MANAGER'], permissions: ['team.view'] }
}
```

All declared access flags are conjunctive. Any protected policy requires resolved context
and membership; an empty `roles` allowlist explicitly denies access. This prevents retained
memberships from exposing protected links while tenant context is loading.

## Security rule

Do not rely on hidden navigation for security.

A user can still call URLs directly, so protected behavior must be enforced by:

- API guards and use cases;
- BFF route checks;
- tenant ownership/access checks;
- owner-surface access checks;
- global admin guards for `/admin` operations.

## Current role surfaces

| Surface                    | UX signal                              | Security source                   |
| -------------------------- | -------------------------------------- | --------------------------------- |
| Dashboard tenant workspace | active tenant membership               | API tenant guards and permissions |
| Owner portal               | authenticated owner session            | owner API access checks           |
| ViewPro Admin              | `globalRole === 'VIEWPRO_ADMIN'` in UI | backend `GlobalAdminGuard`        |

## Do not add

- Third-party template auth client hooks.
- Third-party organization assumptions.
- Billing/plan checks in navigation.
- Security decisions that only run in React components.
