# Stage 23.1 Property WhatsApp Contact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let owners contact the inmobiliaria from the owner portal property context through a real WhatsApp link backed by `Tenant.whatsappPhone`, and record safe click analytics.

**Architecture:** Stage 23.1 adds contact data to the tenant read model, replaces the current owner portal `mailto:` CTA with a WhatsApp URL, and tracks clicks through a best-effort owner-authorized API endpoint. It deliberately does not implement movement-level author contact, WhatsApp Business API, or phone configuration UI.

**Tech Stack:** NestJS, Prisma, Vitest, Next.js App Router BFF routes, React, TanStack/query-style owner services, Playwright seeded smoke.

---

## Scope guard

Implement **Stage 23.1 only**.

In scope:

- `Tenant.whatsappPhone` for property-level owner contact.
- Optional DB-only `User.whatsappPhone` in the same migration to reduce Stage 23.2 churn.
- Owner portal property CTA: `Contactar inmobiliaria`.
- WhatsApp URL generated from tenant phone + owner-visible property context.
- `WHATSAPP_CONTACT_CLICKED` analytics event with safe metadata.

Out of scope:

- Movement-level CTA.
- Routing to `Movement.createdByUser`.
- Settings/admin UI for phone configuration.
- WhatsApp Business API.
- Server-side message sending.
- Exposing user phone in owner responses.

Do not commit, push, or open a PR until the user explicitly approves.

---

## Task 1: Confirm baseline

**Files:**
- Read: `docs/plans/2026-06-01-stage-23-whatsapp-contact-design.md`
- Read: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`
- Read: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`

**Step 1: Verify clean branch**

Run:

```bash
git status --short --branch
```

Expected: on `develop`, no unrelated changes except the Stage 23 docs if planning is still uncommitted.

**Step 2: Run baseline focused tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.repository.spec.ts test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx src/features/owner/api/service.test.ts
```

Expected: pass before changes, or record existing failures before editing.

---

## Task 2: Add RED backend tests for tenant contact exposure

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.repository.spec.ts`
- Modify: `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts`

**Step 1: Write repository test for available contact**

Add a case that creates an owner-accessible property engagement whose tenant has:

```ts
whatsappPhone: '+5493510000000'
```

Assert the owner portal engagement response includes:

```ts
contact: {
  available: true,
  targetType: 'tenant',
  displayLabel: 'Contactar inmobiliaria',
  whatsappPhone: '+5493510000000',
}
```

**Step 2: Write repository/use-case test for unavailable contact**

Create a tenant with no `whatsappPhone` and assert:

```ts
contact: {
  available: false,
  targetType: 'tenant',
  displayLabel: 'Contacto no configurado',
}
```

Also assert no broad tenant/user contact fields leak outside the explicit `contact` object.

**Step 3: Run RED tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.repository.spec.ts test/owner-portal.use-cases.spec.ts
```

Expected before implementation: fail because `Tenant.whatsappPhone` and `contact` do not exist.

---

## Task 3: Add Prisma schema fields and migration

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/20260601120000_add_whatsapp_contact_fields/migration.sql`

**Step 1: Add fields**

In `Tenant`, add:

```prisma
whatsappPhone String?
```

In `User`, add DB-only future field:

```prisma
whatsappPhone String?
```

Do not expose `User.whatsappPhone` in Stage 23.1 API responses.

**Step 2: Add migration SQL**

```sql
ALTER TABLE "tenants" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "users" ADD COLUMN "whatsappPhone" TEXT;
```

**Step 3: Validate and generate**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api db:generate
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: all pass.

---

## Task 4: Implement owner contact response mapping

**Files:**
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/responses/owner-engagement.response.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts`

**Step 1: Add contact type**

Use a response type equivalent to:

```ts
export type OwnerPropertyContactResponse = {
  available: boolean;
  targetType: 'tenant';
  displayLabel: string;
  whatsappPhone?: string;
};
```

**Step 2: Add helper**

Create a helper that accepts a nullable phone and returns:

- available contact when the phone has enough digits for WhatsApp;
- unavailable contact otherwise.

Keep validation conservative and simple:

```ts
const digits = phone.replace(/\D/g, '');
const isAvailable = digits.length >= 8;
```

Do not overfit Argentina-only formats.

**Step 3: Select tenant phone**

Update the owner portal Prisma read model to select tenant `whatsappPhone` in addition to `id` and `name`.

**Step 4: Map response**

Add `contact` to the owner engagement response. Keep existing tenant response limited to `{ id, name }`.

**Step 5: Run GREEN tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.repository.spec.ts test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: contact exposure tests pass.

---

## Task 5: Seed demo tenant WhatsApp phone

**Files:**
- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Add demo config value**

Add a seed constant:

```js
const DEMO_TENANT_WHATSAPP_PHONE =
  process.env.VIEWPRO_DEMO_TENANT_WHATSAPP_PHONE ?? '+5493510000000';
