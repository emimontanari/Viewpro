# CLAUDE.md

This is the active ViewPro Next.js app-new workspace, not a generic dashboard template.

## Key References

- **[AGENTS.md](./AGENTS.md)** — current project rules, stack, commands, auth/session model, BFF conventions.
- **[README.md](./README.md)** — app-new overview and local/Docker usage.
- **[docs/auth.md](./docs/auth.md)** — ViewPro API-backed auth and session model.
- **[docs/nav-rbac.md](./docs/nav-rbac.md)** — navigation filtering and security boundaries.
- **[docs/forms.md](./docs/forms.md)** — TanStack Form + Zod form system.
- **[docs/themes.md](./docs/themes.md)** — theme system.

## Critical Conventions

- Use **pnpm** from `viewpro-app/` only.
- Do not add third-party template auth, external organization providers, external billing assumptions, or retired template auth env vars.
- Auth/session is ViewPro API-backed through `src/lib/session.ts` and `src/lib/session-context.tsx`.
- Navigation filtering is UX only; backend/BFF/API guards are the security source of truth.
- React Query for data fetching; feature API shape is `api/types.ts` → `api/service.ts` → `api/queries.ts`.
- nuqs for URL search params where needed.
- Icons only from `@/components/icons`, never direct feature-level icon package imports unless an existing pattern requires it.
- Forms use `useAppForm` + `useFormFields<T>()` from `@/components/ui/tanstack-form`.
- Page headers use the existing layout/PageContainer patterns.
- Formatting: single quotes, JSX single quotes, no trailing comma, 2-space indent.
