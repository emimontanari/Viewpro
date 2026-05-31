# Stage 22.2 — Team Invitations API Design

Stage 22.2 adds the backend foundation for inviting real managers and sellers. This is a **backend-only** slice: it creates tenant-scoped internal invitation records and protected management endpoints, but does not add public acceptance or app-new UI yet.

## Decision

Build **team invitation management endpoints first**.

| Option | Decision | Why |
|---|---|---|
| Backend-only create/resend/revoke | Accepted | Establishes the security-critical model and endpoints before public auth/UI. |
| Backend + manual UI | Rejected for this slice | Would expose invitation links before acceptance exists and increase review scope. |
| Full lifecycle | Rejected for this slice | Acceptance, credential setup, existing users, and UI are too large for one safe PR. |

## Scope

Included:

- Add a `TeamInvitation` persistence model and migration.
- Generate secure one-time invitation tokens.
- Persist only `tokenHash`, never raw tokens.
- Add protected endpoints to create, resend, and revoke pending team invitations.
- Return a manual `invitationUrl` only from create/resend responses.
- Enforce tenant scoping and `TEAM_MANAGE` permission.
- Reject unsupported invite roles and existing memberships.
- Define deterministic duplicate-pending behavior.

Not included:

- Public invitation validation.
- Invitation acceptance.
- Password setup or login/session creation.
- Existing-user acceptance UX.
- Email delivery.
- app-new BFF/UI.
- Role changes for active members.
- Deactivation/suspension.
- Trial/user-limit enforcement.
- Seller visibility or property-assignment changes.
- PR creation without explicit user confirmation.

## Data model

Add a team invitation status enum:

```prisma
enum TeamInvitationStatus {
  PENDING
  ACCEPTED
  REVOKED
}
```

Add a team invitation table:

```prisma
model TeamInvitation {
  id              String               @id @default(uuid())
  tenantId        String
  email           String
  role            TenantRole
  tokenHash       String               @unique
  status          TeamInvitationStatus @default(PENDING)
  expiresAt       DateTime
  acceptedAt      DateTime?
  revokedAt       DateTime?
  invitedByUserId String
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  tenant        Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invitedByUser User   @relation(fields: [invitedByUserId], references: [id])

  @@index([tenantId, status])
  @@index([email, status])
  @@index([expiresAt])
  @@map("team_invitations")
}
```

Add reverse relations on `Tenant` and `User` if Prisma requires them.

## Token policy

Reuse the owner invitation security pattern:

- 32 random bytes.
- `base64url` raw token.
- SHA-256 `tokenHash` persisted.
- 14-day TTL.
- Raw token returned only once from create/resend.
- Raw token is never stored, logged, or returned by revoke/list responses.

## Endpoint contract

All endpoints live under the existing `TeamModule` and guard stack:

```txt
AuthGuard + TenantMembershipGuard + PermissionGuard
RequirePermissions(TEAM_MANAGE)
```

Current permission mapping means only `PRINCIPAL_MANAGER` can invite by default.

### Create invitation

```txt
POST /api/team/invitations
```

Body:

```ts
type CreateTeamInvitationBody = {
  email: string;
  role: 'MANAGER' | 'AGENT';
};
```

Response:

```ts
type TeamInvitationLinkResponse = {
  invitationId: string;
  email: string;
  role: 'MANAGER' | 'AGENT';
  status: 'PENDING';
  expiresAt: string;
  invitationUrl: string;
};
```

Rules:

- Normalize email to lowercase/trimmed form before persistence.
- Only allow `MANAGER` and `AGENT`; reject `PRINCIPAL_MANAGER`.
- Reject if the email already belongs to a user with membership in the selected tenant.
- Allow an existing global user with no membership in this tenant to be invited. Acceptance is deferred.
- Revoke older pending invitations for the same tenant + email before creating the new invite. This mirrors owner invitation link rotation and avoids multiple valid tokens.

### Resend invitation

```txt
POST /api/team/invitations/:id/resend
```

Response: same `TeamInvitationLinkResponse` shape with a fresh one-time token.

Rules:

- Invitation id must belong to selected tenant.
- Only pending, non-expired invitations can be resent.
- Resend revokes the previous pending invitation and creates a new pending invitation with a fresh token.
- Preserve email, role, and inviter metadata if practical; otherwise set inviter to current user for the new invite.

### Revoke invitation

```txt
POST /api/team/invitations/:id/revoke
```

Response:

```ts
type TeamInvitationResponse = {
  invitationId: string;
  email: string;
  role: 'MANAGER' | 'AGENT';
  status: 'REVOKED';
  expiresAt: string;
  revokedAt: string;
};
```

Rules:

- Invitation id must belong to selected tenant.
- Only pending invitations can be revoked.
- Revocation sets `status = REVOKED` and `revokedAt = now`.
- No raw token is returned.

## Invitation URL

Use an explicit app public URL. Stage 21.4 already introduced app-public-url behavior for owner invitation links. Reuse the same config source if available.

Recommended path for future acceptance:

```txt
/team-invitations/[token]
```

Even though that page is out of scope, returning this URL from create/resend establishes the contract.

## Repository design

Create a team invitations repository with tenant-scoped methods:

- `createPendingInvitation(...)` — revokes existing pending tenant/email invites and creates a new row transactionally.
- `findPendingByIdForTenant(...)` — loads a pending invitation by id and tenant.
- `resendInvitation(...)` — tenant-scoped rotate/recreate operation.
- `revokeInvitation(...)` — tenant-scoped status transition.
- `findActiveMembershipByEmailForTenant(...)` or equivalent check before create.

Prefer repository-level transactions for rotation to avoid races and stale pending tokens.

## Error handling

Use clear but safe errors:

- `ForbiddenException` for missing `TEAM_MANAGE` defense-in-depth.
- `BadRequestException` for invalid role.
- `ConflictException` when the email is already a member of the selected tenant.
- `NotFoundException` for invitation ids not found in selected tenant.
- `GoneException` for expired/revoked/accepted invitations when resending/revoking.

## Security considerations

- Every protected action includes tenant id in the repository `where` clause.
- Never query invitation id globally for protected actions.
- Never persist or return `tokenHash` outside server code.
- Normalize email consistently for duplicate detection and future acceptance.
- Only `TEAM_MANAGE` can create/resend/revoke.
- Do not let users invite `PRINCIPAL_MANAGER` in this slice.
- Acceptance flow will need separate throttling and existing-user handling later.

## Testing strategy

Use-case tests:

- Principal manager with `TEAM_MANAGE` can create `AGENT` and `MANAGER` invitations.
- Create rejects `PRINCIPAL_MANAGER`.
- Create rejects an existing member in the same tenant.
- Create allows an existing global user not in tenant.
- Create revokes older pending invitations for same tenant/email and returns only the fresh raw link.
- Resend rotates pending token and revokes old invite.
- Revoke marks pending invite revoked and returns no raw token.
- Manager without `TEAM_MANAGE` is forbidden.
- Raw token is never persisted and `tokenHash` is never returned.

E2E tests:

- `POST /api/team/invitations` requires tenant context and `TEAM_MANAGE`.
- Principal manager can create an invite.
- Manager/agent cannot create.
- Resend/revoke are tenant-scoped.
- Response shape excludes token hashes.

Regression tests:

- Existing `GET /team/members` still passes.
- Existing property-engagement assignment tests remain green.

## Review strategy

Keep this as one backend-only slice. If implementation grows past the intended scope, split before adding UI or acceptance.

Expected review size: medium. The migration + repository + three use cases + tests may exceed 400 lines, but the surface area is cohesive and security-critical. If final diff exceeds 400 lines, ask for size-exception before opening PR.

## Acceptance criteria

- Team invitations can be created, resent, and revoked through protected backend endpoints.
- Only tenant users with `TEAM_MANAGE` can manage invitations.
- Invitations are tenant-scoped.
- Tokens are stored only as hashes.
- Older pending invitations for the same tenant/email are revoked when creating/resending.
- Existing tenant members cannot be invited again.
- No public acceptance or app-new UI is added.
