# ViewPro Stage 7 Documents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the backend foundation for secure document requests, owner uploads, version tracking, and signed URL authorization.

**Architecture:** Store document metadata in Postgres with Prisma, keep file bytes outside the database, and hide storage behind `DocumentStoragePort`. The first implementation uses fake/local storage for tests and leaves production S3/R2 wiring for a future slice.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Vitest, Supertest, class-validator, existing ViewPro auth/tenant/owner portal modules.

---

## Rules for this stage

- Follow strict TDD.
- Keep each slice as a reviewable work unit.
- Do not commit unless the user explicitly authorizes it.
- Return `404` for cross-tenant, peer-seller, inaccessible, revoked, or missing resources.
- Owner endpoints use `AuthGuard` only and do not require `x-tenant-id`.
- Internal endpoints use tenant context and permission checks.
- Do not implement UI or a production storage provider in this stage.

## Verification commands

Run from `viewpro-app/` unless noted otherwise:

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

## Slice 1 — Base documental

### Task 1: Add Prisma document schema

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_documents/migration.sql`

**Step 1: Write failing repository tests first**

Create `viewpro-app/apps/api/test/documents.repository.spec.ts` with tests that reference the future repository contract and Prisma document enums.

Cover:
- creating a document request with `requestedByUserId` and `ownerUserId`
- listing manager-visible requests
- listing requesting-seller-visible requests
- hiding peer seller requests
- creating a document version with storage metadata

**Step 2: Run tests and confirm failure**

```bash
pnpm --filter @viewpro/api test
```

Expected: fail because document schema/repository does not exist.

**Step 3: Add Prisma enums and models**

Add:
- `DocumentRequestStatus`
- `DocumentVersionStatus`
- `DocumentRequest`
- `Document`
- `DocumentVersion`

Model relationships to add:
- `Tenant.documentRequests`
- `PropertyEngagement.documentRequests`
- `User.requestedDocumentRequests`
- `User.ownedDocumentRequests`
- `User.reviewedDocumentRequests`
- `User.uploadedDocumentVersions`

Recommended indexes:
- `DocumentRequest`: `[tenantId, status, createdAt]`
- `DocumentRequest`: `[tenantId, requestedByUserId]`
- `DocumentRequest`: `[ownerUserId, status]`
- `DocumentRequest`: `[propertyEngagementId]`
- `DocumentVersion`: `[documentId, status]`
- `DocumentVersion`: `[uploadedByUserId]`

**Step 4: Generate migration**

```bash
pnpm --filter @viewpro/api exec prisma migrate dev --name add_documents
```

Expected: migration created and Prisma Client generated.

**Step 5: Run schema verification**

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
```

Expected: pass after repository types are added in later tasks. If typecheck fails only because repository files are missing, continue within the slice.

### Task 2: Create documents module, repository contract, and mappers

**Files:**
- Create: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Create: `viewpro-app/apps/api/src/documents/documents.repository.ts`
- Create: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Create: `viewpro-app/apps/api/src/documents/document-response.mapper.ts`
- Test: `viewpro-app/apps/api/test/documents.repository.spec.ts`

**Step 1: Define repository contract**

Include methods for:
- creating document requests
- finding internal request detail by manager visibility
- finding internal request detail by requester visibility
- listing internal requests by tenant and viewer
- creating pending document versions
- marking versions uploaded
- reviewing requests
- finding owner request detail

**Step 2: Implement Prisma repository minimally**

Make repository queries enforce tenant/user boundaries where possible.

Use explicit include/select shapes. Do not expose password hashes or unrelated owners.

**Step 3: Run repository tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: repository tests pass.

### Task 3: Add storage port and fake adapter

**Files:**
- Create: `viewpro-app/apps/api/src/documents/storage/document-storage.port.ts`
- Create: `viewpro-app/apps/api/src/documents/storage/fake-document-storage.adapter.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Test: `viewpro-app/apps/api/test/documents.storage.spec.ts`

**Step 1: Write tests for fake signed URLs**

Cover:
- upload URL includes the expected storage key
- read URL includes the expected storage key
- TTL is returned in the response object

**Step 2: Implement port and fake adapter**

The fake adapter should not touch the filesystem. It only returns deterministic fake URLs for tests.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add viewpro-app/apps/api/prisma viewpro-app/apps/api/src/documents viewpro-app/apps/api/test/documents.repository.spec.ts viewpro-app/apps/api/test/documents.storage.spec.ts
git commit -m "feat(api): add document repository foundation"
```

## Slice 2 — Internal document use cases

### Task 4: Create internal document request use case

