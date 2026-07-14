# ViewPro app-new

`app-new` is the active Next.js surface for ViewPro. It started from a shadcn dashboard template, but it now uses ViewPro-owned authentication, tenant selection, BFF routes, and product flows.

## Current stack

| Area            | Technology                                                    |
| --------------- | ------------------------------------------------------------- |
| Framework       | Next.js 16 App Router + React 19                              |
| UI              | Tailwind CSS v4, Radix UI, shadcn-style primitives            |
| Data fetching   | TanStack Query                                                |
| Forms           | TanStack Form + Zod                                           |
| Routing state   | nuqs where URL state is needed                                |
| Auth/session    | ViewPro API auth via httpOnly cookies and `/auth/*` endpoints |
| Package manager | pnpm from the monorepo root                                   |
| Monitoring      | Sentry is optional and disabled locally by default            |

No third-party template auth integration is used by this app. Do not add template auth dependencies, template auth env vars, external organization providers, or external billing assumptions.

## Run locally

From `viewpro-app/`:

```bash
pnpm install
pnpm dev:app-new
```

Useful focused commands:

```bash
pnpm --filter next-shadcn-dashboard-starter dev
pnpm --filter next-shadcn-dashboard-starter test
pnpm --filter next-shadcn-dashboard-starter lint:strict
```

The app expects the API to be available through the configured BFF/API URL. See the API workspace docs and root scripts for database and API startup.

## Authentication model

The app uses ViewPro API session endpoints:

- `POST /auth/login`
- `POST /auth/register-tenant`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

`src/lib/session.ts` defines the session contract. `src/lib/session-context.tsx` owns client session state and selected tenant handling. Protected routes are guarded by `src/proxy.ts` and backend authorization remains the source of truth.

## Navigation and permissions

Navigation filtering is UX only. It reads the active tenant membership from `SessionProvider` and filters items in `src/hooks/use-nav.ts` using ViewPro membership roles and permissions.

Security checks must stay in the API/BFF/domain layer. Do not rely on sidebar visibility for authorization.

## Docker

Build from the monorepo root (`viewpro-app/`) so the workspace lockfile is available:

```bash
docker build -f apps/app-new/Dockerfile -t viewpro-app-new .
```

Run with the runtime configuration required by the BFF/API deployment. Sentry is optional:

```bash
docker run -d -p 3000:3000 \
  -e BFF_API_URL=https://api.example.com/api \
  -e NEXT_PUBLIC_APP_URL=https://app.example.com \
  -e NEXT_PUBLIC_SENTRY_DISABLED=true \
  --name viewpro-app-new \
  viewpro-app-new
```

## Documentation

- `docs/auth.md` — ViewPro auth/session model for app-new.
- `docs/nav-rbac.md` — navigation filtering and security boundaries.
- `docs/forms.md` — form system.
- `docs/themes.md` — theme system.

## Cleanup rule

This app must not reintroduce upstream template auth/billing assumptions. If a template doc, lockfile, Docker arg, or skill mentions retired template auth or retired package-manager instructions as the active project setup, update or remove it before continuing feature work.