```

**Step 2: Persist on demo tenant**

When creating/upserting the demo tenant, set:

```js
whatsappPhone: DEMO_TENANT_WHATSAPP_PHONE
```

Do not seed user WhatsApp phone for Stage 23.1.

**Step 3: Validate**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Optional when local DB is available:

```bash
pnpm --dir viewpro-app demo:seed
```

---

## Task 6: Add RED backend tests for WhatsApp click analytics

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts`

**Step 1: Add use-case tests**

Add tests for a property contact click that assert:

- owner access is verified before tracking;
- event is `AnalyticsEventName.WHATSAPP_CONTACT_CLICKED`;
- `actorType` is `AnalyticsActorType.OWNER`;
- first-class columns include `tenantId`, `propertyEngagementId`, `propertyAssetId`, and `actorUserId` when authenticated;
- metadata is exactly safe context, for example:

```ts
{
  context: 'property',
  targetType: 'tenant',
}
```

**Step 2: Add e2e tests**

Add e2e coverage for:

- active owner can `POST /api/owner/engagements/:engagementId/whatsapp-contact-click` and receives `204`;
- unrelated owner receives `404`;
- persisted analytics event does not include phone number, message text, owner name, property address, tenant name, or agent name in metadata.

**Step 3: Run RED tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.e2e-spec.ts
```

Expected before implementation: fail on missing enum, use case, or route.

---

## Task 7: Implement backend click tracking endpoint

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.controller.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.module.ts`
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/track-owner-whatsapp-contact-click.use-case.ts`

**Step 1: Add analytics enum value**

In `AnalyticsEventName`, add:

```prisma
WHATSAPP_CONTACT_CLICKED
```

If this changes Prisma generated types, run `db:generate` again.

**Step 2: Add repository lookup**

Add a repository method that finds an engagement by owner access and returns only:

- engagement id;
- tenant id;
- property asset id.

Use the existing owner access patterns from `get-owner-property` / timeline use cases.

**Step 3: Add use case**

Create `TrackOwnerWhatsappContactClickUseCase` that:

- verifies the owner can access the engagement;
- throws `NotFoundException` when not accessible;
- calls `AnalyticsService.track()` with:
  - `AnalyticsEventName.WHATSAPP_CONTACT_CLICKED`;
  - `AnalyticsActorType.OWNER`;
  - `actorUserId` from current owner user;
  - `tenantId`, `propertyEngagementId`, `propertyAssetId`;
  - metadata `{ context: 'property', targetType: 'tenant' }`;
- catches analytics failure or relies on `AnalyticsService.track()` result without breaking the request.

**Step 4: Add controller route**

Add:

```ts
@Post('engagements/:engagementId/whatsapp-contact-click')
@HttpCode(204)
```

Route should map to public API path:

```text
POST /api/owner/engagements/:engagementId/whatsapp-contact-click
```

**Step 5: Run GREEN tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api db:generate
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts test/owner-portal.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: pass.

---

## Task 8: Add BFF route and owner service tracking

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/whatsapp-contact-click/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/whatsapp-contact-click/route.test.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/service.test.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`

**Step 1: Add frontend owner contact type**

Add a type equivalent to:

```ts
export type OwnerPropertyContact = {
  available: boolean;
  targetType: 'tenant';
  displayLabel: string;
  whatsappPhone?: string;
};
```

Add `contact: OwnerPropertyContact` to the owner engagement type that backs `owner-home.tsx`.

**Step 2: Add BFF route tests**

Test that the BFF proxies:

```text
POST /api/owner/engagements/:id/whatsapp-contact-click
```

to backend:

```text
POST /owner/engagements/:id/whatsapp-contact-click
```