**Files:**
- Create: `viewpro-app/apps/api/src/documents/dto/create-document-request.dto.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/create-document-request.use-case.ts`
- Test: `viewpro-app/apps/api/test/documents.use-cases.spec.ts`

**Step 1: Write failing use-case tests**

Cover:
- manager can create request for an owner on a tenant engagement
- seller can create request for an owner on a tenant engagement
- cross-tenant engagement returns `404`
- owner must have active owner access to the property

**Step 2: Implement minimal use case**

Use current tenant context and current user. Save `requestedByUserId` from current user.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 5: Add internal list/detail use cases

**Files:**
- Create: `viewpro-app/apps/api/src/documents/use-cases/list-document-requests.use-case.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/get-document-request.use-case.ts`
- Test: `viewpro-app/apps/api/test/documents.use-cases.spec.ts`

**Step 1: Write failing tests**

Cover:
- manager lists all tenant requests
- requesting seller lists only own requests
- peer seller cannot read another seller request and receives `404`

**Step 2: Implement use cases**

Use permissions to decide manager vs seller visibility. Do not use property-agent assignment for document request visibility.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 6: Add approve/reject use cases

**Files:**
- Create: `viewpro-app/apps/api/src/documents/dto/reject-document-request.dto.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/approve-document-request.use-case.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/reject-document-request.use-case.ts`
- Test: `viewpro-app/apps/api/test/documents.use-cases.spec.ts`

**Step 1: Write failing tests**

Cover:
- manager approves submitted request
- requesting seller approves submitted request
- peer seller receives `404`
- reject requires non-empty reason
- rejection marks current version rejected and request rejected

**Step 2: Implement use cases**

Preserve review audit fields:
- `reviewedByUserId`
- `reviewedAt`
- `rejectionReason`

**Step 3: Run tests and build**

```bash
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add viewpro-app/apps/api/src/documents viewpro-app/apps/api/test/documents.use-cases.spec.ts
git commit -m "feat(api): add internal document request use cases"
```

## Slice 3 — Owner use cases and upload lifecycle

### Task 7: Add owner list/detail use cases

**Files:**
- Create: `viewpro-app/apps/api/src/documents/use-cases/list-owner-document-requests.use-case.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/get-owner-document-request.use-case.ts`
- Test: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`

**Step 1: Write failing tests**

Cover:
- owner lists only requests addressed to them
- owner detail requires matching `ownerUserId`
- owner with revoked property access receives `404`

**Step 2: Implement use cases**

Use owner user ID and active `PropertyAssetOwner` access through the related property.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 8: Add owner upload URL use case

**Files:**
- Create: `viewpro-app/apps/api/src/documents/dto/create-document-upload-url.dto.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/create-owner-document-upload-url.use-case.ts`
- Test: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`

**Step 1: Write failing tests**

Cover:
- owner can request upload URL for pending/rejected request
- invalid MIME type is rejected
- file over 10 MB is rejected
- other owner receives `404`

**Step 2: Implement use case**

Allowed MIME types:
- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`

Max size: `10 * 1024 * 1024` bytes.

Create `DocumentVersion` with `PENDING_UPLOAD`, deterministic storage key, metadata, and fake signed URL.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 9: Add confirm upload and read URL use cases

**Files:**
- Create: `viewpro-app/apps/api/src/documents/use-cases/confirm-owner-document-upload.use-case.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/create-owner-document-read-url.use-case.ts`
- Create: `viewpro-app/apps/api/src/documents/use-cases/create-internal-document-read-url.use-case.ts`
- Test: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`
- Test: `viewpro-app/apps/api/test/documents.use-cases.spec.ts`

**Step 1: Write failing tests**

Cover:
- confirming upload marks version uploaded and request submitted
- owner read URL requires matching owner
- internal read URL requires manager or requesting seller
- peer seller receives `404`

**Step 2: Implement use cases**

Update `Document.currentVersionId` during confirm upload.

**Step 3: Run tests and build**

```bash
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
```

Expected: pass.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add viewpro-app/apps/api/src/documents viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts viewpro-app/apps/api/test/documents.use-cases.spec.ts
git commit -m "feat(api): add owner document upload lifecycle"
```

## Slice 4 — Controllers, e2e, docs, verification

### Task 10: Add internal document endpoints

**Files:**
- Create: `viewpro-app/apps/api/src/documents/documents.controller.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Test: `viewpro-app/apps/api/test/documents.e2e-spec.ts`

**Status:** ✅ Complete.

**Step 1: Write failing e2e tests**

