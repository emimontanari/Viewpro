# Stage 25.4 — Tenant Limit Enforcement Design

## Canonical slice

```txt
Stage: 25
Slice: 25.4 — Tenant limits enforcement
Objective: enforce configured pilot limits for users/team, active property engagements, and documents/storage at mutation boundaries.
Evidence needed: API tests for allowed/blocked mutations, admin limit configuration checks, safe default behavior, and no regression to existing tenant workflows.
Do not touch: billing, paid plans, Stripe, or external billing providers.
Done: tenant limits are enforced consistently with clear errors and existing allowed flows still pass.
Next slice: 26.0 — MVP evidence audit.
```

## Decision

Enforce the Stage 25.3 nullable tenant limit fields at backend mutation boundaries. Enforcement blocks new usage increases only; it does not delete, downgrade, or mutate existing tenant data if a tenant is already above a newly configured limit.

Semantics stay unchanged from Stage 25.3:

- `null` means unlimited.
- `0` means no new capacity is available.
- Positive integers cap the corresponding usage.

Quota errors should return `409 Conflict` with stable, generic messages. They should not expose detailed private usage counts to unauthorized owners/users.

## Enforcement points

### Team/user limit

`maxUsers` is enforced when an invitation is accepted and a new active tenant membership would be created.

Rules:

- Count only active memberships: `TenantMembership.status = ACTIVE`.
- Pending invitations do not reserve seats.
- Deactivated memberships do not count.
- Existing memberships are not removed when a limit is lowered.
- Acceptance is blocked before marking an invitation accepted or creating membership.

Primary backend boundary:

- `viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts`

Use-case error mapping:

- `viewpro-app/apps/api/src/team/use-cases/accept-team-invitation.use-case.ts`

### Active property engagement limit

`maxActivePropertyEngagements` is enforced when a mutation would increase the number of active property engagements.

Rules:

- Count records with `archivedAt = null` and status not in terminal inactive states: `CLOSED`, `CANCELLED`.
- Creating a new engagement counts because create defaults to active operational status.
- Restoring an archived engagement counts only if the restored engagement is non-terminal.
- A status transition from terminal to active also counts if movements can perform that transition.

Primary backend boundaries:

- `viewpro-app/apps/api/src/property-engagements/prisma-property-engagements.repository.ts`
- movement status update path if it can reactivate `CLOSED` or `CANCELLED` engagements.

### Document storage limit

`maxDocumentsStorageMb` is enforced before generating an owner upload URL.

Rules:

- Convert configured MB to bytes with binary MiB semantics: `limitMb * 1024 * 1024`.
- Compare current stored document usage plus requested upload size.
- `0` blocks any upload because upload size must be at least one byte.
- `null` remains unlimited.
- Stage 25.4 uses pre-upload enforcement for better UX; it does not introduce quota reservations or cleanup for abandoned pending uploads.

Primary backend boundary:

- `viewpro-app/apps/api/src/documents/use-cases/create-owner-document-upload-url.use-case.ts`

Repository support:

- `viewpro-app/apps/api/src/documents/documents.repository.ts`
- `viewpro-app/apps/api/src/documents/prisma-documents.repository.ts`

## Architecture

Add a small shared tenant-limit enforcement service/repository in the API app so feature use cases can ask clear quota questions without duplicating semantics.

Recommended shape:

- `TenantLimitEnforcementService` exposes methods such as `assertCanAddTenantUser`, `assertCanAddActivePropertyEngagement`, and `assertCanStoreDocumentBytes`.
- `TenantLimitEnforcementRepository` reads tenant limits and usage counts using Prisma.
- Race-sensitive write paths call enforcement from inside repository transactions when the write and count must be atomic.
- Less race-sensitive pre-upload storage checks can call the service at use-case level first, with repository-level helpers for usage counting.

This keeps controllers thin, preserves NestJS DI boundaries, and keeps enforcement near the write boundary rather than in app-new/BFF code.

## Error handling

Use `ConflictException` for quota-exceeded cases. Messages should be stable and generic:

- `Tenant user limit exceeded`
- `Tenant active property engagement limit exceeded`
- `Tenant document storage limit exceeded`

BFF routes should not need custom handling unless generic proxying drops the API error body.

## Testing strategy

API tests should prove both allowed and blocked mutations:

- `maxUsers = null` allows invitation acceptance.
- `maxUsers = 0` blocks new membership creation.
- Active membership count at the limit blocks acceptance.
- Deactivated memberships do not count.
- `maxActivePropertyEngagements = null` allows create/restore.
- `maxActivePropertyEngagements = 0` blocks active create/restore.
- Terminal and archived engagements do not count as active.
- `maxDocumentsStorageMb = null` allows upload URL creation.
- `maxDocumentsStorageMb = 0` blocks upload URL creation.
- Current usage plus requested size over limit blocks upload URL creation.

Keep tests focused on API/domain behavior. UI changes are out of scope unless error propagation breaks.

## Non-goals

- No billing or pricing logic.
- No Stripe or external billing providers.
- No runtime auth changes.
- No app-new admin UI redesign.
- No quota reservations or pending-upload expiry system.
- No deletion or forced cleanup for tenants already above configured limits.
