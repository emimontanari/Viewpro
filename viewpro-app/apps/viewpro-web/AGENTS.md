# AGENTS.md — ViewPro app-new

This app is the active Next.js UI for ViewPro. It is no longer a generic dashboard starter.

## Non-negotiables

- Use **pnpm** from `viewpro-app/` only.
- Do not add third-party template auth, external organization providers, external billing assumptions, or retired template auth env vars.
- Do not add billing/paid-plan behavior unless the canonical roadmap explicitly asks for it.
- Keep template/demo routes out of production navigation.
- Keep auth and authorization backed by the ViewPro API, not client-only checks.

## Current stack

| Area            | Current choice                                              |
| --------------- | ----------------------------------------------------------- |
| Framework       | Next.js 16 App Router + React 19                            |
| Package manager | pnpm workspace                                              |
| Styling/UI      | Tailwind CSS v4, Radix UI, shadcn-style components          |
| Data fetching   | TanStack Query                                              |
| Forms           | TanStack Form + Zod                                         |
| Session         | ViewPro API auth via httpOnly cookies                       |
| Tenant context  | `SessionProvider` + selected tenant cookie/header           |
| Monitoring      | Optional Sentry, disabled locally unless explicitly enabled |

## Auth/session model

Active auth lives in `src/lib/session.ts` and `src/lib/session-context.tsx`.

The app calls ViewPro API endpoints:

- `POST /auth/login`
- `POST /auth/register-tenant`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Session data contains:

- `user.globalRole` for global admin access;
- `memberships[]` for tenant role/permissions;
- selected tenant state managed by `src/lib/tenant-selection.ts`.

`src/proxy.ts` protects app routes at the Next.js edge/proxy layer. API guards remain authoritative.

## Navigation and permissions

`src/hooks/use-nav.ts` filters navigation by the active ViewPro tenant membership:

- `access.requireOrg` means an active tenant membership is required.
- `access.permission` checks `activeMembership.permissions`.
- `access.role` checks `activeMembership.role`.

This is UX only. Never treat hidden navigation as security.

## API/BFF pattern

Use local BFF routes under `src/app/api/**` when the browser must call the API through app-new.

- Use `src/lib/bff-api.ts` for server-side BFF proxy calls.
- Default behavior forwards selected tenant via `x-tenant-id`.
- Global admin BFF routes must pass `includeTenantHeader: false`.
- Feature modules should keep the pattern: `api/types.ts` → `api/service.ts` → `api/queries.ts`.

## Commands

From `viewpro-app/`:

```bash
pnpm dev:app-new
pnpm --filter next-shadcn-dashboard-starter dev
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
```

Targeted Vitest commands should pass file paths directly after the script name:

```bash
pnpm --filter next-shadcn-dashboard-starter test src/features/admin/api/service.test.ts
```

Do not use `test -- file` in this repo; it can run a broader suite than intended.

## Docker

Build app-new from the monorepo root so the pnpm workspace lockfile is available:

```bash
docker build -f apps/app-new/Dockerfile -t viewpro-app-new .
```

## Documentation

- `README.md` — current app-new overview and commands.
- `docs/auth.md` — ViewPro auth/session model.
- `docs/nav-rbac.md` — navigation filtering boundary.
- `docs/forms.md` — form patterns.
- `docs/themes.md` — theme patterns.

## Review checklist

Before returning work:

- [ ] No retired template auth references in active app-new source, Dockerfiles, package manifests, or active docs.
- [ ] No retired package-manager instructions or lockfiles are reintroduced.
- [ ] Commands use pnpm.
- [ ] Runtime auth remains ViewPro API-backed.
- [ ] Security-sensitive routes rely on backend/BFF authorization, not client visibility.
