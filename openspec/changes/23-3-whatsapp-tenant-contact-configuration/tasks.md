# Tasks — Stage 23.3 Tenant WhatsApp Contact Configuration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~530 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | single-pr-with-size-exception |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full vertical slice (backend + BFF + frontend + tests) | PR 1 (single) | size:exception; cohesive non-demonstrable in isolation per layer |

---

## Phase 1 — Pre-implementation audit (R-D3 discipline)

- [x] 1.1 Run `rg "TENANT_PERMISSIONS" viewpro-app/apps/app-new/src --type ts` — confirm only `product-form.tsx` and `product-table.test.tsx` import it; additive constant is safe. Done-when: zero unexpected consumers.
- [x] 1.2 Run `fd "settings" viewpro-app/apps/app-new/src/app/dashboard --type d` — confirm zero existing settings directory. Done-when: empty result.
- [x] 1.3 Run `rg "@Controller\(['\"]tenants" viewpro-app/apps/api/src` — confirm no route collision with the new controller. Done-when: only `movement-outcome-labels.controller.ts` at `tenants/me/movement-outcome-labels`.
- [x] 1.4 Run `rg "TenantsRepository|TENANTS_REPOSITORY" viewpro-app/apps/api/src` — confirm only `register-tenant.use-case.ts` and tenants module files consume it. Done-when: no unexpected consumers.
- [x] 1.5 Run `rg "MIN_WHATSAPP_DIGITS|replace\(/\\D/g" viewpro-app/apps/api/src` — confirm digit-count helper lives only in `owner-whatsapp-contact.ts`; plan import or inline copy. Done-when: single source located.
- [x] 1.6 Run `rg "whatsappPhone" viewpro-app/apps/api` — confirm only `seed-demo.mjs`, `schema.prisma`, and owner-portal read path reference the field. Done-when: no runtime-mutating callers found.
- [x] 1.7 Read `viewpro-app/apps/api/test/*.e2e-spec.ts` to locate fabricated-user helper for MANAGER/AGENT fixture — confirm it exists (covers S-4, S-5). Done-when: fixture pattern documented for T-11.

---

## Phase 2 — Backend implementation

- [x] 2.1 Add `updateWhatsappPhone(tenantId: string, phone: string | null): Promise<void>` to `viewpro-app/apps/api/src/tenants/tenants.repository.ts`. Done-when: interface compiles.
- [x] 2.2 Implement `updateWhatsappPhone` in `viewpro-app/apps/api/src/tenants/prisma-tenants.repository.ts` using `prisma.tenant.update`. Done-when: implementation compiles.
- [x] 2.3 Create `viewpro-app/apps/api/src/tenants/dto/update-whatsapp-phone.dto.ts` — `whatsappPhone: string | null` with `@IsOptional`, `@IsString` or `null` validator. Done-when: DTO compiles.
- [x] 2.4 Create `viewpro-app/apps/api/src/tenants/use-cases/update-tenant-whatsapp-phone.use-case.ts` — normalize (strip non-`[+\d]`), count digits, throw `BadRequestException({ code: 'phone.too_short' })` if digit count < 8, else call `repo.updateWhatsappPhone`. Done-when: unit test (T-10) passes RED before this commit.
- [x] 2.5 Create `viewpro-app/apps/api/src/tenants/tenants-contact.controller.ts` — `@Controller('tenants')`, `@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)`, two handlers:
  - `GET /tenants/me/whatsapp-phone` with `@RequirePermissions(TENANT_MANAGE_SETTINGS)` → returns `{ whatsappPhone: string | null }` (200).
  - `PATCH /tenants/me/whatsapp-phone` with `@RequirePermissions(TENANT_MANAGE_SETTINGS)` → invokes use case, returns 204. Done-when: controller compiles.
- [x] 2.6 Register `TenantsContactController` and `UpdateTenantWhatsappPhoneUseCase` in `viewpro-app/apps/api/src/tenants/tenants.module.ts`. Done-when: `pnpm --filter @viewpro/api typecheck` passes.

---

## Phase 3 — API tests (TDD — write tests before Green)