Cover endpoints:
- `POST /api/property-engagements/:propertyEngagementId/document-requests`
- `GET /api/document-requests`
- `GET /api/document-requests/:id`
- `POST /api/document-requests/:id/approve`
- `POST /api/document-requests/:id/reject`
- `POST /api/document-versions/:id/read-url`

**Step 2: Implement controller**

Use existing auth, tenant context, and permission patterns from property engagements and movements.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 11: Add owner document endpoints

**Files:**
- Create: `viewpro-app/apps/api/src/documents/owner-documents.controller.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Test: `viewpro-app/apps/api/test/owner-documents.e2e-spec.ts`

**Status:** ✅ Complete.

**Step 1: Write failing e2e tests**

Cover endpoints:
- `GET /api/owner/document-requests`
- `GET /api/owner/document-requests/:id`
- `POST /api/owner/document-requests/:id/upload-url`
- `POST /api/owner/document-versions/:id/confirm-upload`
- `POST /api/owner/document-versions/:id/read-url`

**Step 2: Implement owner controller**

Use `AuthGuard` only. Do not require `x-tenant-id`.

**Step 3: Run tests**

```bash
pnpm --filter @viewpro/api test
```

Expected: pass.

### Task 12: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `viewpro-app/README.md`
- Modify: `docs/plans/2026-05-13-viewpro-implementation-roadmap.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-7-documents-design.md`
- Modify: `docs/plans/2026-05-15-viewpro-stage-7-documents-implementation.md`

**Status:** ✅ Complete.

**Step 1: Update docs**

Document:
- request ownership rule
- manager/requesting seller visibility
- owner upload flow
- storage abstraction
- out-of-scope production storage provider

**Step 2: Run full verification**

```bash
pnpm db:migrate
pnpm --filter @viewpro/api typecheck
pnpm --filter @viewpro/api test
pnpm --filter @viewpro/api build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Expected: all pass.

**Step 3: Check git state**

```bash
git status --short --branch
```

Expected: only intended Stage 7 files are changed.

**Step 4: Commit checkpoint**

Only if the user explicitly authorizes it:

```bash
git add README.md viewpro-app/README.md docs/plans/2026-05-13-viewpro-implementation-roadmap.md docs/plans/2026-05-15-viewpro-stage-7-documents-design.md docs/plans/2026-05-15-viewpro-stage-7-documents-implementation.md viewpro-app/apps/api/src/documents viewpro-app/apps/api/test/documents.e2e-spec.ts viewpro-app/apps/api/test/owner-documents.e2e-spec.ts
git commit -m "feat(api): expose document request endpoints"
```

### Delivered endpoint list

Internal tenant-scoped endpoints:

- `POST /api/property-engagements/:propertyEngagementId/document-requests`
- `GET /api/document-requests`
- `GET /api/document-requests/:id`
- `POST /api/document-requests/:id/approve`
- `POST /api/document-requests/:id/reject`
- `POST /api/document-versions/:id/read-url`

Owner endpoints:

- `GET /api/owner/document-requests`
- `GET /api/owner/document-requests/:id`
- `POST /api/owner/document-requests/:id/upload-url`
- `POST /api/owner/document-versions/:id/confirm-upload`
- `POST /api/owner/document-versions/:id/read-url`

### Stage 7 acceptance checklist

- [x] Managers can view and review all tenant document requests.
- [x] Requesting sellers can view and review only their own document requests.
- [x] Peer sellers and cross-tenant internal access return `404`.
- [x] Owners list/read/upload only requests addressed to them and backed by active property access.
- [x] Owner endpoints use `AuthGuard` only and do not require `x-tenant-id`.
- [x] Owner upload URL validates request state, MIME allowlist, and 10 MB max size before returning fake signed URL metadata.
- [x] Confirm upload moves the request to `SUBMITTED` and sets the current version.
- [x] Manager/requesting seller/owner read URLs are authorized before signed URL generation.
- [x] Storage remains abstracted through `DocumentStoragePort`; no production storage provider is included in this stage.
- [x] Full verification commands passed.

## Review workload forecast

Estimated total changed lines for all slices: high, likely over 400 lines.

Recommended delivery:
- Keep Stage 7 split into the four slices above.
- Commit each slice separately after explicit user approval.
- Do not squash into one large commit before review.

## Done when

- Schema, repository, storage port, use cases, controllers, e2e tests, and docs exist.
- Managers can oversee all tenant document requests.
- Requesting sellers can manage only their own document requests.
- Peer sellers receive `404`.
- Owners can upload only requested documents addressed to them.
- Signed URLs are never returned before permission checks.
- Full verification passes.
