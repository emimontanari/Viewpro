# ViewPro Stage 7 Documents Design

Stage 7 adds a secure document workflow between the real estate agency and the property owner. The backend stores document metadata in Postgres, keeps file bytes outside the database, and controls access through signed URLs generated only after permission checks.

## Outcome

ViewPro will let an agent or manager request documents from an owner, let the owner upload requested files, and let the requesting agent or managers approve or reject each submission.

This stage is backend-first. It does not implement UI, public links, OCR, antivirus scanning, document previews, notifications, or a production storage provider integration.

## Core decision

Use an S3-compatible storage abstraction instead of coupling the MVP to a provider now.

| Area | Decision |
|------|----------|
| Metadata | Store requests, logical documents, and versions in Postgres with Prisma. |
| File bytes | Store outside Postgres using a future S3-compatible provider. |
| Storage boundary | Use `DocumentStoragePort` so use cases do not depend on AWS S3, Cloudflare R2, Supabase Storage, or MinIO directly. |
| First implementation | Use a fake/local storage adapter in tests and initial backend slices. |
| Access | Backend validates permissions before returning signed upload/read URLs. |

## Why not store files in Postgres?

Documents can be large and sensitive. Postgres should track facts about the document, not carry PDF/image bytes. Keeping files in object storage gives us temporary URLs, better scalability, and clearer security boundaries.

## Agency workflow example

In a small agency, three sellers may all have general access to the same 100 properties. The document workflow should not assume properties are split 33/34/33 by assigned seller.

For documents, the important relationship is narrower:

```txt
requesting seller
→ target owner
→ specific document request
```

So a seller can request documentation for a tenant property, but that request is then managed only by the seller who created it and by tenant managers.

## Functional flow

1. Internal user creates a document request for a property engagement and owner.
2. Owner sees pending requests addressed to them.
3. Owner asks for a signed upload URL for a requested document.
4. Backend validates access, MIME type, file size, and request state.
5. Backend creates a pending document version and returns a short-lived upload URL.
6. Owner uploads the file to storage.
7. Owner confirms the upload.
8. Request becomes submitted.
9. Requesting seller or manager approves or rejects the version.
10. If rejected, the owner can upload a new version.

## Permissions

### Internal users

| User | Can create request | Can view request | Can approve/reject | Notes |
|------|--------------------|------------------|--------------------|-------|
| Manager/gerente | Yes | All tenant requests | All tenant requests | Tenant-level oversight. |
| Requesting seller/agent | Yes | Only requests they created | Only requests they created | Request ownership is `requestedByUserId`. |
| Other seller/agent | Yes for their own new requests | No for requests created by peers | No | Return `404` to avoid leaking existence. |

Internal endpoints use `AuthGuard`, `TenantMembershipGuard`, and permission checks. Cross-tenant or unauthorized access returns `404`.

### Owners

| User | Can view request | Can upload | Can approve/reject |
|------|------------------|------------|--------------------|
| Target owner | Yes | Yes, while request allows upload | No |
| Other owner | No | No | No |

Owner endpoints use `AuthGuard` only. They do not require `x-tenant-id`. The owner must match `ownerUserId` and should also have active property access through `PropertyAssetOwner` for the related property.

## Data model

### Enums

```prisma
enum DocumentRequestStatus {
  PENDING
  SUBMITTED
  APPROVED
  REJECTED
  CANCELLED
}

enum DocumentVersionStatus {
  PENDING_UPLOAD
  UPLOADED
  APPROVED
  REJECTED
}
```

### `DocumentRequest`

Represents the concrete request from an internal user to an owner.

Key fields:

- `tenantId`
- `propertyEngagementId`
- `ownerUserId`
- `requestedByUserId`
- `title`
- `description`
- `status`
- `reviewedByUserId`
- `reviewedAt`
- `rejectionReason`
- timestamps

### `Document`

Represents the logical document attached to a request.

Key fields:

- `documentRequestId`
- `currentVersionId`
- timestamps

This extra model keeps the request, logical document, and file versions separate. It avoids overloading `DocumentRequest` once version history grows.

### `DocumentVersion`

Represents one uploaded file attempt.

Key fields:

- `documentId`
- `uploadedByUserId`
- `storageKey`
- `originalFilename`
- `mimeType`
- `sizeBytes`
- `checksum`
- `status`
- timestamps

Rules:

- A request can have multiple versions after rejection and re-upload.
- One version is current through `Document.currentVersionId`.
- File bytes are never stored in Postgres.

## Storage contract

```ts
export interface DocumentStoragePort {
  createUploadUrl(input: CreateDocumentUploadUrlInput): Promise<SignedStorageUrl>
  createReadUrl(input: CreateDocumentReadUrlInput): Promise<SignedStorageUrl>
}
```

The first implementation should use a fake adapter for tests. A later slice can add an S3/R2 adapter without changing use-case contracts.

## File limits

| Limit | Value |
|-------|-------|
| Allowed MIME types | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| Max size | 10 MB |
| Upload URL TTL | 10 minutes |
| Read URL TTL | 5 minutes |

## Delivered endpoints

### Internal agency endpoints

- `POST /api/property-engagements/:propertyEngagementId/document-requests`
- `GET /api/document-requests`
- `GET /api/document-requests/:id`
- `POST /api/document-requests/:id/approve`
- `POST /api/document-requests/:id/reject`
- `POST /api/document-versions/:id/read-url`

### Owner endpoints

- `GET /api/owner/document-requests`
- `GET /api/owner/document-requests/:id`
- `POST /api/owner/document-requests/:id/upload-url`
- `POST /api/owner/document-versions/:id/confirm-upload`
- `POST /api/owner/document-versions/:id/read-url`

## Delivered controller behavior

- Internal endpoints use `AuthGuard`, `TenantMembershipGuard`, `PermissionGuard`, and `x-tenant-id`.
- Owner endpoints use `AuthGuard` only and do not require `x-tenant-id`.
- Request ownership is explicit: tenant managers can view/review all tenant requests; sellers can view/review only requests where `requestedByUserId` is their user ID.
- Peer seller, cross-tenant, inaccessible, revoked, or missing resources return `404` to avoid leaking existence.
- Owner upload URL creation validates active owner access, request state, allowlisted MIME type, and file size up to 10 MB before creating a `PENDING_UPLOAD` version.
- Upload confirmation marks the version `UPLOADED`, sets it as the current document version, and moves the request to `SUBMITTED`.
- Read URLs are returned only after backend authorization checks for the manager/requesting seller or the owning owner.
- The stage still uses the fake `DocumentStoragePort` adapter. Production S3/R2/MinIO storage remains out of scope.

## Implementation slices

### Slice 1 — Base documental

- Prisma enums/models/migration.
- `documents` module skeleton.
- Repository contracts and Prisma implementation.
- `DocumentStoragePort` with fake adapter for tests.
- Repository tests.

### Slice 2 — Internal use cases

- Create document request.
- List internal requests.
- Get internal request detail.
- Approve/reject request.
- Enforce requesting seller + manager visibility.

### Slice 3 — Owner use cases and upload lifecycle

- Owner lists requests.
- Owner requests upload URL.
- Owner confirms upload.
- Owner requests read URL.
- Validate MIME type, size, ownership, and request state.

### Slice 4 — Controllers, e2e, docs, verification

- Internal endpoints. ✅
- Owner endpoints. ✅
- E2E coverage for permission boundaries. ✅
- README/roadmap updates. ✅
- Full verification. ✅

## Acceptance checklist

- [x] Managers can view and review all tenant document requests.
- [x] Requesting sellers can view and review only their own document requests.
- [x] Other sellers in the same tenant receive `404` for peer requests.
- [x] Owners can view and upload only requests addressed to them.
- [x] Owner endpoints do not require `x-tenant-id`.
- [x] Rejection requires a reason.
- [x] Rejected requests allow a new document version.
- [x] Signed URLs are created only after backend permission checks.
- [x] Files are represented by storage keys and metadata, not Postgres blobs.
- [x] Full verification passes.

## Out of scope

- UI.
- Production S3/R2 adapter.
- Antivirus scanning.
- OCR.
- Document previews.
- Public share links.
- Notifications.
- Analytics events.
- Multi-step approval workflows.