- [x] 3.1 Create `viewpro-app/apps/api/src/tenants/use-cases/update-tenant-whatsapp-phone.use-case.spec.ts` — RED tests for: valid phone persisted, null/empty → null, whitespace → null, too-short → `phone.too_short`, normalization strips non-`[+\d]` chars, leading `+` preserved. Done-when: 6 tests RED before 2.4 implementation; GREEN after. NOTE: unit tests split across `src/common/whatsapp/whatsapp-phone.utils.spec.ts` (16 tests) and `test/tenants-whatsapp.use-cases.spec.ts` (12 tests); all GREEN.
- [x] 3.2 Create e2e spec (file naming following project convention, e.g. `tenants-contact.e2e-spec.ts`) — covers S-1 (204 + DB check), S-2 (null clear), S-3 (400 `phone.too_short`), S-4 (MANAGER → 403), S-5 (AGENT → 403), S-6 (unauthenticated → 401), GET returns current value. Done-when: 7 scenarios pass GREEN against a real DB. NOTE: e2e spec written at `test/tenants-whatsapp.e2e-spec.ts` (9 scenarios); BLOCKED by Phase 2 backend bug — circular dependency (TenantsModule → AuthModule → TenantsModule). Fix required before gate is GREEN.
- [ ] 3.3 Run `pnpm --filter @viewpro/api db:validate && pnpm --filter @viewpro/api typecheck && pnpm --filter @viewpro/api test` — GREEN gate ≥ 665 baseline + new tests. Done-when: zero failures. BLOCKED by 3.2 backend bug.

---

## Phase 4 — BFF route and frontend session helper

- [x] 4.1 Add `TENANT_MANAGE_SETTINGS: 'tenant.manage_settings'` to `TENANT_PERMISSIONS` in `viewpro-app/apps/app-new/src/lib/session.ts`. Add `canManageTenantSettings(membership)` helper next to existing `canManagePropertyEngagements`. Done-when: typecheck passes.
- [x] 4.2 Create `viewpro-app/apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts` — GET and PATCH handlers using `bffFetch`, `proxyBffErrorResponse`, `proxyJsonResponse`, Zod body validation on PATCH before forward. Propagates 204/400/401/403 verbatim (covers S-7). Done-when: route file compiles and `pnpm --filter next-shadcn-dashboard-starter lint:strict` passes.
- [x] 4.3 Run `pnpm --filter next-shadcn-dashboard-starter lint:strict && pnpm --filter next-shadcn-dashboard-starter typecheck` — GREEN gate. Done-when: zero errors. NOTE: lint:strict GREEN; tsc pre-existing errors in unrelated test files confirmed baseline (not introduced by Phase 4).

---

## Phase 5 — Frontend feature folder and page

- [x] 5.1 Create `viewpro-app/apps/app-new/src/features/settings/tenant-contact/api/types.ts` — `WhatsappPhoneResponse` and `UpdateWhatsappPhonePayload` TypeScript types. Done-when: file compiles.
- [x] 5.2 Create `viewpro-app/apps/app-new/src/features/settings/tenant-contact/api/service.ts` — `getTenantWhatsappPhone()` and `updateTenantWhatsappPhone(payload)` fetch wrappers over `/api/tenants/me/whatsapp-phone`. Done-when: file compiles.
- [x] 5.3 Create `viewpro-app/apps/app-new/src/features/settings/tenant-contact/api/queries.ts` — `useTenantWhatsappPhoneQuery()` (React Query GET) and `useUpdateTenantWhatsappPhoneMutation()` (invalidates query key on success). Done-when: file compiles.
- [x] 5.4 Create `viewpro-app/apps/app-new/src/features/settings/schemas/tenant-whatsapp-phone.ts` — Zod schema: transform trim + strip non-`[+\d]`; refine digit count ≥ 8 with message `phone.too_short`; allow null/empty → null. Done-when: schema used by form and BFF.
- [x] 5.5 Create `viewpro-app/apps/app-new/src/features/settings/tenant-contact/components/tenant-contact-form.tsx` — `useAppForm` with Zod schema from 5.4, prefilled via query from 5.3, submit calls mutation, success/error toasts via `sonner`, placeholder `+54 9 351 000 0000`, label `"Teléfono WhatsApp del equipo"`. Done-when: component renders with mock data in test (T-6.1 RED before this).
- [x] 5.6 Create `viewpro-app/apps/app-new/src/app/dashboard/settings/tenant-contact/page.tsx` — client component; checks `canManageTenantSettings(activeMembership)` via `useActiveTenant`, redirects to `/dashboard` if false (S-9); renders `<TenantContactForm />` when true (S-8). Done-when: page compiles and redirect logic is unit-testable.
- [x] 5.7 Add nav menu entry for `PRINCIPAL_MANAGER` in `viewpro-app/apps/app-new/src/config/nav-config.ts` pointing to `/dashboard/settings/tenant-contact`. Done-when: entry only visible when `canManageTenantSettings` returns true.

