# Stage 23.2 Movement WhatsApp Contact Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add movement-level WhatsApp contact from owner timeline movements to `Movement.createdByUser.whatsappPhone`, with safe tracking and no changes to Stage 23.1 property contact.

**Architecture:** Owner-authorized timeline responses gain an explicit movement `contact` object derived from the movement author's WhatsApp phone. A movement-specific tracking endpoint records `WHATSAPP_CONTACT_CLICKED` with movement context. app-new renders a compact `Consultar responsable` action in owner timeline cards and uses a shared WhatsApp URL utility.

**Tech Stack:** NestJS, Prisma, Vitest, Next.js App Router BFF routes, React, owner portal app-new components.

---

## Scope guard

Implement **Stage 23.2 only**.

In scope:

- movement contact target: `Movement.createdByUser.whatsappPhone`;
- owner timeline movement response `contact` object;
- movement-specific click tracking endpoint;
- app-new owner timeline WhatsApp action;
- safe structured WhatsApp message: property + movement type/status/date.

Out of scope:

- tenant fallback for movement questions;
- settings/admin UI for user phone configuration;
- WhatsApp Business API;
- movement creation on behalf of another user;
- adding phone under `createdBy`;
- changing Stage 23.1 property contact behavior.

Do not commit, push, or open PR until the user explicitly approves.

---

## Task 1: Add backend failing tests for movement contact in owner timeline

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts`

**Step 1: Extend movement test factory**

Update the movement factory so `createdBy` can include `whatsappPhone` internally for tests.

**Step 2: Add available-contact assertions**

Add assertions that `GetOwnerEngagementTimelineUseCase` maps a movement with author phone to:

```ts
contact: {
  available: true,
  targetType: 'movement_author',
  displayLabel: 'Consultar responsable',
  whatsappPhone: '+5493510000000',
}
```

**Step 3: Add unavailable-contact assertions**

Add cases for `null` or invalid `createdBy.whatsappPhone`:

```ts
contact: {
  available: false,
  targetType: 'movement_author',
  displayLabel: 'Contacto no configurado',
}
```

Assert there is no `whatsappPhone` under `createdBy` in the mapped response.

**Step 4: Run RED test**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
```

Expected before implementation: fail because movement `contact` is not implemented.

---

## Task 2: Implement backend movement contact response mapping

**Files:**
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-whatsapp-contact.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/responses/owner-movement.response.ts`

**Step 1: Select author phone internally**

Update owner movement record/include types to select:

```ts
createdBy: { id: true, email: true, firstName: true, whatsappPhone: true }
```

This must remain internal to the mapper.

**Step 2: Add movement contact mapper**

Add `mapMovementAuthorWhatsappContact()` in `owner-whatsapp-contact.ts` using the same minimum digit validation as Stage 23.1.

Available contact:

```ts
{
  available: true,
  targetType: 'movement_author',
  displayLabel: 'Consultar responsable',
  whatsappPhone,
}
```

Unavailable contact:

```ts
{
  available: false,
  targetType: 'movement_author',
  displayLabel: 'Contacto no configurado',
}
```

**Step 3: Map response**

Update `owner-movement.response.ts` so the response includes `contact` and `createdBy` remains only:

```ts
{
  id,
  email,
  firstName,
}
```

No tenant fallback.

**Step 4: Run GREEN tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: movement contact tests pass; Stage 23.1 owner contact tests remain green.

---

## Task 3: Add backend failing tests for movement-specific tracking

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.use-cases.spec.ts`

**Step 1: Extend repository mock**

Add mock method:

```ts
findMovementContactContextForOwner({ userId, engagementId, movementId })
```

**Step 2: Add use-case tests**

For new `TrackOwnerMovementWhatsappContactClickUseCase`, assert it:

- calls repository with `{ userId, engagementId, movementId }`;
- tracks `AnalyticsEventName.WHATSAPP_CONTACT_CLICKED`;
- uses `AnalyticsActorType.OWNER`;
- sets `tenantId`, `propertyEngagementId`, `propertyAssetId`, `movementId`, `actorUserId`;
- metadata is exactly:

```ts
{ context: 'movement', targetType: 'movement_author' }
```

Also test:

- inaccessible/missing movement throws `NotFoundException('Owner movement not found')`;
- analytics failure does not fail the request.

