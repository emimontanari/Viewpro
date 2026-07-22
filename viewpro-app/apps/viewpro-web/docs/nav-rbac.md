# Navigation Filtering and Access Boundaries

Navigation filtering in app-new is a UX convenience. It is not an authorization layer.

## Source of truth

The active tenant membership comes from `SessionProvider` in `src/lib/session-context.tsx`.

`src/hooks/use-nav.ts` builds an access context from that membership:

```ts
{
  hasOrg: Boolean(activeMembership),
  permissions: activeMembership?.permissions ?? [],
  role: activeMembership?.role
}
```

Then it filters `src/config/nav-config.ts` items.

## Supported nav access flags

| Flag         | Meaning                                                           |
| ------------ | ----------------------------------------------------------------- |
| `requireOrg` | Requires an active tenant membership.                             |
| `permission` | Requires the active membership to include that permission string. |
| `role`       | Requires the active membership role to match exactly.             |

Example:

```ts
{
  title: 'Equipo',
  url: '/dashboard/users',
  icon: 'teams',
  access: { requireOrg: true }
}
```

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
