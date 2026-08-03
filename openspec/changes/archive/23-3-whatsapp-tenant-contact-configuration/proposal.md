# Proposal — Stage 23.3 Tenant WhatsApp Contact Configuration

## Status

Draft — proposed 2026-06-16.

## Origin

- `docs/plans/2026-06-04-stage-26-0-mvp-evidence-audit.md:42` — audit row flagging editable tenant/user WhatsApp phone config as PARTIAL, P0, Slices 23.3/23.4.
- `docs/plans/2026-06-04-final-mvp-execution-plan.md:304-309` — slice contract for Stage 23.3.
- `docs/plans/CURRENT_MVP_EXECUTION.md` — active execution handoff that points at 23.3 next after the 26.x bundle.

## Slice contract

```txt
Stage: 23
Slice: 23.3 — Minimal WhatsApp contact configuration (tenant phone editor)
Objective: remove DB/seed dependency for the tenant-level WhatsApp contact phone by providing a UI editor.
Evidence needed: API + UI tests for editing the tenant phone, plus seeded smoke proving the editor round-trip and the permission gate.
Do not touch: WhatsApp Business API, messaging automation, chat, templates, movement-level priority proof, admin tenant management UI, billing.
Done: a principal manager can configure the tenant contact phone from the dashboard with role-gated access and digit-count validation; owner-portal contact resolution keeps reading the value with no behavior change.
Next slice: 23.5 (movement-level priority test). User-phone editor punted to a follow-up slice (23-3b).
```

## Investigation summary (2026-06-16)

Audit row verbatim:

> WhatsApp config/contact/tracking | Mapping and click tracking tests exist; editable tenant/user phone config not proven. | PARTIAL | P0 — Slices 23.3/23.4

Current state already shipped via 23.1/23.2:

- Schema: `Tenant.whatsappPhone String?` (schema.prisma:218, added in 23.1) and `User.whatsappPhone String?` (schema.prisma:181).
- Read path: property-level owner contact resolves to `Tenant.whatsappPhone`; movement-level resolves to `Movement.createdByUser.whatsappPhone` (no tenant fallback).
- Validation helper: `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts` enforces `≥ 8 digits` (no E.164).
- Today the tenant phone is configurable only through `seed-demo.mjs` (`VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? '+5493510000000'`).

Six gaps that 23.3 must close:

1. No `PATCH /tenants/me/whatsapp-phone` API endpoint.
2. No corresponding BFF route under `app-new/src/app/api/tenants/me/`.
3. No tenant settings editor page (closest is the read-only `dashboard/workspaces/page.tsx`).
4. `TENANT_MANAGE_SETTINGS` is declared in `permissions.constants.ts:3` but is missing from the frontend `TENANT_PERMISSIONS` set in `src/lib/session.ts`, so the UI cannot role-gate the editor.
5. No `UpdateTenantWhatsappPhoneUseCase` (or equivalent) and the tenants repository only exposes `create` and `findBySlug`.
6. No shared Zod schema for the phone field on the frontend.

Scope decision (locked with user): ship the tenant-phone editor only. The user-level WhatsApp phone editor (the "sellers can have contact phone configured" half of the audit) is deferred to slice `23-3b` so this slice stays small, reviewable, and demo-provable in one PR.

## Scope

- New NestJS endpoint `PATCH /tenants/me/whatsapp-phone` on the existing `tenants` module, guarded by `AuthGuard + TenantMembershipGuard + PermissionGuard` and `@RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)`.
- `UpdateTenantWhatsappPhoneUseCase` (clean architecture use case) that validates the phone via the existing digit-count helper, persists through the tenants repository, and returns the updated tenant DTO.
- Extend the tenants repository with `updateWhatsappPhone(tenantId, value)` (or equivalent) — currently the repository only has `create` and `findBySlug`.
- BFF route `PATCH /api/tenants/me/whatsapp-phone` (Next.js Route Handler) that forwards to the API with the session cookie and returns shaped errors.
- New tenant settings page (route to be locked in design, e.g. `dashboard/settings/tenant-contact/page.tsx`) with a TanStack Form + Zod editor for the tenant WhatsApp phone, role-gated via the frontend permission helper.
- Add `TENANT_MANAGE_SETTINGS` to the frontend `TENANT_PERMISSIONS` set in `apps/app-new/src/lib/session.ts` so the editor can be conditionally rendered.
- Phone validation: digit-count `≥ 8` (mirrors 23.1 helper). Empty input clears the field (sets to `null`). No country-code / E.164 enforcement and no `libphonenumber` dependency.
- Tests:
  - API unit test for `UpdateTenantWhatsappPhoneUseCase` (happy path, invalid phone, clear-to-null).
  - API e2e test for the new endpoint covering permission denial (non-`TENANT_MANAGE_SETTINGS` user gets 403), validation rejection (`< 8 digits` gets 400), success path, and that `Tenant.whatsappPhone` is persisted.
  - Component test for the settings form (valid submit, invalid submit, role-gated render).
  - Seeded smoke extension (one new test) proving the editor flow round-trips a value as the demo principal manager.

## Out of scope

