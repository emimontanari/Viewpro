# Stage 21.4 Owner Invitation Manual Delivery Design

This slice lets tenant users generate and copy a one-time owner invitation link for manual delivery. It bridges the gap between backend token acceptance and future real email delivery.

## Decision

Build **manual invitation link generation with automatic rotation**.

| Area | Decision |
|------|----------|
| Trigger | Tenant user clicks `Copiar invitación` on an `INVITED` owner. |
| Token behavior | Always generate a fresh raw token and revoke older pending invitations for that owner link. |
| Storage | Store only `tokenHash`; never store the raw token or invitation URL. |
| Delivery | Return `invitationUrl` once, then copy it to the clipboard in app-new. |
| UI | Reuse existing property owner card, buttons, badges, and toast patterns. |
| Email | Out of scope; this is manual delivery only. |

## User flow

1. Tenant user opens a property detail in app-new.
2. The property has a linked owner with `accessStatus = INVITED`.
3. The user clicks `Copiar invitación`.
4. The API revokes older pending invitations for that owner link.
5. The API creates a new invitation token, stores only the hash, and returns a full app URL.
6. app-new copies the URL to the clipboard.
7. The user manually sends the link by WhatsApp, email, or another channel.
8. The owner opens `/owner-invitations/[token]` and completes the Stage 21.3 acceptance UI.

Toast copy:

```txt
Link de invitación copiado. Los links anteriores ya no funcionan.
```

If clipboard copy fails, show a temporary fallback that lets the user manually copy the returned URL. Do not persist it in the property response or owner card data.

## Backend API

Add an authenticated tenant-scoped endpoint under property engagement ownership:

```txt
POST /api/property-engagements/:engagementId/owners/:ownerId/invitation-link
```

Response:

```ts
{
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
}
```

Rules:

- user must be authenticated;
- request must include a valid tenant context;
- user must have the same owner-management permission used to link owners today;
- engagement must belong to the tenant and be visible to the user;
- `ownerId` must belong to the engagement's property asset;
- owner link must have `accessStatus = INVITED`;
- `ACTIVE` owners cannot receive a new manual invitation link;
- previous pending invitations for that owner link are revoked before creating the new one;
- response must not include `tokenHash`.

## URL configuration

Add explicit API configuration:

```txt
APP_PUBLIC_URL=http://localhost:3000
```

Use it to build:

```txt
${APP_PUBLIC_URL}/owner-invitations/${encodeURIComponent(token)}
```

Do not derive this from `API_PUBLIC_URL`. API public origin and app public origin are different concerns.

## Backend ownership

The endpoint belongs in `property-engagements`, not public `owner-invitations`, because the actor is an authenticated tenant user managing a property owner link.

Expected additions:

- `CreateOwnerInvitationLinkUseCase` for authorization and orchestration;
- repository method to rotate pending invitations transactionally;
- response mapper/type for the manual link response;
- app URL config/env validation;
- e2e coverage in `property-engagements.e2e-spec.ts`.

The public `owner-invitations` module remains responsible for validating and accepting raw tokens.

## Frontend API and BFF

Add an app-new BFF route:

```txt
POST /api/products/:id/owners/:ownerId/invitation-link
```

It proxies to:

```txt
POST /api/property-engagements/:id/owners/:ownerId/invitation-link
```

Add product API types and a service function returning the manual invitation link response.

## Frontend UI

Update `PropertyOwnerCard` so each `INVITED` owner has a `Copiar invitación` action.

Behavior:

1. disable the button while generating/copying;
2. call the product service;
3. copy `invitationUrl` with `navigator.clipboard.writeText`;
4. show success toast;
5. if clipboard fails, show a temporary copy fallback with the returned link;
6. show an error toast if the API fails.

Reuse existing components only:

- current owner card layout;
- existing `Button`, `Badge`, `Avatar`, and `toast` patterns;
- no new shared UI primitives;
- no global CSS;
- no card redesign.

## Security

- Raw token is returned only once, in direct response to the authenticated generation request.
- Raw token is never stored in the database.
- Raw token is not included in property detail/list responses.
- Raw token is not logged.
- Token is in the path, not query params.
- Rotating invalidates older pending links.
- Cross-tenant and unrelated owner links must not leak existence.
- Response must not expose `tokenHash`.

## Testing plan

Backend tests should cover:

- invited owner link generates `invitationUrl`;
- response omits `tokenHash`;
- generated URL validates through the existing public invitation validation endpoint;
- older pending invitations for the same owner link are revoked;
- active owner link returns conflict;
- owner link from another property/tenant is denied;
- missing or insufficient tenant permission is denied.

Frontend tests should cover:

- `Copiar invitación` appears only for `INVITED` owners;
- clicking calls the service;
- successful response copies the URL and shows success toast;
- API failure shows error toast;
- clipboard failure shows temporary manual-copy fallback;
- no action appears for `ACTIVE` owners.

## Out of scope

- Real email delivery.
- Email templates.
- Invitation delivery history.
- Full resend/revoke management UI.
- Existing-user invitation acceptance.
- Owner revocation workflow.
- Redesigning the property owner card.

## Next step

Write the implementation plan, then implement this as the next Stage 21 review slice targeting `develop`.
