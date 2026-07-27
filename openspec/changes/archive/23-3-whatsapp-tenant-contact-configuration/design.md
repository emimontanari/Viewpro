# Design — Stage 23.3 Tenant WhatsApp Contact Configuration

## Status

Accepted — 2026-06-16.

## Source artifacts

- Proposal: `openspec/changes/23-3-whatsapp-tenant-contact-configuration/proposal.md`
- Spec: `openspec/changes/23-3-whatsapp-tenant-contact-configuration/spec.md`

## Scope recap

Add a write path for `Tenant.whatsappPhone` so a `PRINCIPAL_MANAGER` can edit the tenant WhatsApp contact phone from the dashboard. The endpoint is gated by `TENANT_MANAGE_SETTINGS` across three layers (NestJS guard, BFF route session check, Next.js page render). Validation reuses the 23.1 digit-count helper (≥ 8 digits). No schema migration, no new dependency.

---

## Decisions

### D1 — Route placement for the editor page

**Chosen: (a) `/dashboard/settings/tenant-contact`**

A dedicated sub-route inside a new `settings/` group. Path: `viewpro-app/apps/app-new/src/app/dashboard/settings/tenant-contact/page.tsx`.

Rejected:
- `(b)` combined `/dashboard/settings` page — premature aggregation; 23.3 ships exactly one setting (the phone). Forces design decisions for sections that do not exist yet.
- `(c)` `/dashboard/workspaces/contact` — `workspaces/page.tsx` is membership-scoped (lists tenants the user belongs to), not tenant-settings-scoped. Reusing it conflates "switch workspace" with "edit current tenant settings".

Justification: no `dashboard/settings/` directory exists today (`Glob viewpro-app/apps/app-new/src/app/dashboard/settings/**` → empty). Creating the group now keeps slice 23.3 small but reserves a stable location for slice 23-3b (`/dashboard/settings/user-contact`) and any future tenant-level settings.

### D2 — Storage normalization rule

**Chosen: keep the leading `+` if present; strip every character that is not `+` or a decimal digit; do not auto-add `+`.**

Examples (input → stored):
- `" +54 9 351-000-0000 "` → `+5493510000000`
- `"5493510000000"` → `5493510000000`
- `"+5493510000000"` → `+5493510000000`
- `""` / `"   "` / `null` → `null`

Justification: matches the 23.1 read-side normalization at `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts:24` (`whatsappPhone.replace(/\D/g, "")`), which strips non-digits for length-counting but trusts the persisted string for the WhatsApp link rendering. Keeping `+` preserves the canonical international form when the user types it; not forcing `+` keeps backward compatibility with the demo seed shape (`+5493510000000`). Rejected: stripping `+` would diverge from the seed; always-prepend `+` would silently mutate values like `5493510000000` and is closer to E.164 enforcement (explicitly out of scope per proposal:73).

### D3 — Backend module wiring

**Chosen: new dedicated controller `tenants-contact.controller.ts` + new use case file.**

Files to create:
- `viewpro-app/apps/api/src/tenants/tenants-contact.controller.ts` — single endpoint `PATCH /tenants/me/whatsapp-phone`.
- `viewpro-app/apps/api/src/tenants/use-cases/update-tenant-whatsapp-phone.use-case.ts`.
- `viewpro-app/apps/api/src/tenants/dto/update-whatsapp-phone.dto.ts` — class-validator DTO.

Files to extend:
- `viewpro-app/apps/api/src/tenants/tenants.repository.ts` — add `updateWhatsappPhone(tenantId: string, phone: string | null): Promise<void>`.
- `viewpro-app/apps/api/src/tenants/prisma-tenants.repository.ts` — implement it.
- `viewpro-app/apps/api/src/tenants/tenants.module.ts` — register the controller + use case.

Repository signature confirmed: `updateWhatsappPhone(tenantId: string, phone: string | null): Promise<void>`. The use case maps the validated/normalized value to either a digit-stripped string or `null`. Returning `void` (not `Tenant`) matches the FR-1 204 response and avoids leaking full tenant rows to the controller.

Rejected: a single fat `tenants.controller.ts` does not exist today (`tenants.module.ts:1-9` only wires the repo). Creating a dedicated controller named for its responsibility (`tenants-contact`) is consistent with the small-controller pattern in `movement-outcome-labels.controller.ts` and avoids creating a controller that we would have to immediately split when 23-3b lands.

### D4 — Permission gate scaffolding

**Confirmed (backend):** `@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)` on the controller class + `@RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)` on the PATCH method. Mirrors `movement-outcome-labels.controller.ts:32-44`. `TENANT_MANAGE_SETTINGS` already exists at `permissions.constants.ts:3` and is granted to `PRINCIPAL_MANAGER` only via `ALL_MVP_PERMISSIONS` (`role-permissions.ts:4,7`). No `role-permissions.ts` change.

