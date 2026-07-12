# Stage 22.2 Team Invitations API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement backend-only tenant team invitation management with secure one-time invitation tokens, Prisma persistence, protected create/resend/revoke endpoints, and TDD evidence.

**Architecture:** Add a tenant-scoped `TeamInvitation` Prisma model and repository behind an injection token. Extend the existing `TeamModule` with create/resend/revoke use cases and protected controller endpoints guarded by auth, tenant context, and `TEAM_MANAGE`. Store only token hashes; return raw invitation URLs only from create/resend responses.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL migrations, Vitest, Supertest e2e, class-validator/class-transformer, pnpm.

---

## Non-negotiables

- Backend only: no app-new BFF/UI, no public acceptance page, no email delivery.
- Do not open a PR when done. Stop after implementation, validation, and fresh review until the user explicitly asks for PR creation.
- Persist only `tokenHash`; never persist raw tokens.
- Return raw token only embedded in `invitationUrl` from create/resend responses.
- Require auth + tenant context + `TEAM_MANAGE` for create/resend/revoke.
- Allow invitation roles only `MANAGER` and `AGENT`; never `PRINCIPAL_MANAGER`.
- Reject existing same-tenant members.
- Revoke older pending tenant/email invitations when creating or resending.
- Run API e2e suites sequentially because they share one Postgres test DB.

## Task 1: Add team invitation Prisma model

**Files:**
- Modify: `viewpro-app/apps/api/prisma/schema.prisma`
- Create: `viewpro-app/apps/api/prisma/migrations/<timestamp>_add_team_invitations/migration.sql`

**Step 1: Update Prisma schema**

Add enum:

```prisma
enum TeamInvitationStatus {
  PENDING
  ACCEPTED
  REVOKED
}
```

Add reverse relations:

```prisma
model User {
  // existing fields...
  sentTeamInvitations TeamInvitation[]
}

model Tenant {
  // existing fields...
  teamInvitations TeamInvitation[]
}
```

Add model:

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

**Step 2: Create migration**

Use the existing timestamped migration naming convention. If using Prisma migrate locally is safe in your environment:

```bash
pnpm --dir viewpro-app --filter @viewpro/api db:migrate -- --name add_team_invitations
```

If the local DB state makes migrate unsafe, write the SQL migration manually using this shape:

```sql
CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "team_invitations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "invitedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_invitations_tokenHash_key" ON "team_invitations"("tokenHash");
CREATE INDEX "team_invitations_tenantId_status_idx" ON "team_invitations"("tenantId", "status");
CREATE INDEX "team_invitations_email_status_idx" ON "team_invitations"("email", "status");
CREATE INDEX "team_invitations_expiresAt_idx" ON "team_invitations"("expiresAt");

ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Step 3: Validate and generate**

```bash
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api db:generate
```

Expected: Prisma schema validates and generated client exposes `TeamInvitationStatus` and `prisma.teamInvitation`.

**Step 4: Commit**

```bash
git add viewpro-app/apps/api/prisma/schema.prisma \
  viewpro-app/apps/api/prisma/migrations/*_add_team_invitations/migration.sql
git commit -m "feat(api): add team invitation prisma model"
```

## Task 2: Add secure team invitation token helper

**Files:**
- Create: `viewpro-app/apps/api/test/team-invitations.token.spec.ts`
- Create: `viewpro-app/apps/api/src/team/team-invitation-token.ts`

**Step 1: Write RED tests**

Test:

- token is URL-safe/base64url-like;
- hash is SHA-256 hex and deterministic;
- token hash differs from token;
- expiration is 14 days after `now`.

```ts
import { describe, expect, it } from 'vitest';
import { createTeamInvitationToken, hashTeamInvitationToken } from '../src/team/team-invitation-token';

describe('team invitation token', () => {
  it('creates a secure raw token, hash, and 14-day expiration', () => {
    const now = new Date('2026-05-31T10:00:00.000Z');
    const invitation = createTeamInvitationToken(now);

    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(invitation.token.length).toBeGreaterThanOrEqual(40);
    expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(invitation.tokenHash).not.toBe(invitation.token);
    expect(invitation.expiresAt.toISOString()).toBe('2026-06-14T10:00:00.000Z');
  });

  it('hashes tokens deterministically', () => {
    expect(hashTeamInvitationToken('token-value')).toBe(hashTeamInvitationToken('token-value'));
    expect(hashTeamInvitationToken('token-value')).not.toBe(hashTeamInvitationToken('other-token'));
  });
});
```

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.token.spec.ts
```

Expected: FAIL because helper does not exist.

**Step 3: Implement helper**

```ts
import { createHash, randomBytes } from 'node:crypto';

const TEAM_INVITATION_TOKEN_BYTES = 32;
const TEAM_INVITATION_TTL_DAYS = 14;

export function createTeamInvitationToken(now = new Date()) {
  const token = randomBytes(TEAM_INVITATION_TOKEN_BYTES).toString('base64url');

  return {
    token,
    tokenHash: hashTeamInvitationToken(token),
    expiresAt: addDays(now, TEAM_INVITATION_TTL_DAYS)
  };
}

export function hashTeamInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
```

**Step 4: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.token.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add viewpro-app/apps/api/src/team/team-invitation-token.ts \
  viewpro-app/apps/api/test/team-invitations.token.spec.ts
git commit -m "feat(api): add secure team invitation tokens"
```

## Task 3: Add DTO and response mappers

**Files:**
- Create: `viewpro-app/apps/api/src/team/dto/create-team-invitation.dto.ts`
- Create: `viewpro-app/apps/api/src/team/responses/team-invitation.response.ts`

**Step 1: Create DTO**

```ts
import { TenantRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';

export class CreateTeamInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsIn([TenantRole.MANAGER, TenantRole.AGENT])
  role!: TenantRole.MANAGER | TenantRole.AGENT;
}
```

**Step 2: Create response mappers/types**

```ts
import type { TeamInvitation, TenantRole, TeamInvitationStatus } from '@prisma/client';

export type TeamInvitationLinkResponse = {
  invitationId: string;
  email: string;
  role: TenantRole.MANAGER | TenantRole.AGENT;
  status: TeamInvitationStatus.PENDING;
  expiresAt: string;
  invitationUrl: string;
};

export type TeamInvitationResponse = {
  invitationId: string;
  email: string;
  role: TenantRole.MANAGER | TenantRole.AGENT;
  status: TeamInvitationStatus;
  expiresAt: string;
  revokedAt: string | null;
};

export function toTeamInvitationLinkResponse(
  invitation: Pick<TeamInvitation, 'id' | 'email' | 'role' | 'status' | 'expiresAt'>,
  invitationUrl: string
): TeamInvitationLinkResponse {
  return {
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role as TenantRole.MANAGER | TenantRole.AGENT,
    status: invitation.status as TeamInvitationStatus.PENDING,
    expiresAt: invitation.expiresAt.toISOString(),
    invitationUrl
  };
}

export function toTeamInvitationResponse(
  invitation: Pick<TeamInvitation, 'id' | 'email' | 'role' | 'status' | 'expiresAt' | 'revokedAt'>
): TeamInvitationResponse {
  return {
    invitationId: invitation.id,
    email: invitation.email,
    role: invitation.role as TenantRole.MANAGER | TenantRole.AGENT,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    revokedAt: invitation.revokedAt?.toISOString() ?? null
  };
}
```

**Step 3: Typecheck**

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

Commit this with a later use-case/repository commit if there is no behavior yet, or commit now:

```bash
git add viewpro-app/apps/api/src/team/dto/create-team-invitation.dto.ts \
  viewpro-app/apps/api/src/team/responses/team-invitation.response.ts
git commit -m "feat(api): add team invitation contracts"
```

## Task 4: Add repository tests and implementation

**Files:**
- Create: `viewpro-app/apps/api/test/team-invitations.repository.spec.ts`
- Create: `viewpro-app/apps/api/src/team/team-invitations.repository.ts`
- Create: `viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts`

**Step 1: Write RED repository tests**

Use `PrismaService` test patterns from existing repository specs. Add cleanup for `teamInvitation` before users/tenants.

Test cases:

- `createPendingInvitation` creates a pending row with `tokenHash`, not raw token.
- It revokes older pending invitations for same tenant/email.
- It rejects/returns `alreadyMember` when email belongs to a user already in tenant.
- It allows an existing global user without selected-tenant membership.
- `resendInvitation` revokes old pending invitation and creates a fresh pending invitation.
- `resendInvitation` is tenant-scoped and returns `notFound` for another tenant.
- `revokeInvitation` revokes pending invite and returns no token.
- `revokeInvitation` is tenant-scoped.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected: FAIL because repository files do not exist.

**Step 3: Define repository interface**

Suggested core types:

```ts
import type { TeamInvitation, TenantRole } from '@prisma/client';

export const TEAM_INVITATIONS_REPOSITORY = Symbol('TEAM_INVITATIONS_REPOSITORY');

export type TeamInvitationWithRawToken = TeamInvitation & { token: string };

export type CreateTeamInvitationInput = {
  tenantId: string;
  email: string;
  role: TenantRole.MANAGER | TenantRole.AGENT;
  invitedByUserId: string;
  now?: Date;
};

export type CreateTeamInvitationResult =
  | { status: 'created'; invitation: TeamInvitationWithRawToken }
  | { status: 'alreadyMember' };

export type RotateTeamInvitationResult =
  | { status: 'created'; invitation: TeamInvitationWithRawToken }
  | { status: 'notFound' }
  | { status: 'notAvailable' };

export type RevokeTeamInvitationResult =
  | { status: 'revoked'; invitation: TeamInvitation }
  | { status: 'notFound' }
  | { status: 'notAvailable' };

export interface TeamInvitationsRepository {
  createPendingInvitation(input: CreateTeamInvitationInput): Promise<CreateTeamInvitationResult>;
  resendInvitation(input: { tenantId: string; invitationId: string; invitedByUserId: string; now?: Date }): Promise<RotateTeamInvitationResult>;
  revokeInvitation(input: { tenantId: string; invitationId: string; now?: Date }): Promise<RevokeTeamInvitationResult>;
}
```

**Step 4: Implement Prisma repository**

Implementation rules:

- Normalize email before repository call or inside repository; be consistent.
- Use `$transaction` for create/resend/revoke operations.
- Same-tenant membership check:
  - `user.findUnique({ where: { email } })`
  - if found, `tenantMembership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } })`
- Revoke older pending invites:
  - `teamInvitation.updateMany({ where: { tenantId, email, status: TeamInvitationStatus.PENDING }, data: { status: TeamInvitationStatus.REVOKED, revokedAt: now } })`
- Create fresh invite with `createTeamInvitationToken(now)`.
- `resendInvitation` finds by `{ id, tenantId }`; require pending and `expiresAt > now`; revoke old row and create new row preserving email/role.
- `revokeInvitation` finds by `{ id, tenantId }`; require pending and not expired; update revoked.

**Step 5: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/api/src/team/team-invitations.repository.ts \
  viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts \
  viewpro-app/apps/api/test/team-invitations.repository.spec.ts
git commit -m "feat(api): add team invitations repository"
```

## Task 5: Add use-case tests and implementation

**Files:**
- Create: `viewpro-app/apps/api/test/team-invitations.use-cases.spec.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/create-team-invitation.use-case.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/resend-team-invitation.use-case.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/revoke-team-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`

**Step 1: Write RED use-case tests**

Test create:

- requires `TEAM_MANAGE`.
- creates `MANAGER` and `AGENT` invitations.
- rejects `PRINCIPAL_MANAGER` with `BadRequestException`.
- maps `alreadyMember` to `ConflictException`.
- builds URL from `app.publicUrl` with `/team-invitations/<token>`.
- never returns `tokenHash`.

Test resend:

- requires `TEAM_MANAGE`.
- maps `notFound` to `NotFoundException`.
- maps `notAvailable` to `GoneException`.
- returns fresh `invitationUrl`.

Test revoke:

- requires `TEAM_MANAGE`.
- maps `notFound` to `NotFoundException`.
- maps `notAvailable` to `GoneException`.
- returns revoked response with no `invitationUrl` or `tokenHash`.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
```

Expected: FAIL because use cases do not exist.

**Step 3: Implement use cases**

Use `ConfigService` to read `app.publicUrl`.

Shared helper:

```ts
function ensureTeamManagePermission(tenant: TenantContext) {
  if (!tenant.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
    throw new ForbiddenException('Insufficient permissions');
  }
}

function buildTeamInvitationUrl(publicUrl: string, token: string) {
  return `${publicUrl.replace(/\/$/, '')}/team-invitations/${encodeURIComponent(token)}`;
}
```

Create use case:

- Ensure permission.
- Ensure role is `MANAGER` or `AGENT` defensively.
- Call repository `createPendingInvitation` with normalized email, tenant id, current user id, and role.
- Map `alreadyMember` to `ConflictException`.
- Return `toTeamInvitationLinkResponse`.

Resend use case:

- Ensure permission.
- Call repository `resendInvitation`.
- Map `notFound` to `NotFoundException`.
- Map `notAvailable` to `GoneException`.
- Return link response.

Revoke use case:

- Ensure permission.
- Call repository `revokeInvitation`.
- Map results.
- Return safe response.

**Step 4: Wire module providers**

In `team.module.ts`:

- Register `TEAM_INVITATIONS_REPOSITORY` with `PrismaTeamInvitationsRepository`.
- Add three use cases to providers.

**Step 5: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/api/src/team/use-cases/create-team-invitation.use-case.ts \
  viewpro-app/apps/api/src/team/use-cases/resend-team-invitation.use-case.ts \
  viewpro-app/apps/api/src/team/use-cases/revoke-team-invitation.use-case.ts \
  viewpro-app/apps/api/src/team/team.module.ts \
  viewpro-app/apps/api/test/team-invitations.use-cases.spec.ts
git commit -m "feat(api): add team invitation use cases"
```

## Task 6: Add controller e2e tests and endpoints

**Files:**
- Modify: `viewpro-app/apps/api/src/team/team.controller.ts`
- Modify: `viewpro-app/apps/api/test/team.e2e-spec.ts`

**Step 1: Extend e2e cleanup**

In `team.e2e-spec.ts` cleanup, delete `prisma.teamInvitation.deleteMany()` before memberships/users.

**Step 2: Write RED e2e tests**

Add tests for:

- unauthenticated create returns `401`.
- missing tenant context returns `403`.
- manager/agent without `TEAM_MANAGE` returns `403`.
- principal manager can create invitation.
- `PRINCIPAL_MANAGER` role body returns `400`.
- existing same-tenant member returns `409`.
- existing global user without membership is allowed.
- duplicate create revokes older pending invitation.
- resend rotates token and revokes old invitation.
- revoke returns no `invitationUrl`, raw token, or `tokenHash`.
- resend/revoke are tenant-scoped and return `404` for another tenant.

**Step 3: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: FAIL because endpoints do not exist.

**Step 4: Wire controller endpoints**

Add imports:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/current-user.types';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { CreateTeamInvitationUseCase } from './use-cases/create-team-invitation.use-case';
import { ResendTeamInvitationUseCase } from './use-cases/resend-team-invitation.use-case';
import { RevokeTeamInvitationUseCase } from './use-cases/revoke-team-invitation.use-case';
```

Extend constructor with three use cases.

Add endpoints:

```ts
@Post('invitations')
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
createInvitation(
  @CurrentTenant() tenant: TenantContext,
  @CurrentUser() currentUser: CurrentUserContext,
  @Body() body: CreateTeamInvitationDto
) {
  return this.createTeamInvitationUseCase.execute(tenant, currentUser, body);
}

@Post('invitations/:id/resend')
@HttpCode(HttpStatus.OK)
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
resendInvitation(@CurrentTenant() tenant: TenantContext, @CurrentUser() currentUser: CurrentUserContext, @Param('id') id: string) {
  return this.resendTeamInvitationUseCase.execute(tenant, currentUser, id);
}

@Post('invitations/:id/revoke')
@HttpCode(HttpStatus.OK)
@RequirePermissions(PERMISSIONS.TEAM_MANAGE)
revokeInvitation(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
  return this.revokeTeamInvitationUseCase.execute(tenant, id);
}
```

**Step 5: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add viewpro-app/apps/api/src/team/team.controller.ts \
  viewpro-app/apps/api/test/team.e2e-spec.ts
git commit -m "feat(api): expose team invitation endpoints"
```

## Task 7: Focused validation

Run sequentially:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.token.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/property-engagements.repository.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api db:generate
pnpm --dir viewpro-app --filter @viewpro/api typecheck
pnpm --dir viewpro-app --filter @viewpro/api build
git diff --check
```

Expected: all pass.

## Task 8: Security review and STOP before PR

**Step 1: Fresh review**

Ask a fresh-context reviewer to check:

- No raw token persisted.
- No raw token returned from revoke.
- No `tokenHash` returned by any endpoint.
- Every repository action includes tenant id.
- `TEAM_MANAGE` enforced by guards and use cases.
- `PRINCIPAL_MANAGER` cannot be invited.
- Existing same-tenant member conflict works.
- Existing global user not in tenant can be invited.
- Older pending invites are revoked on create/resend.
- Invitation URL uses `app.publicUrl` and future `/team-invitations/<token>` path.
- No app-new UI/BFF/public acceptance included.

**Step 2: STOP**

Do not create an issue or PR yet. Summarize:

- commits;
- files changed;
- validation evidence;
- fresh review outcome;
- open questions/non-goals;
- likely PR size.

Then wait for the user to say whether to add anything else or proceed to PR.

## Review-size forecast

Likely >400 changed lines because of schema, migration, repository, use cases, controller, and tests. Ask for a size-exception before opening a PR if final diff exceeds 400 lines, unless the user asks to split.