**Step 3: Run RED test**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
```

Expected before implementation: fail because use case/repository method does not exist.

---

## Task 4: Implement backend movement tracking endpoint

**Files:**
- Create: `viewpro-app/apps/api/src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/prisma-owner-portal.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.module.ts`
- Modify: `viewpro-app/apps/api/src/owner-portal/owner-portal.controller.ts`

**Step 1: Add repository contract**

Add:

```ts
findMovementContactContextForOwner(input: {
  userId: string;
  engagementId: string;
  movementId: string;
}): Promise<OwnerMovementContactContext | null>;
```

Context should include:

- `tenantId`;
- `propertyEngagementId`;
- `propertyAssetId`;
- `movementId`.

**Step 2: Implement Prisma lookup**

Verify in one authorized path:

- owner has active access to the engagement property;
- movement id matches `movementId`;
- movement belongs to `engagementId`.

**Step 3: Add use case**

Use existing Stage 23.1 analytics patterns but metadata must be:

```ts
{ context: 'movement', targetType: 'movement_author' }
```

Catch analytics failure / do not break the request.

**Step 4: Add controller route**

Add:

```ts
@Post('engagements/:engagementId/movements/:movementId/whatsapp-contact-click')
@HttpCode(204)
```

Public API path:

```txt
POST /api/owner/engagements/:engagementId/movements/:movementId/whatsapp-contact-click
```

Do not modify existing Stage 23.1 property endpoint.

**Step 5: Register use case**

Add it to `OwnerPortalModule` providers/exports pattern.

**Step 6: Run tests**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: new movement tracking tests pass and existing property tracking tests remain green.

---

## Task 5: Add backend e2e coverage

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-portal.e2e-spec.ts`

**Step 1: Add timeline contact assertions**

In owner timeline e2e setup, configure movement creator:

```ts
await prisma.user.update({
  where: { id: manager.userId },
  data: { whatsappPhone: '+5493510000000' },
});
```

Assert timeline movement includes:

```ts
contact: {
  available: true,
  targetType: 'movement_author',
  displayLabel: 'Consultar responsable',
  whatsappPhone: '+5493510000000',
}
```

Assert `createdBy` does not have `whatsappPhone`.

**Step 2: Add unavailable case**

If practical, add/extend a movement whose author has no or invalid `whatsappPhone` and assert:

- `contact.available === false`;
- `displayLabel === 'Contacto no configurado'`;
- no tenant fallback.

**Step 3: Add movement click tracking e2e**

Test:

- owner POSTs movement click endpoint and receives `204`;
- inaccessible owner receives `404`;
- movement from another engagement receives `404`;
- persisted analytics event has `movementId`;
- metadata exactly `{ context: 'movement', targetType: 'movement_author' }`;
- metadata excludes phone, address, message, author/owner email.

**Step 4: Run e2e when DB is available**

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.e2e-spec.ts
```

Expected: pass when local Postgres is available. If local DB is unavailable, record caveat and rely on focused use-case tests plus CI.

---

## Task 6: Add app-new BFF route for movement click tracking

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/movements/[movementId]/whatsapp-contact-click/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/engagements/[id]/movements/[movementId]/whatsapp-contact-click/route.test.ts`

**Step 1: Write route tests**

Assert route forwards to backend path:

```txt
/owner/engagements/engagement-1/movements/movement-1/whatsapp-contact-click
```

with method `POST`.

Also test:

- backend `204` passes through;
- backend `404` passes through;
- BFF fetch error returns safe Spanish fallback.

**Step 2: Implement route**

Use existing `bffFetch`, `proxyJsonResponse`, and `proxyBffErrorResponse` patterns. Do not force success status; preserve backend status.

**Step 3: Run test**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test 'src/app/api/owner/engagements/[id]/movements/[movementId]/whatsapp-contact-click/route.test.ts'
```

Expected: pass.

---

## Task 7: Add app-new service method

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/service.test.ts`

**Step 1: Write service tests**

Add test for:

```ts
trackOwnerMovementWhatsappContactClick('engagement-1', 'movement-1')
```

Expected fetch path:

```txt
/api/owner/engagements/engagement-1/movements/movement-1/whatsapp-contact-click
```