**Confirmed (frontend constant):** add `TENANT_MANAGE_SETTINGS: 'tenant.manage_settings'` to `TENANT_PERMISSIONS` in `viewpro-app/apps/app-new/src/lib/session.ts:12-19`. Naming matches the existing `SCREAMING_SNAKE: 'dot.snake'` pattern (e.g. `MOVEMENTS_CREATE: 'movements.create'`). Also add a small helper `canManageTenantSettings(membership)` next to `canManagePropertyEngagements` (`session.ts:144`) so the page and any future menu entry share one source of truth.

**Page-level gate (chosen): redirect to `/dashboard` if the active membership lacks `TENANT_MANAGE_SETTINGS`.**

Justification: this is a settings page, not a content page. A blank/403 surface inside the dashboard shell is worse UX than bouncing back to the home; redirecting also matches the implicit pattern used elsewhere (auth-gated pages bounce to `/login` instead of rendering a 403 inside the shell). The page still shows a `PropertyPermissionNotice`-style fallback if the redirect has not flushed yet (mirrors `product-form.tsx:231-233`). No nav menu entry is exposed unless the helper returns `true` — this is what keeps unauthorized users from clicking into the page in the first place; the redirect is the safety net.

Rejected: rendering a 403 page inside the shell would require a new layout slot and duplicates the API-layer rejection; not gating at all violates the triple-layer requirement (spec NFR "Triple-layer permission gate", spec.md:112).

### D5 — Editor form fixture (where the prefill value comes from)

**Chosen: (a) new `GET /tenants/me/whatsapp-phone` that returns `{ whatsappPhone: string | null }`.**

Justification:
- REST-correct: a dedicated resource is read with GET and modified with PATCH on the same path.
- Avoids enriching the auth/session payload (which is loaded on every navigation) with a value only one settings page consumes. The session payload at `session.ts:23-33` deliberately exposes only membership metadata, not tenant content fields.
- Keeps the slice small: no `/auth/me` payload change, no migration of `Session` typings, no cache-busting plan for the session context after a PATCH.
- The roundtrip cost is one request on page load. The page is a settings-area destination, not a high-traffic surface.

Trade-off acknowledged: `(b)` would skip one HTTP roundtrip on page load. Rejected because it widens the blast radius: the session payload is consumed by every dashboard page and the session-context tests would all need updates.

The new GET is also gated by `TENANT_MANAGE_SETTINGS`. Same controller (`tenants-contact.controller.ts`), separate handler.

### D6 — Test seed identity for the negative-permission path (S-4 MANAGER → 403)

**Chosen: API e2e uses synthetic users via test fixtures; seeded smoke uses the existing PRINCIPAL_MANAGER only.**

Justification: the spec calls out S-4 (MANAGER → 403) and S-5 (AGENT → 403) as API contracts, not UI flows. The seeded smoke contract from Stage 26.2 currently exposes `demo@viewpro.local` as the single seeded `PRINCIPAL_MANAGER`; adding seeded MANAGER/AGENT users for the sole purpose of proving a 403 would inflate the seed surface and couple this slice to Stage 26.2. The API e2e test already has access to fabricated users through the existing test harness (the codebase has 665 API tests passing today; the e2e suite has a precedent of fabricating role-scoped users for permission tests). The seeded smoke proves the positive path (S-12) only.

Rejected: extending the seed contract for one negative test would touch `seed-demo.mjs` and break the Stage 26.2 deterministic contract surface area without adding evidence value the API e2e cannot already provide.

### D7 — BFF route shape

**Confirmed.** `PATCH /api/tenants/me/whatsapp-phone` and `GET /api/tenants/me/whatsapp-phone`. File: `viewpro-app/apps/app-new/src/app/api/tenants/me/whatsapp-phone/route.ts`. Matches the directory convention from `viewpro-app/apps/app-new/src/app/api/tenants/me/movement-outcome-labels/route.ts:1-49` — same helpers (`bffFetch`, `proxyBffErrorResponse`, `proxyJsonResponse`), same Zod-validation-before-forward pattern. The BFF also enforces Zod on the PATCH body before forwarding so an obviously bad payload never hits the API.

### D8 — Component test depth

**Confirmed at ~6 scenarios:**

1. Renders the form prefilled with the current `whatsappPhone` value passed in via props/query mock.
2. Submitting a valid value triggers the mutation with the trimmed/normalized value.
3. Clearing the input and submitting triggers the mutation with `null`.
4. Submitting a value with `< 8` digits shows a validation error and does NOT call the mutation.
5. 204 response shows a success toast (`sonner` mocked).
6. 400 response with `phone.too_short` shows an error toast referencing the error.

