# Stage 20 — Documentación End-to-End Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full document workflow for the product-final-like MVP: internal users request/review documents, owners upload/read them, statuses/version history are visible, and the seeded smoke proves the loop end to end.

**Architecture:** The Nest API already owns most document domain endpoints. `app-new` needs BFF routes, typed clients, owner/internal UI, and smoke coverage. Storage must stop being fake before this stage is considered pilot-ready; use signed local storage for dev/test first, then add the selected production adapter as a required follow-up slice inside Stage 20.

**Tech Stack:** NestJS, Prisma, Next.js App Router BFF routes, TanStack Query, shadcn/ui, Vitest, Playwright seeded smoke.

---

## Scope

### In scope

- Owner document request list filtered by property engagement.
- Owner upload flow: request upload URL → upload file → confirm version.
- Owner read/download flow for readable submitted/approved versions.
- Internal read/review flow: read submitted version, approve, reject with reason.
- BFF routes in `app-new` for owner and internal document actions.
- UI in owner detail and internal property detail.
- Demo seed with pending/submitted/rejected document states.
- Seeded smoke proving the full workflow.
- Signed storage implementation for dev/test and a production storage adapter decision gate.

### Out of scope for this stage

- Document categories beyond existing request metadata.
- Rich multi-version comparison UI.
- Notifications; that is Stage 24.
- Owner invitation/activation; that is Stage 21.
- WhatsApp contact events; that is Stage 23.

## Review split

Stage 20 is too large for one PR. Use these chained slices:

| Slice | PR focus | Review goal |
|---|---|---|
| 20.1 | API owner filtering + signed dev/test storage + seed document states | Make backend document data safe and uploadable. |
| 20.2 | `app-new` BFF routes + typed clients | Expose document operations to the frontend without UI complexity. |
| 20.3 | Owner/internal document UI + seeded smoke | Make the flow usable and tested. |
| 20.4 | Production storage adapter | Replace fake/dev-only storage for pilot readiness. |

Do not mark Stage 20 complete until 20.4 is either implemented or an explicit production deployment decision is documented.

---

## Slice 20.1 — API filtering, signed storage, and seed states

### Task 1: Add failing owner document filter tests

**Files:**

- Modify: `viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts`
- Modify: `viewpro-app/apps/api/test/owner-documents.e2e-spec.ts`

**Step 1: Write RED tests**

Add coverage proving an owner can request document requests for one `propertyEngagementId` and does not receive requests for another owner-visible property or another owner.

Expected behavior:

```ts
expect(response.body.data.every((request) => request.propertyEngagementId === propertyEngagementId)).toBe(true);
```

**Step 2: Run tests and confirm failure**

From `viewpro-app/`:

```bash
pnpm --filter @viewpro/api exec vitest run test/owner-documents.use-cases.spec.ts test/owner-documents.e2e-spec.ts
```

Expected: failure because owner list currently does not filter by `propertyEngagementId`.

### Task 2: Implement owner document request filtering

**Files:**

- Modify: `viewpro-app/apps/api/src/documents/documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`
- Modify: `viewpro-app/apps/api/src/documents/use-cases/list-owner-document-requests.use-case.ts`
- Modify if needed: `viewpro-app/apps/api/src/documents/owner-documents.controller.ts`

**Step 1: Extend input types**

Add optional `propertyEngagementId?: string` to the owner document list input and repository contract.

**Step 2: Pass query param through the use case**

Make `ListOwnerDocumentRequestsUseCase` pass the optional filter to the repository.

**Step 3: Preserve owner access constraints**

In Prisma, keep the existing owner ownership join/where condition and add `propertyEngagementId` only as an additional filter.

**Step 4: Run tests**

```bash
pnpm --filter @viewpro/api exec vitest run test/owner-documents.use-cases.spec.ts test/owner-documents.e2e-spec.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add viewpro-app/apps/api/src/documents viewpro-app/apps/api/test/owner-documents.use-cases.spec.ts viewpro-app/apps/api/test/owner-documents.e2e-spec.ts
git commit -m "fix(api): filter owner document requests by property"
```

