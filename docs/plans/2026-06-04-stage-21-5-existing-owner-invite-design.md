# Stage 21.5 Existing Owner Invitation Acceptance Design

## Stage contract

```txt
Stage: 21
Slice: 21.5 — Existing owner accepts another agency/property
Objective: let a global owner account accept a new property/agency invitation without conflict or duplicate user creation.
Evidence needed: API tests, UI tests, and seeded acceptance proof for an already-registered owner email.
Do not touch: email delivery, billing, full owner account settings.
Done: existing owner accepts an invite, gains access to the new property/agency, and no longer receives a registered-email conflict.
Next slice: 21.6 — Minimal owner invitation management.
```

## Problem

The public owner invitation flow currently works for new owners only. If the invitation email already belongs to a `User`, the API returns `409 Owner email is already registered`. That blocks a real MVP scenario: one owner account can hold properties across multiple agencies.

## Existing behavior

- `GET /api/owner-invitations/:token` returns safe invitation metadata.
- `POST /api/owner-invitations/:token/accept` accepts by creating a new `User`.
- `PropertyAssetOwner` already supports linking one existing `User` to multiple properties.
- `OwnerInvitation` already tracks pending/accepted/revoked/expired states.
- Team invitations already implement the needed `register | login | current-session` pattern.

## Chosen approach

Reuse the team invitation acceptance model for owners:

- `register`: preserve the current new-owner flow.
- `login`: existing owner enters their current password, accepts the invitation, and receives auth cookies.
- `current-session`: logged-in owner with a matching email accepts directly.

This keeps the public flow functional without adding email delivery, account settings, or owner-management UX beyond this slice.

## Backend design

### Validate invitation

Extend the safe validation response with:

```ts
emailRegistered: boolean
```

This tells the frontend which form to show without exposing sensitive data beyond the invited email already shown in the invitation.

### Accept invitation

Extend the accept DTO with a `mode` discriminator:

```ts
type AcceptOwnerInvitationInput =
  | { mode: 'register'; firstName: string; lastName?: string; password: string }
  | { mode: 'login'; password: string }
  | { mode: 'current-session' }
```

The use case must enforce:

- `register`: only works when no user exists for the invitation email.
- `login`: finds the user by invitation email and verifies the password.
- `current-session`: requires an authenticated user whose email matches the invitation email.
- mismatched sessions/users never activate the invitation.

### Repository behavior

Add an existing-owner acceptance path that, inside one transaction:

1. finds the invitation by token hash;
2. checks pending/not expired/not revoked;
3. verifies the linked `PropertyAssetOwner` belongs to the invited email;
4. links `PropertyAssetOwner.userId` to the existing user;
5. sets `PropertyAssetOwner.accessStatus = ACTIVE`;
6. marks `OwnerInvitation.status = ACCEPTED` and sets `acceptedAt`.

Race safety should use preconditioned updates where practical so double acceptance still returns the existing accepted-token error path.

## Frontend design

`OwnerInvitationAcceptanceView` should render one of three states:

1. **New owner** (`emailRegistered = false`): current create-account form.
2. **Existing owner, no matching session**: password form for the invited email.
3. **Existing owner, matching session**: single accept button.
4. **Existing owner, different session**: clear message to switch accounts; no accept call.

The acceptance API client should support the same `mode` union used by the backend.

## Testing design

### API

Add RED tests in `apps/api/test/owner-invitations.e2e-spec.ts`:

- existing owner accepts an invitation and no duplicate user is created;
- accepted existing owner can list the newly linked property in `/api/owner/properties`;
- wrong existing-owner password returns unauthorized and leaves invitation pending;
- authenticated different-email user cannot accept via current session.

### UI

Add tests in `apps/app-new/src/features/owner-invitations/components/owner-invitation-acceptance-view.test.tsx`:

- registered email shows password acceptance instead of create-account fields;
- password submit calls `acceptOwnerInvitation` with `{ mode: 'login', password }`;
- matching current session shows direct accept button;
- different current session shows switch-account guidance.

### Seeded E2E

Extend the demo seed with a deterministic invitation token for `propietario.demo@viewpro.local` on a second property. Add a seeded smoke that opens `/owner-invitations/seeded-existing-owner-invitation-token`, accepts with the existing owner password, lands in `/owner`, and verifies the owner can now see both the original and newly linked properties.

## Non-goals

- Email delivery automation.
- Billing.
- Full owner account settings.
- Owner invitation revoke/regenerate UX; that is Stage 21.6.
- Rebuilding the owner portal.
- Realtime notifications.

## Risks

- Accepting with a session from the wrong email would be a security bug.
- A duplicate property/user owner link can violate `@@unique([propertyAssetId, userId])`; handle existing same-user links safely.
- The API must not leak token hashes or internal storage details.
- The register path must remain backward-compatible for new owners.