Hidden/permission-denied render is covered separately by the page-level redirect test (not the form unit). This keeps the form test focused on form mechanics.

### D9 — Seeded smoke shape

**Confirmed.** One new test in `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`. Flow:

1. Log in as the seeded principal manager (`demo@viewpro.local`).
2. Navigate via direct URL `/dashboard/settings/tenant-contact` (anchor by `role="textbox"` + visible label "Teléfono WhatsApp" or equivalent — keep convention from 20.9/20.11).
3. Read the prefilled value, change it to `+5493510000001` (different from the seeded default to prove a real round-trip), submit.
4. Wait for success toast, reload the page, assert the input now shows `+5493510000001`.
5. **Idempotency restore step:** set it back to the seeded default before the test ends. This prevents the seeded smoke run from polluting demo-state for subsequent runs (proposal:121 risk).

### D10 — Workload forecast and PR boundary

**Confirmed: single PR with `size:exception` label.**

| Layer | Files | Est. LOC |
|------|-------|---------|
| Backend (controller + use case + DTO + repo extension + module wiring) | 5 | ~120 |
| BFF route | 1 | ~30 |
| Frontend (page + feature folder: form, api/types, api/service, api/queries, schema + session.ts entry) | 6 | ~180 |
| Tests (API unit, API e2e, component, seeded smoke) | 4 | ~200 |
| **Total** | **~16** | **~530** |

Single-PR with `size:exception` is the right call: the slice is one vertical capability (one endpoint + one editor) and splitting it would create chained PRs where each is non-demonstrable on its own (backend without UI is invisible; UI without backend is not testable end-to-end). This matches the 20.9 precedent that landed a similarly-scoped vertical slice with `size:exception`.

---

## Component architecture (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js app-new)                                                 │
│                                                                            │
│  /dashboard/settings/tenant-contact/page.tsx                               │
│    │  permission gate #1: redirect if !canManageTenantSettings(            │
│    │     activeMembership) → /dashboard                                    │
│    ▼                                                                       │
│  features/settings/components/tenant-contact-form.tsx                      │
│    │  useAppForm({ defaultValues: { whatsappPhone }, validators: Zod })    │
│    │  uses useTenantWhatsappPhoneQuery() for prefill                       │
│    │  uses useUpdateTenantWhatsappPhoneMutation() on submit                │
│    ▼                                                                       │
│  features/settings/api/service.ts (fetch wrappers over /api/...)           │
│    │                                                                       │
└────│───────────────────────────────────────────────────────────────────────┘
     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ BFF (Next.js Route Handler)                                                │
│  app/api/tenants/me/whatsapp-phone/route.ts                                │
│    │  permission gate #2: bffFetch attaches session cookie; Zod validates  │
│    │     body shape before forward; proxies 204/400/401/403 verbatim       │
│    ▼                                                                       │
└────│───────────────────────────────────────────────────────────────────────┘
     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ API (NestJS)                                                               │
│  tenants/tenants-contact.controller.ts                                     │
│    @UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)           │
│    │  permission gate #3: @RequirePermissions(TENANT_MANAGE_SETTINGS)      │
│    ▼                                                                       │
│  tenants/use-cases/update-tenant-whatsapp-phone.use-case.ts                │
│    │  normalize (D2) → validate digits ≥ 8 → throw 400 phone.too_short     │
│    ▼                                                                       │
│  tenants/tenants.repository.ts (updateWhatsappPhone)                       │
│    ▼                                                                       │
│  tenants/prisma-tenants.repository.ts                                      │
│    ▼                                                                       │
│  Prisma → Tenant.whatsappPhone                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

Permission gate exists at all three layers (frontend redirect, BFF cookie forward, API guard). The API guard is the security source of truth (per `apps/app-new/CLAUDE.md` and `docs/nav-rbac.md`).

---

## Fixture shapes

### Zod schema (frontend, reused by form + BFF Zod check)

```ts
// features/settings/schemas/tenant-whatsapp-phone.ts
// shape only — no implementation
{
  whatsappPhone: string nullable
    .transform(trim and strip non-[+digit])
    .refine(value is null OR digit-count ≥ 8, message 'phone.too_short')
}
```

### API DTO (NestJS, class-validator)

```ts
// tenants/dto/update-whatsapp-phone.dto.ts
{
  whatsappPhone: string | null   // IsOptional + (IsString OR null); raw input
}
```

The DTO accepts the raw value; the use case normalizes and validates. This keeps the controller thin and the digit-count rule co-located with the use case (and reuses the existing helper logic from `owner-whatsapp-contact.ts:24-26`).

### Repository method

```ts
TenantsRepository {
  updateWhatsappPhone(tenantId: string, phone: string | null): Promise<void>
}
```

### BFF PATCH body / GET response shapes