Preserve session/cookie/error handling patterns from nearby owner BFF route tests.

**Step 3: Implement BFF route**

Proxy to backend using existing app-new BFF helper patterns.

**Step 4: Add service method**

Add:

```ts
trackOwnerWhatsappContactClick(engagementId: string): Promise<void>
```

Use `fetch` with:

```ts
{
  method: 'POST',
  credentials: 'include',
  keepalive: true,
}
```

The UI will treat this as best effort.

**Step 5: Run tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/owner/engagements/[id]/whatsapp-contact-click/route.test.ts' src/features/owner/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

Expected: pass.

---

## Task 9: Add WhatsApp URL utility

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.ts`
- Create: `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`

**Step 1: Write utility tests**

Test that the helper:

- returns `null` when contact is unavailable;
- strips non-digits from `+5493510000000` for `wa.me`;
- uses `encodeURIComponent` for message text;
- includes only owner-visible property context;
- never includes raw `+` in the `wa.me` phone path.

**Step 2: Implement utility**

Expose a helper equivalent to:

```ts
buildOwnerPropertyWhatsappHref({
  contact,
  property,
}: {
  contact: OwnerPropertyContact;
  property: { address: string; city?: string | null; province?: string | null };
}): string | null
```

Message example:

```text
Hola, soy propietario de Av. Siempre Viva 123, Córdoba, Córdoba.
Quería hacer una consulta general sobre esta propiedad.
```

**Step 3: Run tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/utils/owner-whatsapp-contact.test.ts
```

Expected: pass.

---

## Task 10: Replace owner portal `mailto:` CTA with WhatsApp CTA

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-home.test.tsx`

**Step 1: Add UI tests**

Update tests to assert:

- no `mailto:` contact link remains;
- available contact renders `Contactar inmobiliaria` with `https://wa.me/...`;
- missing contact renders disabled/unavailable state with `Contacto no configurado`;
- click calls `trackOwnerWhatsappContactClick(engagement.id)` best-effort;
- for multiple agencies/engagements, the contact uses the currently visible engagement/tenant.

**Step 2: Implement UI**

Remove old `getOwnerContactHref()` email behavior.

Build contact link from:

- current visible engagement contact;
- current owner-visible property context;
- `buildOwnerPropertyWhatsappHref()`.

External link should use:

```tsx
target="_blank"
rel="noopener noreferrer"
```

Call tracking on click, but do not block navigation if tracking fails.

**Step 3: Run tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx src/features/owner/utils/owner-whatsapp-contact.test.ts src/features/owner/api/service.test.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

Expected: pass.

---

## Task 11: Update seeded smoke coverage

**Files:**
- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Step 1: Add smoke assertion**

Extend the owner portal smoke to assert:

- `Contactar inmobiliaria` is visible;
- link starts with `https://wa.me/`;
- link does not contain raw `+` in the phone path;
- test does not navigate to WhatsApp.

**Step 2: Run seeded smoke when environment is available**

Run when seeded environment is available:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test:seeded -- tests/seeded/demo-smoke.spec.ts
```

If local seeded environment is unavailable, record the reason and rely on focused component/service tests plus CI.

---

## Task 12: Final validation

**Files:**
- None.

**Step 1: Backend validation**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api db:generate
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.repository.spec.ts test/owner-portal.use-cases.spec.ts test/owner-portal.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

**Step 2: App-new validation**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/owner/engagements/[id]/whatsapp-contact-click/route.test.ts' src/features/owner/api/service.test.ts src/features/owner/utils/owner-whatsapp-contact.test.ts src/features/owner/components/owner-home.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
```

**Step 3: Repository checks**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intended Stage 23.1 files changed.

**Step 4: Fresh review before PR**

Run a fresh read-only review against the diff before committing/pushing/opening PR.

Review must verify:

- Stage 23.1 only;
- no movement CTA;
- no WhatsApp Business API;
- no settings UI;
- no phone/message PII in analytics metadata;
- owner access isolation preserved;
- `User.whatsappPhone` is DB-only if included.

---

## PR notes for later

When preparing the PR, include:

- approved issue link;
- exactly one `type:*` label, likely `type:feature`;
- explicit scope: Stage 23.1 only;
- explicit out-of-scope: Stage 23.2 movement author contact;
- validation evidence;
- note that phone configuration is DB/seed/manual until a future settings/admin slice.