### Task 3: Add signed local document storage for dev/test

**Files:**

- Create: `viewpro-app/apps/api/src/documents/storage/local-document-storage.adapter.ts`
- Create: `viewpro-app/apps/api/src/documents/storage/local-document-storage.controller.ts`
- Modify: `viewpro-app/apps/api/src/documents/storage/document-storage.port.ts`
- Modify: `viewpro-app/apps/api/src/documents/storage/fake-document-storage.adapter.ts`
- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Modify if needed: `viewpro-app/apps/api/src/bootstrap/create-app.ts`

**Step 1: Write storage tests first**

Create `viewpro-app/apps/api/test/documents.local-storage.spec.ts` with cases for:

- signed upload URL rejects invalid/expired token;
- signed upload URL stores bytes;
- signed read URL returns uploaded bytes;
- read URL rejects invalid/expired token.

**Step 2: Implement minimal signed local adapter**

Requirements:

- upload endpoint: `PUT /api/document-storage/upload/:token`;
- read endpoint: `GET /api/document-storage/read/:token`;
- store files under an environment-configured local uploads root;
- token includes operation, document version/storage key, expiry, MIME/size metadata where needed;
- no public static `/uploads` URL for documents.

**Step 3: Keep fake adapter compatible**

The fake adapter can remain for legacy unit tests, but app/dev/test document smoke should use signed local storage where configured.

**Step 4: Run focused storage tests**

```bash
pnpm --filter @viewpro/api exec vitest run test/documents.local-storage.spec.ts test/documents.storage.spec.ts
```

Expected: pass.

**Step 5: Commit**

```bash
git add viewpro-app/apps/api/src/documents/storage viewpro-app/apps/api/src/documents/documents.module.ts viewpro-app/apps/api/test/documents.local-storage.spec.ts viewpro-app/apps/api/test/documents.storage.spec.ts
git commit -m "feat(api): add signed local document storage"
```

### Task 4: Seed realistic document states

**Files:**

- Modify: `viewpro-app/apps/api/scripts/seed-demo.mjs`

**Step 1: Update seed data**

Ensure demo data includes:

- at least one `PENDING` request visible to the owner;
- at least one `SUBMITTED` request with a current document version;
- at least one `REJECTED` request with rejection reason;
- fixture files for submitted/rejected versions if local storage is enabled.

**Step 2: Run seed**

```bash
pnpm --filter @viewpro/api demo:seed
```

Expected: seed completes and logs document counts.

**Step 3: Run API document tests**

```bash
pnpm --filter @viewpro/api exec vitest run test/documents.e2e-spec.ts test/owner-documents.e2e-spec.ts
```

Expected: pass.

**Step 4: Commit**

```bash
git add viewpro-app/apps/api/scripts/seed-demo.mjs
git commit -m "test(api): seed document review states"
```

---

## Slice 20.2 — BFF routes and typed clients

### Task 5: Add owner document BFF routes

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-requests/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-requests/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-requests/[id]/upload-url/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-requests/[id]/upload-url/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-versions/[id]/confirm-upload/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-versions/[id]/confirm-upload/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-versions/[id]/read-url/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/owner/document-versions/[id]/read-url/route.test.ts`

**Step 1: Write BFF route tests**

Use existing `app-new` BFF tests as the pattern. Prove:

- query forwarding for `propertyEngagementId`;
- body forwarding for upload-url and confirm-upload;
- cookie forwarding through `bffFetch`;
- API error passthrough.

**Step 2: Implement routes**

Proxy to existing Nest endpoints:

- `GET /owner/document-requests`;
- `POST /owner/document-requests/:id/upload-url`;
- `POST /owner/document-versions/:id/confirm-upload`;
- `POST /owner/document-versions/:id/read-url`.

**Step 3: Run tests**

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/app/api/owner/document-requests src/app/api/owner/document-versions
```

