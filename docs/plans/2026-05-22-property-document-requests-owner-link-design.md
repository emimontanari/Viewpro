# Property Document Requests Owner-Link Design

Property document requests should target the property-owner link (`PropertyAssetOwner`) instead of requiring a registered owner `User`. This keeps the document workflow aligned with the corrected owner assignment model: agencies can link owners by name/email first, request documents immediately, and let the owner activate access later without fake users or duplicated identity.

## Decision

| Area | Decision |
| --- | --- |
| Request target | Store `propertyAssetOwnerId` on `DocumentRequest`. |
| Eligible internal targets | `PropertyAssetOwner.accessStatus` in `INVITED` or `ACTIVE`. `REVOKED` links are not valid targets. |
| Registered owner user | Keep `ownerUserId` nullable/deprecated for compatibility and upload/audit history, but new request creation should not require it. |
| Owner portal access | Owner endpoints remain authenticated. A request is visible/uploadable only when the stored owner link is `ACTIVE` and its `userId` matches the current user. |
| Frontend selector | The property detail selector lists linked owners that are not revoked, including invited owners with `userId: null`. |
| History/audit | Document requests stay tied to the owner link even if the owner later activates access. Do not create fake users. |

## Why this change is needed

The original Stage 7 document model assumed the target owner already existed as a `User`, so `DocumentRequest.ownerUserId` was required. Later, the owner assignment flow was corrected: a property owner can be linked by first name, last name, and email before registration. That creates `PropertyAssetOwner` rows with `accessStatus: INVITED` and `userId: null`.

Keeping document requests tied only to `ownerUserId` would reintroduce the old constraint: owners would need an account before agencies can ask for documents. The better domain model is that a document request belongs to the relationship between a property and its owner.

## Data model

Add a relation from `DocumentRequest` to `PropertyAssetOwner`:

```prisma
model PropertyAssetOwner {
  id               String            @id @default(uuid())
  documentRequests DocumentRequest[]
}

model DocumentRequest {
  propertyAssetOwnerId String?
  ownerUserId          String?

  propertyAssetOwner PropertyAssetOwner? @relation(fields: [propertyAssetOwnerId], references: [id])
  ownerUser           User?              @relation("DocumentRequestOwner", fields: [ownerUserId], references: [id])

  @@index([propertyAssetOwnerId, status])
}
```

Migration strategy:

1. Add `propertyAssetOwnerId` nullable.
2. Make `ownerUserId` nullable.
3. Backfill existing requests by matching `propertyEngagement.propertyAssetId` + `ownerUserId` to `PropertyAssetOwner.userId`.
4. New writes always set `propertyAssetOwnerId`.
5. Keep legacy `ownerUserId` response nullable for older rows/clients.
6. A future cleanup can make `propertyAssetOwnerId` required after data is fully migrated.

## Backend behavior

### Create request

New clients should send `propertyAssetOwnerId`. During the migration period, the backend also accepts legacy `ownerUserId`, resolves it to an eligible owner link for the same property/tenant, and still persists the resolved `propertyAssetOwnerId`.

Validation must confirm:

- the engagement belongs to the current tenant;
- the owner link belongs to the engagement's property asset;
- the owner link is `INVITED` or `ACTIVE`;
- the internal user has `DOCUMENTS_REQUEST` permission.

Persist:

- `propertyAssetOwnerId` always;
- `ownerUserId` only if the owner link already has a user.

### Internal listing/review

Internal visibility remains unchanged:

- managers see tenant requests;
- requesting sellers see only requests they created;
- peer sellers and cross-tenant access get `404`/empty results as before.

### Owner portal

Owner endpoints should query through the stored owner link:

```txt
DocumentRequest.propertyAssetOwner.userId == currentUser.id
DocumentRequest.propertyAssetOwner.accessStatus == ACTIVE
```

Invited owners cannot use owner portal endpoints until registration/activation attaches `userId` to the existing `PropertyAssetOwner` row.

## Frontend behavior

On property detail:

- no owners linked -> disable “Solicitar documento” and show “Vinculá un propietario...”.
- only revoked owners -> disable and show that a non-revoked owner is needed.
- invited or active owners -> enable.
- selector submits `propertyAssetOwnerId` (`owner.id`), not `ownerUserId`.
- request cards resolve owner display by `propertyAssetOwnerId`.

Suggested invited-owner copy:

> El propietario todavía no activó su acceso. La solicitud quedará asociada y podrá verla cuando ingrese.

## Error handling

- Missing both `propertyAssetOwnerId` and legacy `ownerUserId`: `400`.
- Owner link not found, revoked, cross-property, cross-tenant, or legacy `ownerUserId` not linked to that property: `404` to avoid existence leaks.
- Existing permission failures remain `403`.
- Owner portal requests for invited/unlinked users remain `404`.

## Tests

Backend tests should cover:

- manager creates request for an `INVITED` owner with `userId: null`;
- manager creates request for an `ACTIVE` owner and response includes `propertyAssetOwnerId`;
- legacy `ownerUserId` input resolves to the owner link before persistence;
- creation rejects `REVOKED` owner links;
- creation rejects owner links from a different property/tenant;
- owner portal visibility works through the owner link after activation;
- other owners cannot access requests targeted to a different owner link;
- property engagement filtering continues to work.

Frontend/manual checks should cover:

- invited owner appears in the document request select;
- submit payload contains `propertyAssetOwnerId`;
- button is enabled for invited/active and disabled for no eligible owners;
- request list shows the correct owner name by link id.

## Out of scope

- Sending emails or magic links.
- Letting invited owners upload before authentication.
- Replacing the fake document storage adapter.
- Dropping `ownerUserId` entirely in this branch.
