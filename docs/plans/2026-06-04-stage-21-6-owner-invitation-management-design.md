# Stage 21.6 Owner Invitation Management Design

## Stage contract

```txt
Stage: 21
Slice: 21.6 — Minimal owner invitation management
Objective: give managers a clear way to regenerate/resend-copy and revoke pending owner invite links.
Evidence needed: API/UI tests for regenerate and revoke; accepted/expired/revoked states remain safe.
Do not touch: email delivery automation or advanced invitation analytics.
Done: manager can regenerate/copy a fresh pending link and revoke a pending link without DB/support help.
Next slice: 25.1 — Admin tenant status write API + audit log.
```

## Problem

Managers can currently generate/copy an owner invitation link, and regenerating implicitly revokes older pending links. They do not have an explicit visible way to revoke a pending owner invitation without creating a replacement link or touching the database.

## Existing behavior

- Backend generate endpoint:
  - `POST /api/property-engagements/:id/owners/:ownerId/invitation-link`
- Existing regeneration behavior:
  - only works for owners in `INVITED` state;
  - revokes previous pending invitations;
  - creates a fresh `OwnerInvitation` and returns a public URL.
- Frontend owner card currently exposes a single invited-owner action: copy/generate invitation link.
- Team invitations already provide a useful UI/BFF analogy for resend and revoke.

## Chosen approach

Keep owner invitation management minimal and explicit:

1. Rename/reframe the current copy action as **Regenerar y copiar link**.
2. Add a dedicated revoke endpoint and UI action: **Revocar invitación**.
3. Keep the owner link row as `INVITED` after revoke, so the manager can later regenerate a fresh link.

This avoids email delivery, invitation analytics, and a new invitation-management screen while closing the operational support gap.

## Backend design

Add a revoke endpoint beside the existing generator:

```txt
POST /api/property-engagements/:id/owners/:ownerId/invitation-link/revoke
```

It should use the same guard stack and permission as generation:

- `AuthGuard`
- `TenantMembershipGuard`
- `PermissionGuard`
- permission equivalent to existing owner-link management (`ENGAGEMENTS_CREATE` in current flow)

The use case/repository must:

1. load the property engagement visible to the current user and tenant;
2. verify the owner row belongs to the engagement property asset;
3. reject active/accepted owners because there is no pending invite to revoke;
4. revoke pending, not-expired invitations for that owner;
5. return a safe response without raw token or URL.

Proposed response:

```ts
type OwnerInvitationRevokeResponse = {
  propertyAssetOwnerId: string;
  revokedInvitationIds: string[];
  revokedCount: number;
};
```

`revokedInvitationIds` are internal IDs only, not tokens. If no pending usable invitation exists for an invited owner, return a clear no-op or conflict depending on existing API style; prefer conflict if tests show the UI should surface that no active link existed.

## Frontend design

For `PropertyOwnerCard` when `accessStatus === 'INVITED'`:

- show **Regenerar y copiar link**;
- show **Revocar invitación**;
- when regenerate succeeds, copy the returned URL and show existing manual fallback if clipboard fails;
- when revoke is clicked, require a simple confirmation before calling the API;
- after revoke succeeds, show a toast/status message: `Invitación revocada. Podés regenerar un link nuevo cuando quieras.`

Keep the component local; do not create a full owner invitation management page.

## Testing design

### API

Add tests in `viewpro-app/apps/api/test/property-engagements.e2e-spec.ts`:

- revokes a pending owner invitation;
- revoked token returns `410` via `/api/owner-invitations/:token`;
- rejects active/accepted owner revoke;
- rejects unrelated owner/property/tenant revoke;
- regenerate after revoke returns a fresh valid link.

### App/BFF/UI

Add or extend tests:

- BFF route: `apps/app-new/src/app/api/products/[id]/owners/[ownerId]/invitation-link/revoke/route.test.ts`.
- API service: owner invitation revoke client method.
- `property-owner-card.test.tsx`: renders regenerate and revoke actions for invited owners; does not render revoke for active owners.
- `property-owner-section.test.tsx`: revoke action calls service/BFF and shows success/error state.

### Seeded E2E

Not required for this slice unless the current seeded owner invitation card can exercise revoke without destabilizing later owner acceptance smoke. API/UI evidence is sufficient for Stage 21.6 because the user-facing card behavior is component-tested and the backend public token revocation is proven.

## Completion status

Completed in `feat/owner-invitation-management`:

- backend `POST /api/property-engagements/:id/owners/:ownerId/invitation-link/revoke` revokes only pending, not-expired invitations and returns no raw token/url;
- app-new BFF/service exposes `/api/products/:id/owners/:ownerId/invitation-link/revoke`;
- property owner card shows `Regenerar y copiar link` and `Revocar invitación` for invited owners only;
- revoke success/error feedback is visible and owner rows remain available for later regeneration.

## Non-goals

- Email delivery automation.
- Advanced invitation analytics.
- Full invitation list page.
- Owner account settings.
- Billing/admin changes.
- Changing owner onboarding acceptance from Stage 21.5.

## Risks

- Revoke must never expose raw token or invitation URL.
- Revoke must not deactivate an already active owner.
- Expired invitations are derived by `expiresAt`, not a DB status.
- UI may not currently know whether an invited owner has an active pending link; copy/regenerate remains the way to create a new usable link after revoke.