Expected: pass.

### Task 6: Add internal review BFF routes

**Files:**

- Create: `viewpro-app/apps/app-new/src/app/api/document-requests/[id]/approve/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/document-requests/[id]/approve/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/document-requests/[id]/reject/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/document-requests/[id]/reject/route.test.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/document-versions/[id]/read-url/route.ts`
- Create: `viewpro-app/apps/app-new/src/app/api/document-versions/[id]/read-url/route.test.ts`

**Step 1: Write BFF route tests**

Prove approve/reject/read-url routes forward to internal Nest document endpoints and preserve tenant context.

**Step 2: Implement routes**

Proxy to existing internal document endpoints for approve, reject, and read URL.

**Step 3: Run tests**

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/app/api/document-requests src/app/api/document-versions
```

Expected: pass.

### Task 7: Extend owner API client

**Files:**

- Modify: `viewpro-app/apps/app-new/src/features/owner/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/owner/api/queries.ts`

**Step 1: Add types**

Add owner document request/version types matching the API response fields used by the UI.

**Step 2: Add service functions**

Expose:

- list owner document requests;
- create upload URL;
- upload bytes to signed URL;
- confirm upload;
- create read URL.

**Step 3: Add query/mutation helpers**

Add query keys scoped by `propertyEngagementId`.

**Step 4: Run typecheck**

```bash
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
```

Expected: pass.

### Task 8: Extend internal product API client

**Files:**

- Modify: `viewpro-app/apps/app-new/src/features/products/api/types.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/service.ts`
- Modify: `viewpro-app/apps/app-new/src/features/products/api/queries.ts`

**Step 1: Add types and service functions**

Expose:

- internal document read URL;
- approve request;
- reject request with required reason.

**Step 2: Invalidate existing document request query keys after mutations**

Keep existing list/create behavior working.

**Step 3: Run focused app tests/typecheck**

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/app/api/owner/document-requests src/app/api/owner/document-versions src/app/api/document-requests src/app/api/document-versions
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
```

Expected: pass.

**Step 4: Commit Slice 20.2**

```bash
git add viewpro-app/apps/app-new/src/app/api viewpro-app/apps/app-new/src/features/owner/api viewpro-app/apps/app-new/src/features/products/api
git commit -m "feat(app-new): add document workflow bff clients"
```

---

## Slice 20.3 — Owner/internal UI and seeded smoke

### Task 9: Create owner document requests component

**Files:**

- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.tsx`
- Create: `viewpro-app/apps/app-new/src/features/owner/components/owner-document-requests.test.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.tsx`
- Modify: `viewpro-app/apps/app-new/src/features/owner/components/owner-property-detail.test.tsx`

**Step 1: Write component tests**

Cover:

- empty state;
- pending request with upload CTA;
- submitted/approved request with read CTA;
- rejected request with rejection reason and re-upload CTA;
- no internal approve/reject controls in owner UI.

**Step 2: Implement component with existing shadcn/app components**

Use current app design primitives. Do not create a new visual system.

**Step 3: Add `Documentos` tab to owner detail**

Keep existing `Resumen` and `Seguimiento` behavior intact.

**Step 4: Run tests**

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/owner/components/owner-document-requests.test.tsx src/features/owner/components/owner-property-detail.test.tsx
```

Expected: pass.

### Task 10: Add internal document review actions

**Files:**

- Modify: `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/property-document-requests.test.tsx`
- Create: `viewpro-app/apps/app-new/src/features/products/components/reject-document-request-dialog.tsx`

**Step 1: Write tests**

Cover:

- submitted request shows read/approve/reject;
- approve calls mutation and refreshes list;
- reject requires non-empty reason;
- pending requests do not show review actions;
- archived property still blocks creating new requests as before.

**Step 2: Implement read/approve/reject actions**

Use existing button/dialog patterns. Opening a read URL can use a guarded `window.open` or anchor after fetching the signed read URL.

