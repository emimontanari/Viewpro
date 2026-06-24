# ADR 0001 — Naming Model: Brand vs. Plumbing

**Status**: Accepted
**Date**: 2026-06-24
**Change**: platform-foundation Phase 1

---

## Context

The ViewPro monorepo was built during the company founding period when the product and the company shared the same name. A future product split will rename the tenant-facing product to InmoView while the company name remains ViewPro.

This ADR formalises the classification of every identifier, string, and constant in the codebase into two stable categories — **Brand** and **Plumbing** — to control what changes in Phase 2 and what stays permanently.

---

## Decision

Two classes of identifier:

| Class | Definition | Phase 2 action |
|-------|-----------|---------------|
| **Brand** | User-visible or integrator-visible strings that identify the product by name. What end users and crawlers read. | Flip from "ViewPro" → "InmoView" by editing the brand-constant file(s) alone. |
| **Plumbing** | Internal runtime identifiers: cookie names, DB names, enum values, localStorage keys, package scopes, env var names, URL sentinels. | Stays permanently. Renaming requires coordinated session invalidation, DB migrations, or ecosystem contract changes with high risk and no user value. |

---

## Brand identifiers (Phase 2 flip targets)

All user-visible strings have been extracted into app-local brand constants:

- **FE**: `apps/app-new/src/lib/brand/brand.ts` — `BRAND` object covering page titles, auth copy, testimonials, legal prose, SEO, PWA fields, admin copy, invitation metadata, and dashboard empty-state.
- **API**: `apps/api/src/bootstrap/brand.constants.ts` — `API_BRAND` object covering Swagger document title and description.

To rename the product in Phase 2: edit the two brand constant files. No other source file needs to change to update user-visible strings.

---

## Plumbing identifiers (permanent — do NOT rename)

| Identifier | Location | Reason to keep |
|-----------|---------|---------------|
| `viewpro_access_token` cookie | `apps/api/src/auth/auth.constants.ts`, `apps/app-new/src/proxy.ts` | Renaming invalidates all active sessions across every browser. Requires coordinated deployment with migration window. |
| `viewpro_refresh_token` cookie | Same | Same risk as access token. |
| `VIEWPRO_ADMIN` Postgres enum value | `apps/api/prisma/schema.prisma`, `GlobalRole` enum | Renaming requires `ALTER TYPE` migration + all code touching the enum. Semantically correct: ViewPro is the company operating admin access. |
| `viewpro:selected-tenant:v1` localStorage key | `apps/app-new/src/lib/tenant-selection.ts` | Renaming strands every user's persisted tenant selection. Requires browser-side migration strategy. |
| `viewpro:selected-tenant-changed` event | Same | Internal CustomEvent key; no user-visible surface. |
| `viewpro_selected_tenant_id` cookie | Same | Same session-invalidation risk as auth cookies. |
| `viewpro:open-command-palette` event | `apps/app-new/src/components/kbar/events.ts` | Internal CustomEvent, operator-facing. |
| `viewpro-api` health service name | `apps/api/src/health/health.controller.ts` | Internal operational identifier. |
| `viewpro.local` URL sentinel | `apps/app-new/src/features/auth/components/sign-in-view.tsx`, `apps/app-new/src/features/notifications/components/notification-center.tsx`, `apps/api/src/notifications/notification-link.helper.ts` | Security sentinel for relative-URL validation logic. Changing it does not rename the product. |
| `@viewpro/*` package scope | All `package.json` files | Company namespace. ViewPro is the company; InmoView is the product. |
| DB name `viewpro`, container `viewpro-postgres` | Docker compose / env | Changing requires DB recreation or rename with downtime. |
| `VIEWPRO_TEST_RUN` env var | `apps/api/src/database/test-database-url.guard.ts` | Internal test harness identifier. |

---

## Borderline decision: `GlobalAdminGuard` error string

`apps/api/src/admin/guards/global-admin.guard.ts` throws `ForbiddenException('ViewPro admin access required')`. This is an HTTP 403 response body that technically reaches API clients.

**Decision**: leave untouched in Phase 1. Rationale: this string is operator-facing (only users with `VIEWPRO_ADMIN` role see it, via a programmatic API error response, not a rendered UI). It is semantically correct — ViewPro admin access is the company-level role. It can be revisited in a dedicated operator-UX pass or as part of Phase 2.

---

## Surfaces with no brand literal today (inventory completeness)

These surfaces were audited and found empty (no brand literal to extract):

- **PWA manifest**: no `manifest.ts`, `manifest.json`, or `webmanifest` exists in `apps/app-new`. `BRAND.pwa.*` keys are defined for Phase 2 readiness.
- **Transactional email**: `apps/app-new/src/features/notifications/` builds in-app notifications and URL links, not email bodies. No email template with brand copy exists.

These absences are documented here so the Phase 2 flip team knows where gaps exist.

---

## Consequences

1. Phase 2 rename is a one-file-per-app change to brand constants. Zero regression risk on auth, sessions, DB, or ecosystem contracts.
2. Plumbing identifiers are intentionally dual-nature (company-era prefix) and will outlast any product rename.
3. Any new user-visible string that references the product name MUST use `BRAND.*` (FE) or `API_BRAND.*` (API) and MUST NOT introduce raw literals.
4. The FE brand module (`brand.ts`) has no `use-client` / `use-server` directive — it is importable everywhere (Server Components, Client Components, static pages).
5. The two brand modules are intentionally NOT cross-imported. The API module is a separate deploy unit with its own tsconfig boundary.

---

## Alternatives rejected

| Alternative | Reason rejected |
|------------|----------------|
| Full rename now (all plumbing) | Requires ALTER TYPE migration, session invalidation for all users, DNS/cookie coordination. High risk, no user value in Phase 1. |
| Shared `@viewpro/brand` package | `@viewpro` is the company scope; creating a shared brand package under it conflates company namespace with product naming. Also couples FE and API deploy units unnecessarily. |
| Rename `@viewpro/*` scope to `@inmoview/*` | Company namespace. ViewPro is the company. Changing the scope requires updating every `package.json`, tsconfig path, and CI config simultaneously. |