- `User.whatsappPhone` editor (self-service or admin-driven). Punted to slice `23-3b`.
- WhatsApp Business API, messaging, templates, automation, chat surfaces.
- Movement-level contact priority rule proof — that is slice 23.5.
- Admin tenant management UI changes (status, limits, plan).
- Notification, email, or audit-log entry when the phone changes.
- Granting `TENANT_MANAGE_SETTINGS` to the `MANAGER` role. Today only `PRINCIPAL_MANAGER` holds it via `ALL_MVP_PERMISSIONS`; keep that semantics as-is.
- E.164 / country-code enforcement or `libphonenumber` library.
- Per-engagement or per-property phone override.
- New migrations — `Tenant.whatsappPhone` already exists since 23.1.

## Preserve unchanged

- The existing 665 API tests, 419 app-new tests, and 27 seeded smoke tests must remain green.
- The Stage 26.2 deterministic seed contract — the seed continues to set `Tenant.whatsappPhone` to the demo value; this slice only adds a write path on top.
- Property-level and movement-level WhatsApp contact resolution (the READ side). Only the WRITE side is added.
- Existing `owner-whatsapp-contact.ts` digit-count helper is reused, not forked.

## Affected areas

API (NestJS):

- `viewpro-app/apps/api/src/tenants/tenants.module.ts` — wire new controller + use case.
- `viewpro-app/apps/api/src/tenants/tenants.controller.ts` (new or extend if present) — `PATCH /tenants/me/whatsapp-phone`.
- `viewpro-app/apps/api/src/tenants/application/update-tenant-whatsapp-phone.use-case.ts` (new).
- `viewpro-app/apps/api/src/tenants/infrastructure/*tenants.repository.ts` — add `updateWhatsappPhone` (location/file name to confirm in design).
- `viewpro-app/apps/api/src/permissions/role-permissions.ts` — expected NO change; verify in design.

App (Next.js):

- `viewpro-app/apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts` (new BFF route).
- `viewpro-app/apps/app-new/src/app/dashboard/settings/tenant-contact/page.tsx` (new — final path locked in design).
- `viewpro-app/apps/app-new/src/features/settings/` (new feature folder: form component, API client shape, Zod schema).
- `viewpro-app/apps/app-new/src/lib/session.ts` — add `TENANT_MANAGE_SETTINGS` to `TENANT_PERMISSIONS`.

Tests:

- `viewpro-app/apps/api/test/tenants.use-cases.spec.ts` (new or extended).
- `viewpro-app/apps/api/test/tenants.e2e-spec.ts` (new or extended).
- `viewpro-app/apps/app-new/src/features/settings/components/tenant-contact-form.test.tsx` (new).
- `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts` — extended by one test.

## Safety and integrity constraints

- Phone validation MUST reuse the existing 23.1 digit-count rule (≥ 8 digits). Empty/whitespace input clears the field to `null`.
- The endpoint MUST be gated by `PermissionGuard` with `TENANT_MANAGE_SETTINGS`. Tenant membership MUST be enforced via `TenantMembershipGuard`; the tenant being mutated is always the caller's session tenant.
- The endpoint MUST NOT accept an arbitrary `tenantId` from the body or path — it always operates on the session tenant (`/tenants/me/...`).
- No schema migration is introduced (column already exists since 23.1).
- No `--no-verify` on commits; lint/typecheck/tests must pass.
- BFF route MUST forward the session cookie and return shaped errors; it must not bypass the API guards.

## Risks

- **Settings page route location ambiguity.** No `/dashboard/settings` route exists today. Design must pick between a combined settings page and a dedicated `/dashboard/settings/tenant-contact` route. Recommendation leans toward a dedicated route to keep the slice minimal, but the call belongs to the design phase.
- **Frontend permission helper naming/structure.** `TENANT_PERMISSIONS` is missing `TENANT_MANAGE_SETTINGS`; design must confirm whether to extend that constant only, or introduce a dedicated helper (e.g. `canManageTenantSettings(session)`).
- **Testing the permission gate.** The demo seed currently only exposes a `PRINCIPAL_MANAGER` (`demo@viewpro.local`). To prove role-denial deterministically, design may need to either (a) add a `MANAGER` user to the deterministic seed contract, or (b) prove denial via an API-only e2e test with a fabricated non-principal session and skip the UI denial path. Either is acceptable; the choice belongs to the design phase.
- **Stage 26.2 seed coupling.** The seed sets `Tenant.whatsappPhone`. Smoke must not assume the seeded value is permanent — it should set, assert, and reset to keep idempotency.
- **Scope creep toward 23-3b.** The user-level editor and the movement-priority proof must remain explicitly out of scope to keep the PR reviewable.

## Rollback

Revert the new controller, use case, repository method, BFF route, settings page, feature folder, `session.ts` permission addition, and the new tests. No schema migration to roll back. Pre-existing baselines (665 API tests, 419 app-new tests, 27 seeded smoke, the 26.2 deterministic contract, owner-portal contact resolution) remain intact.

## Success criteria

- A principal manager can edit and save the tenant WhatsApp phone from the dashboard, with the new value persisted on `Tenant.whatsappPhone` and visible on subsequent reads.
- A user without `TENANT_MANAGE_SETTINGS` cannot reach or successfully call the endpoint (UI gated; API returns 403).
- Phone values shorter than 8 digits are rejected with a clear validation error on both API and UI.
- Empty input clears the value to `null` and the owner-portal contact resolution returns the no-config state.
- Seeded smoke proves the editor round-trip end-to-end on the demo dataset.
- All pre-existing test baselines remain green.

## Next phases

Proceed to `sdd-spec` and `sdd-design` (can run in parallel).