**Step 3: Run tests**

```bash
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/features/products/components/property-document-requests.test.tsx
```

Expected: pass.

### Task 11: Update seeded smoke

**Files:**

- Modify: `viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts`

**Step 1: Add owner document flow**

Owner smoke path:

1. login as `propietario.demo@viewpro.local`;
2. open `/owner`;
3. open first property detail;
4. select `Documentos`;
5. find pending request;
6. upload a tiny fixture PDF;
7. assert request becomes submitted/current-file visible.

**Step 2: Add internal review flow**

Internal smoke path:

1. login as manager demo;
2. open property detail;
3. find submitted document request;
4. fetch/read signed URL;
5. approve or reject one seeded submitted request;
6. assert status changes.

**Step 3: Run seeded smoke**

```bash
VIEWPRO_APP_NEW_SEEDED_E2E_API_PORT=3311 VIEWPRO_APP_NEW_SEEDED_E2E_WEB_PORT=3310 pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Expected: all seeded smoke tests pass.

### Task 12: Final validation for Slice 20.3

From `viewpro-app/`:

```bash
pnpm --filter @viewpro/api exec vitest run test/owner-documents.use-cases.spec.ts test/documents.use-cases.spec.ts test/documents.repository.spec.ts test/documents.storage.spec.ts test/documents.local-storage.spec.ts
pnpm --filter @viewpro/api exec vitest run test/owner-documents.e2e-spec.ts test/documents.e2e-spec.ts
pnpm --filter next-shadcn-dashboard-starter exec vitest run src/app/api/owner/document-requests src/app/api/owner/document-versions src/app/api/document-requests src/app/api/document-versions src/features/owner/components/owner-document-requests.test.tsx src/features/owner/components/owner-property-detail.test.tsx src/features/products/components/property-document-requests.test.tsx
pnpm --filter next-shadcn-dashboard-starter exec tsc --noEmit --pretty false
pnpm --filter next-shadcn-dashboard-starter test:seeded
```

Expected: all pass.

**Step 2: Commit Slice 20.3**

```bash
git add viewpro-app/apps/app-new/src/features/owner/components viewpro-app/apps/app-new/src/features/products/components viewpro-app/apps/app-new/tests/seeded/demo-smoke.spec.ts
git commit -m "feat(app-new): add document upload and review ui"
```

---

## Slice 20.4 — Production storage adapter

### Task 13: Choose production storage provider

Before implementation, confirm one provider:

| Provider | Use when |
|---|---|
| S3-compatible/R2 | Preferred for simple production object storage. |
| MinIO | Preferred for self-hosted/local infra. |
| Local persistent disk | Only acceptable for controlled single-server pilot with backup policy. |

### Task 14: Implement provider behind existing storage port

**Files:**

- Create provider-specific adapter under `viewpro-app/apps/api/src/documents/storage/`
- Modify: `viewpro-app/apps/api/src/documents/documents.module.ts`
- Modify env docs if present.
- Add provider tests with mocked SDK or contract-level tests.

Acceptance:

- signed upload/read URLs are time-limited;
- MIME and max-size constraints are enforced;
- no document is publicly readable without a signed URL;
- seeded/pilot environment can use the provider via env config.

---

## Required final review gate

Before pushing any implementation PR:

1. run focused tests for the slice;
2. run `git diff --check`;
3. run a fresh reviewer subagent;
4. inspect reviewer output;
5. only then commit/push/open PR.

## Definition of done for Stage 20

- [ ] Owner can see document requests for a property.
- [ ] Owner can upload/re-upload requested documents.
- [ ] Owner can read submitted/approved versions where allowed.
- [ ] Internal users can read submitted documents.
- [ ] Internal users can approve/reject with a reason.
- [ ] Status/rejection/version metadata is visible in UI.
- [ ] Document requests remain tenant/owner isolated.
- [ ] Seeded smoke covers the full document loop.
- [ ] Production storage decision is implemented or explicitly approved as deferred.