Options:

```ts
{
  method: 'POST',
  keepalive: true,
  credentials: 'include',
  cache: 'no-store',
}
```

**Step 2: Implement service function**

Keep existing `trackOwnerWhatsappContactClick()` unchanged.

**Step 3: Run service tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/api/service.test.ts
```

Expected: pass.

---

## Task 8: Add frontend movement contact types and WhatsApp utility

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/utils/owner-whatsapp-contact.test.ts`

**Step 1: Add type**

Add:

```ts
export type OwnerMovementContact = {
  available: boolean;
  targetType: 'movement_author';
  displayLabel: string;
  whatsappPhone?: string;
};
```

Add `contact: OwnerMovementContact` to `OwnerMovement`.

**Step 2: Write utility tests**

For `buildOwnerMovementWhatsappHref()`, test:

- returns `https://wa.me/<digits>?text=<encodedMessage>`;
- strips non-digits from phone;
- includes property address/location;
- includes movement type;
- includes status when `newStatus` exists;
- includes date;
- excludes `observation`, `nextStep`, internal ids, and phone from message text;
- returns `null` for unavailable/invalid contact.

**Step 3: Implement utility**

Use shared digit normalization from Stage 23.1 utility.

Message should be structured, e.g.:

```txt
Hola, soy propietario de Av. Siempre Viva 123.
Quería consultar por este movimiento:

Tipo: Cambio de estado
Estado: En negociación
Fecha: 01/06/2026

Gracias.
```

**Step 4: Run utility tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/utils/owner-whatsapp-contact.test.ts
```

Expected: pass and existing property URL tests remain green.

---

## Task 9: Wire movement contact UI into owner timeline

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-engagement-card.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-timeline.test.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`

**Step 1: Pass property context down**

Pass owner-visible property context:

```txt
OwnerPropertyDetail → OwnerEngagementCard → OwnerTimeline → movement item
```

**Step 2: Add UI tests**

Test available movement contact:

- renders `Consultar responsable`;
- link href contains `wa.me`;
- decoded message includes property/type/status/date;
- decoded message does not include `observation`;
- click calls `trackOwnerMovementWhatsappContactClick(engagementId, movementId)`.

Test unavailable movement contact:

- renders disabled/non-link `Contacto no configurado`.

**Step 3: Implement UI**

In each movement card:

- available: external link, label `Consultar responsable`, `target="_blank"`, `rel="noopener noreferrer"`;
- unavailable: disabled button/text `Contacto no configurado`;
- click tracking is best-effort and non-blocking:

```ts
void trackOwnerMovementWhatsappContactClick(engagementId, movement.id).catch(() => undefined);
```

Do not change `owner-home.tsx` property CTA.

**Step 4: Run component tests**

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-timeline.test.tsx src/features/owner/components/owner-property-detail.test.tsx
```

Expected: pass.

---

## Task 10: Non-regression tests for Stage 23.1 property contact

**Files:**
- No code changes expected.

Run:

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/components/owner-home.test.tsx src/features/owner/utils/owner-whatsapp-contact.test.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
```

Expected:

- property-level contact still routes to tenant contact;
- existing property click endpoint remains unchanged;
- property CTA copy remains `Contactar inmobiliaria`.

---

## Task 11: Final validation

**Files:**
- None.

Run:

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/owner-portal.e2e-spec.ts
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/owner/api/service.test.ts src/features/owner/utils/owner-whatsapp-contact.test.ts src/features/owner/components/owner-home.test.tsx src/features/owner/components/owner-property-detail.test.tsx src/features/owner/components/owner-timeline.test.tsx 'src/app/api/owner/engagements/[id]/movements/[movementId]/whatsapp-contact-click/route.test.ts'
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

If local DB is unavailable, `owner-portal.e2e-spec.ts` may fail before assertions with `localhost:5432`; record that caveat and rely on DB-backed CI.

---

## Review checklist

Fresh review before PR must verify:

- Stage 23.2 only;
- no tenant fallback for movement contact;
- no `whatsappPhone` under `createdBy`;
- no movement observation in WhatsApp message;
- no phone/message/author/owner/address PII in analytics metadata;
- Stage 23.1 property contact unchanged;
- owner authorization before movement contact data and click tracking.