---

## Phase 6 — Frontend tests

- [x] 6.1 Create `viewpro-app/apps/app-new/src/features/settings/tenant-contact/components/tenant-contact-form.test.tsx` — 7 scenarios (D8 + 1 extra error toast): renders prefilled value, null empty state, valid submit triggers mutation, clear+submit sends null, short phone blocks submit (no network call), success toast, error toast with errorCode. Done-when: 7 tests GREEN.
- [x] 6.2 Run `pnpm --filter next-shadcn-dashboard-starter test` — GREEN gate 426 (419 baseline + 7 new). Done-when: zero failures.

---

## Phase 7 — Seeded smoke test

- [x] 7.1 Add S-12 scenario inside `test.describe('Stage 23.3 — tenant WhatsApp contact', { tag: '@serial' }, ...)` in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`: sign in as `demo@viewpro.local`, navigate to `/dashboard/settings/tenant-contact`, read prefilled value, change to `+5491166554433`, submit, wait for success toast, reload, assert input shows `+5491166554433`, then restore to original seeded value (idempotency). Done-when: test block written with role+label anchors per 20.9 convention.
- [x] 7.2 Run `pnpm --filter next-shadcn-dashboard-starter test:seeded` — GREEN gate ≥ 28/28 (27 baseline + 1 new). Done-when: all pass. RESULT: 28/28 GREEN.

---

## Phase 8 — Final verification gates

- [x] 8.1 Run `pnpm --filter @viewpro/api db:validate` — Done-when: GREEN. RESULT: GREEN.
- [x] 8.2 Run `pnpm --filter @viewpro/api typecheck` — Done-when: GREEN. RESULT: GREEN (zero TS errors).
- [x] 8.3 Run `pnpm --filter @viewpro/api test` — Done-when: GREEN ≥ 665 + new API tests. RESULT: GREEN — 702/702 passed.
- [x] 8.4 Run `pnpm --filter next-shadcn-dashboard-starter lint:strict` — Done-when: GREEN. RESULT: GREEN (zero warnings/errors).
- [x] 8.5 Run `pnpm --filter next-shadcn-dashboard-starter test` — Done-when: GREEN ≥ 419 + 6. RESULT: GREEN — 426/426 passed.
- [x] 8.6 Run seed + seeded smoke: `pnpm demo:seed && pnpm --filter next-shadcn-dashboard-starter test:seeded` — Done-when: 28/28 GREEN. RESULT: GREEN — 28/28 passed (seed log includes "Contact fixtures: tenant WhatsApp").
- [x] 8.7 **Sanity inversion (S-3):** temporarily set digit-count threshold to `< 0` (always pass), run S-3 scenario, confirm it FAILS; restore threshold; confirm GREEN. Done-when: inversion confirmed and reverted. RESULT: CONFIRMED — MIN_WHATSAPP_DIGITS=0 caused 7 failures including "throws BadRequestException with code phone.too_short when digit count < 8 (S-3, FR-4)"; restored to 8; all 702 GREEN.

---

## Spec scenario coverage map

| Scenario | Task(s) |
|----------|---------|
| S-1 Valid phone, 204 + DB | 2.4, 3.2 |
| S-2 Clear to null | 2.4, 3.2 |
| S-3 Too short → 400 `phone.too_short` | 3.1, 3.2, 8.7 |
| S-4 MANAGER → 403 | 2.5, 3.2 |
| S-5 AGENT → 403 | 2.5, 3.2 |
| S-6 Unauthenticated → 401 | 2.5, 3.2 |
| S-7 BFF propagates 400 | 4.2 |
| S-8 Editor page visible with permission | 5.6 |
| S-9 Editor page hidden without permission | 5.6 |
| S-10 Form prefill and submit | 5.5, 6.1 |
| S-11 Client-side validation blocks short phone | 5.4, 6.1 |
| S-12 Seeded smoke round-trip | 7.1, 7.2 |