- PATCH body: `{ "whatsappPhone": string | null }` (validated by Zod in the BFF before forward).
- PATCH response: `204 No Content`.
- GET response: `{ "whatsappPhone": string | null }` (200).

---

## Pre-implementation audit (R-D3 discipline from 20.11)

The tasks phase MUST run these searches before mutating shared surfaces, and the apply phase MUST verify zero collateral damage:

```bash
# 1. Confirm nothing else consumes TENANT_PERMISSIONS in a way that would break
#    when the constant set grows by one entry.
rg "TENANT_PERMISSIONS" viewpro-app/apps/app-new/src --type ts --type tsx
#    Expected: imports in product-form.tsx and product-table.test.tsx; both
#    treat TENANT_PERMISSIONS as an object — additive change is safe.

# 2. Confirm no existing route already claims /dashboard/settings/*.
fd "settings" viewpro-app/apps/app-new/src/app/dashboard --type d
#    Expected: zero results (verified during design).

# 3. Confirm no existing controller already binds @Controller('tenants/me/...')
#    or 'tenants' in a way that would collide.
rg "@Controller\(['\"]tenants" viewpro-app/apps/api/src
#    Expected: only movement-outcome-labels.controller.ts at
#    'tenants/me/movement-outcome-labels'. No collision.

# 4. Confirm TenantsRepository has no existing consumer outside the auth
#    register-tenant use case that would be impacted by adding a method.
rg "TenantsRepository|TENANTS_REPOSITORY" viewpro-app/apps/api/src
#    Expected: register-tenant.use-case.ts + the tenants module files only.

# 5. Confirm the digit-count helper is exported in a way the new use case can
#    import without circular deps. If not, extract the digit-count rule to a
#    shared internal helper at the time of the apply.
rg "MIN_WHATSAPP_DIGITS|replace\(/\\\\D/g" viewpro-app/apps/api/src
#    Expected: owner-whatsapp-contact.ts only.

# 6. Confirm no seed/test currently mutates Tenant.whatsappPhone at runtime
#    that the new endpoint would race against.
rg "whatsappPhone" viewpro-app/apps/api
#    Expected: seed-demo.mjs (set-once), schema.prisma, owner-portal read path.
```

Any unexpected hit on any of these stops the apply and forces design revisit.

---

## Risks

1. **Triple-layer permission gate drift.** Three layers (frontend redirect, BFF, API) must all enforce `TENANT_MANAGE_SETTINGS`. Any single layer missing it is a security hole. Mitigation: the apply phase MUST add at least one test per layer (page-redirect component test, BFF integration assertion via the e2e fetching through the BFF in dev mode OR a unit test on the route handler, API e2e for 403). The API e2e is the security source of truth.
2. **Form prefill empty-state UX.** When `Tenant.whatsappPhone` is `null`, the form input is empty. We need a clear placeholder (e.g. `"Sin configurar"` or `"+54 9 351 000 0000"` as a hint) and a label that says the field is optional. Mitigation: design the empty-state in the form component test (D8 covers `prefill from null`). The choice between "Sin configurar" placeholder and a format-hint placeholder is locked at apply: format-hint placeholder, because a "Sin configurar" placeholder reads like a value and a sample like `+54 9 351 000 0000` makes the format expectation obvious. Empty-state label copy: `"Teléfono WhatsApp del equipo"`.
3. **D1 route choice forward compatibility.** If a future slice adds a second tenant-level setting (e.g. notification prefs), `/dashboard/settings/` already exists and the new setting drops in as a sibling. If instead a future slice wants a combined "Configuración" landing page, that page can live at `/dashboard/settings/page.tsx` and link out to `tenant-contact`. The decision is forward-safe.
4. **S-4 MANAGER → 403 without a seeded MANAGER.** The API e2e for MANAGER and AGENT denial relies on the existing fabricated-user fixture pattern. If that fixture turns out to not exist (or to be limited to `PRINCIPAL_MANAGER`), the e2e must add a small helper to mint a MANAGER user inline for the test scope only — NOT through the Stage 26.2 deterministic seed. Mitigation: the tasks phase MUST audit the e2e test infra first (`apps/api/test/*.e2e-spec.ts` precedents) and only fall back to inline-mint if no helper exists.
5. **GET roundtrip + cache staleness.** After PATCH, the GET cache should be invalidated so a page reload (or React Query refetch) reads the new value. Mitigation: the mutation's `onSuccess` invalidates `tenantContactKeys.whatsappPhone()` and the seeded-smoke explicitly reloads the page to test the persistence path end-to-end (not just optimistic UI).

---

## Delivery boundary

- `single_pr_recommended: true`
- `size:exception` required (~530 LOC across ~16 files, justified by single vertical slice; see D10).
- Chain strategy: not applicable (single PR).
