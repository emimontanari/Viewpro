# Property Document Requests Owner-Link Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change property document requests so they target the `PropertyAssetOwner` link and can be created for invited or active linked owners.

**Architecture:** Add `DocumentRequest.propertyAssetOwnerId` as the new request target, keep `ownerUserId` nullable for compatibility, and validate creation against the property-owner link. Internal flows keep tenant/requester visibility; owner portal flows remain authenticated and resolve access through the stored owner link.

**Tech Stack:** NestJS 11, Prisma 6, Postgres, Vitest/Supertest, Next.js 16 app-new BFF, React 19, TanStack Query.

---

### Task 1: Add owner-link schema and migration

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_document_requests_owner_link/migration.sql`

**Step 1: Update schema**

In `PropertyAssetOwner`, add:

```prisma
documentRequests DocumentRequest[]
```

In `DocumentRequest`, change:

```prisma
propertyAssetOwnerId String?
ownerUserId          String?
```

Add relation:

```prisma
propertyAssetOwner PropertyAssetOwner? @relation(fields: [propertyAssetOwnerId], references: [id])
```

Change `ownerUser` to optional:

```prisma
ownerUser User? @relation("DocumentRequestOwner", fields: [ownerUserId], references: [id])
```

Add index:

```prisma
@@index([propertyAssetOwnerId, status])
```

Keep existing `@@index([ownerUserId, status])` for compatibility.

**Step 2: Create migration SQL**

Migration should:

1. Add nullable `propertyAssetOwnerId` to `document_requests`.
2. Drop the old required FK on `ownerUserId`.
3. Make `ownerUserId` nullable.
4. Backfill `propertyAssetOwnerId` by joining:
   - `document_requests.propertyEngagementId`
   - `property_engagements.propertyAssetId`
   - `property_asset_owners.propertyAssetId`
   - `property_asset_owners.userId = document_requests.ownerUserId`
5. Add FK from `document_requests.propertyAssetOwnerId` to `property_asset_owners.id`.
6. Add index on `(propertyAssetOwnerId, status)`.
7. Re-add nullable FK for `ownerUserId` if needed by Prisma migration shape.

**Step 3: Validate schema**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api db:validate
```

Expected: Prisma schema validates.

---

### Task 2: Update backend contracts and create flow

**Files:**
- Modify: `viewpro-app/apps/api/src/documents/dto/create-document-request.dto.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts`
- Modify: `viewpro-app/apps/api/src/documents/document-response.mapper.ts`

**Step 1: DTO**

Accept the new owner-link field and the legacy owner-user field during migration:

```ts
propertyAssetOwnerId?: string
ownerUserId?: string
```

The use case rejects requests where both are missing. New app-new clients send `propertyAssetOwnerId`; legacy clients can still send `ownerUserId` while the backend resolves it to the matching `PropertyAssetOwner`.

**Step 2: Repository types**

Change create input to:

```ts
propertyAssetOwnerId: string;
ownerUserId?: string | null;
```

Change `findTenantEngagementForDocumentRequest` input to accept either `propertyAssetOwnerId` or legacy `ownerUserId`, and return resolved owner link metadata:

```ts
propertyAssetOwnerId: string;
ownerUserId: string | null;
```

**Step 3: Prisma creation validation**

Replace `owners.some({ userId, accessStatus: 'ACTIVE' })` with a validation that finds the engagement by tenant/id and owner link:

```ts
propertyAsset: {
  owners: {
    some: {
      id: input.propertyAssetOwnerId,
      accessStatus: { in: ['INVITED', 'ACTIVE'] }
    }
  }
}
```

Return the matched owner link's `id` and `userId` so writes always populate `propertyAssetOwnerId` and populate nullable `ownerUserId` only when available.

**Step 4: Persist request**

Create requests with:

```ts
propertyAssetOwnerId: engagement.propertyAssetOwnerId,
ownerUserId: engagement.ownerUserId,
```

**Step 5: Response mapper**

Expose:

```ts
propertyAssetOwnerId: string | null
ownerUserId: string | null
```

---

### Task 3: Update owner portal repository access

**Files:**
- Modify: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Review: owner use cases under `viewpro-app/apps/api/src/documents/use-cases/*owner*`

**Step 1: Owner list visibility**

Owner list should find requests where:

```ts
propertyAssetOwner: {
  userId: input.ownerUserId,
  accessStatus: 'ACTIVE'
}
```

Include fallback for legacy rows if needed:

```ts
OR: [
  { propertyAssetOwner: { userId: input.ownerUserId, accessStatus: 'ACTIVE' } },
  { propertyAssetOwnerId: null, ownerUserId: input.ownerUserId }
]
```

**Step 2: Owner detail/version visibility**

Apply the same owner-link access check to request detail and document version queries.

**Step 3: Preserve upload semantics**

Do not change `DocumentVersion.uploadedByUserId`; uploads still require a real authenticated user.

---

### Task 4: Update backend tests

**Files:**
- Modify: `viewpro-app/apps/api/test/documents.repository.spec.ts`
- Modify: `viewpro-app/apps/api/test/documents.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/documents.e2e-spec.ts`
- Modify as needed: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`
- Modify as needed: `viewpro-app/apps/api/test/owner-documents.e2e-spec.ts`

**Step 1: Write failing tests**

Add/adjust tests for:

- create request persists `propertyAssetOwnerId`;
- create request accepts invited owner link with `userId: null`;
- legacy `ownerUserId` input resolves to the matching owner link before persistence;
- create request rejects revoked owner link;
- create request rejects owner link from another property/tenant;
- owner portal access uses owner link after active user assignment;
- other owner cannot access a request for another owner link.

**Step 2: Run focused tests**

Run:

```bash
cd viewpro-app
pnpm --filter @viewpro/api test -- test/documents.repository.spec.ts test/documents.use-cases.spec.ts test/documents.e2e-spec.ts test/owner-documents.use-cases.spec.ts test/owner-documents.e2e-spec.ts
```

Expected before implementation: failures around old `ownerUserId` assumptions. Expected after implementation: pass.

---

### Task 5: Update app-new frontend contracts and UI

**Files:**
- Modify: `viewpro-app/apps/app-new/src/features/products/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/create-document-request-dialog.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
- Review: `viewpro-app/apps/app-new/src/features/products/api/service.ts`
- Review: `viewpro-app/apps/app-new/src/app/api/products/[id]/document-requests/route.ts`

**Step 1: Types**

Change payload to:

```ts
export type CreateProductDocumentRequestPayload = {
  propertyAssetOwnerId: string;
  title: string;
  description?: string;
};
```

Change response type to include:

```ts
propertyAssetOwnerId: string | null;
ownerUserId: string | null;
```

**Step 2: Dialog state**

Replace `ownerUserId` form state with `propertyAssetOwnerId`.

Select item value should be `owner.id`, not `owner.userId`.

Owner option type should be `PropertyLinkedOwner`, not `PropertyLinkedOwner & { userId: string }`.

**Step 3: Property document section**

Eligible owners:

```ts
owner.accessStatus === 'INVITED' || owner.accessStatus === 'ACTIVE'
```

Request display lookup:

```ts
owners.find((owner) => owner.id === request.propertyAssetOwnerId)
```

Update hint copy so invited owners are allowed, not blocked.

---

### Task 6: Update documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-7-documents-design.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-7-documents-implementation.md`
- Modify: `docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md`
- Already created: `docs/plans/2026-05-22-property-document-requests-owner-link-design.md`
- Already created: `docs/plans/2026-05-22-property-document-requests-owner-link-implementation.md`

**Step 1: Update old assumption**

Replace language saying document requests target `ownerUserId` or only active owner users with language saying:

- new requests target `PropertyAssetOwner`;
- invited and active linked owners can receive requests;
- owner portal upload/read still requires an active authenticated user.

**Step 2: Keep historical context clear**

Do not rewrite Stage 7 history as if it originally shipped with owner links. Add notes that the model was revised after the pending-owner assignment correction.

---

### Task 7: Validate and review

**Files:**
- No direct edits.

**Step 1: Run API checks**

```bash
cd viewpro-app
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test -- test/documents.repository.spec.ts test/documents.use-cases.spec.ts test/documents.e2e-spec.ts test/owner-documents.use-cases.spec.ts test/owner-documents.e2e-spec.ts
```

**Step 2: Run app-new checks**

```bash
cd viewpro-app
pnpm --filter next-shadcn-dashboard-starter lint
pnpm --filter next-shadcn-dashboard-starter build
```

If build is too slow or blocked by environment, run the strongest available local equivalent and document the blocker.

**Step 3: Fresh review**

Run a fresh reviewer over the diff before push. Confirm:

- no fake users;
- no `ACTIVE && userId` frontend gate for request creation;
- owner portal still protects uploads/read by authenticated active owner;
- migration is additive and backfills existing rows.

---
