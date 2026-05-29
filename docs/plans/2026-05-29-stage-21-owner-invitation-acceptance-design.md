# Stage 21.2 Owner Invitation Acceptance Design

This slice adds the backend acceptance path for owner invitations. It lets an unregistered invited owner validate a raw invitation token, create owner credentials, and activate the existing `PropertyAssetOwner` link without creating a tenant membership.

## Decision

Build **backend acceptance only** in this PR.

| Area | Decision |
|------|----------|
| Scope | API endpoints, use cases, repository logic, and tests only. |
| UI | Out of scope; a public app-new acceptance page can follow. |
| Email | Out of scope; no email provider exists yet. |
| Existing users | Out of scope for this slice; return a clear conflict if the invitation email already belongs to a user. |
| Token storage | Keep storing only `tokenHash`; never persist raw tokens. |

## User flow

1. Tenant staff links an unregistered owner email to a property.
2. Stage 21.1 creates a pending `OwnerInvitation` row with only a token hash.
3. The invited owner opens a future invitation URL containing the raw token.
4. The API validates the raw token by hashing it and finding a pending, unexpired invitation.
5. The owner submits first name, optional last name, and password.
6. The API creates an owner-only `User`, activates the `PropertyAssetOwner` link, marks the invitation accepted, creates a session, and sets auth cookies.
7. The owner can access `/owner` because portal access comes from the active property-owner link.

## API design

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/owner-invitations/:token` | Public | Validate token and return safe invitation metadata. |
| `POST /api/owner-invitations/:token/accept` | Public | Create owner credentials and activate the link. |

Validation response should expose only safe metadata:

- invitation email;
- owner first/last name snapshot;
- property title/address if useful for confirmation;
- expiration timestamp.

Acceptance DTO:

- `firstName`: required, trimmed;
- `lastName`: optional or nullable, trimmed;
- `password`: required, same minimum rules as existing auth.

## Backend components

| Component | Responsibility |
|-----------|----------------|
| `OwnerInvitationsModule` | Wires controller, use cases, and repository dependencies. |
| `OwnerInvitationsController` | Public validate/accept endpoints. |
| `ValidateOwnerInvitationUseCase` | Hashes raw token and returns safe metadata for pending, unexpired invitations. |
| `AcceptOwnerInvitationUseCase` | Creates user/session and activates owner link transactionally. |
| Repository methods | Find invitation by token hash and accept it with race-safe updates. |
| Existing `TokenService` | Reuse cookie/session creation pattern from login/register. |

## Data and transaction rules

Acceptance must run in one transaction:

1. Hash raw token with `hashOwnerInvitationToken(token)`.
2. Find invitation where:
   - `tokenHash` matches;
   - `status = PENDING`;
   - `revokedAt IS NULL`;
   - `expiresAt > now`.
3. Check no `User` already exists with the invitation email.
4. Create user with `globalRole=USER`, active status, and hashed password.
5. Update `PropertyAssetOwner`:
   - set `userId` to the new user id;
   - set `accessStatus = ACTIVE`.
6. Update `OwnerInvitation`:
   - `status = ACCEPTED`;
   - `acceptedAt = now`.
7. Create refresh token/session and set cookies after the transaction succeeds.

Race safety:

- Re-check `status=PENDING` in the update condition.
- If update count is zero, return a conflict/invalid-token error rather than accepting twice.
- Rely on existing unique constraints for duplicate property-owner assignments.

## Error handling

| Case | Response |
|------|----------|
| Unknown token | `404 Not Found` or generic invalid invitation. |
| Expired token | `410 Gone` with clear expired message. |
| Revoked token | `410 Gone` with clear revoked/invalid message. |
| Already accepted | `409 Conflict` with already accepted message. |
| User already exists | `409 Conflict`; existing-user acceptance is a later slice. |
| Weak/invalid input | `400 Bad Request` via DTO validation. |

Do not leak token hashes, raw token internals, or cross-tenant details in errors.

## Testing plan

API tests should cover:

- valid token metadata lookup;
- invalid token returns safe failure;
- expired token cannot be accepted;
- revoked token cannot be accepted;
- accepted token cannot be reused;
- accepting creates owner-only user with zero tenant memberships;
- accepting activates the existing `PropertyAssetOwner` link;
- owner can access `/api/owner/properties` after acceptance;
- existing user email returns conflict and does not mutate invitation/link.

Targeted commands:

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
git diff --check
```

## Out of scope

- Real email delivery.
- app-new public acceptance page.
- Existing logged-in user accepting another agency/property link.
- Resend/revoke management UI.
- Owner invited/activated activity events.

## Next step

Write the implementation plan, then implement this as one reviewable backend PR under the Stage 21 roadmap.
