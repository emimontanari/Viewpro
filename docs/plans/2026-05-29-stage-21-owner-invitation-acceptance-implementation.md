# Stage 21.2 Owner Invitation Acceptance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add backend endpoints that validate and accept owner invitation tokens, create owner-only credentials, activate the property-owner link, and establish an auth session.

**Architecture:** Add a small `OwnerInvitationsModule` with public validate/accept endpoints and repository-backed transactional acceptance. Tokens remain raw-only in URLs/forms, are hashed before lookup, and only `tokenHash` is stored in the database. Acceptance creates a `User` with zero tenant memberships, updates `PropertyAssetOwner` to `ACTIVE`, marks the invitation `ACCEPTED`, and reuses the existing auth token/cookie machinery.

**Tech Stack:** NestJS 11, Prisma, PostgreSQL, Argon2 password hashing, existing JWT/refresh-token cookie auth, Vitest/Supertest e2e tests, pnpm.

---

## Preconditions

- Branch: `feat/stage-21-owner-invitation-acceptance`.
- Design doc committed: `docs/plans/2026-05-29-stage-21-owner-invitation-acceptance-design.md`.
- Stage 21.1 migration is already on `develop` and local test DB has `owner_invitations`.
- Use targeted Vitest commands through `pnpm exec vitest run test/<file>`, not `pnpm test -- <file>`.

## Review boundary

This PR should stay backend-only:

- Include API endpoints, use cases, repository methods, and API tests.
- Do not add app-new acceptance page.
- Do not add real email delivery.
- Do not support existing-user acceptance yet; return a clear conflict.

---

### Task 1: Add failing e2e coverage for invitation validation

**Files:**
- Create: `viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts`

**Step 1: Write the failing tests**

Create `owner-invitations.e2e-spec.ts` with the same test app setup pattern as `test/property-engagements.e2e-spec.ts`.

Use helpers inside the test file:

```ts
import { OwnerInvitationStatus, PropertyAssetOwnerAccessStatus, PropertyOperationType, PropertyType } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'
import { hashOwnerInvitationToken } from '../src/property-engagements/owner-invitation-token'

type TestAgent = ReturnType<typeof request.agent>

const rawToken = 'stage-21-valid-owner-token'

describe('Owner invitations (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.ownerInvitation.deleteMany()
    await prisma.documentVersion.deleteMany()
    await prisma.document.deleteMany()
    await prisma.documentRequest.deleteMany()
    await prisma.movement.deleteMany()
    await prisma.propertyAgent.deleteMany()
    await prisma.propertyAssetOwner.deleteMany()
    await prisma.propertyEngagement.deleteMany()
    await prisma.propertyAsset.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns safe metadata for a pending owner invitation token', async () => {
    const { invitation, ownerLink, engagement } = await createPendingInvitation(rawToken)

    const response = await request(app.getHttpServer())
      .get(`/api/owner-invitations/${rawToken}`)
      .expect(200)

    expect(response.body).toEqual({
      id: invitation.id,
      email: 'invited-owner@example.com',
      ownerFirstName: 'Invited',
      ownerLastName: 'Owner',
      propertyAssetOwnerId: ownerLink.id,
      property: {
        id: engagement.body.property.id,
        title: 'Invitation property',
        addressLine: 'Av. Invitacion 123',
        city: 'Buenos Aires',
        province: 'CABA',
      },
      expiresAt: invitation.expiresAt.toISOString(),
    })
    expect(response.body).not.toHaveProperty('tokenHash')
  })

  it('returns not found for an unknown invitation token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/owner-invitations/unknown-token')
      .expect(404)

    expect(response.body.message).toBe('Owner invitation not found')
  })
})
```

Add helper functions below the tests. Copy `registerTenantSession` and `createEngagement` from `property-engagements.e2e-spec.ts`, then add this invitation helper:

```ts
async function createPendingInvitation(token: string) {
  const manager = await registerTenantSession('manager-owner-invite@example.com', 'Owner Invite Homes')
  const engagement = await createEngagement(manager.agent, manager.tenantId).expect(201)

  const ownerResponse = await manager.agent
    .post(`/api/property-engagements/${engagement.body.id}/owners`)
    .set('x-tenant-id', manager.tenantId)
    .send({ firstName: 'Invited', lastName: 'Owner', email: 'invited-owner@example.com' })
    .expect(201)

  const existingInvitation = await prisma.ownerInvitation.findFirstOrThrow({
    where: { propertyAssetOwnerId: ownerResponse.body.id },
  })
  const invitation = await prisma.ownerInvitation.update({
    where: { id: existingInvitation.id },
    data: {
      tokenHash: hashOwnerInvitationToken(token),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: OwnerInvitationStatus.PENDING,
      acceptedAt: null,
      revokedAt: null,
    },
  })

  return { invitation, ownerLink: ownerResponse.body, engagement, manager }
}
```

**Step 2: Run the tests to verify they fail**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

Expected: FAIL with `Cannot GET /api/owner-invitations/<token>` or route not found.

**Step 3: Commit the red tests**

```bash
git add viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts
git commit -m "test(owners): cover invitation token validation"
```

---

### Task 2: Implement validation endpoint and response mapping

**Files:**
- Create: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.module.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.controller.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.repository.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/prisma-owner-invitations.repository.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/responses/owner-invitation.response.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/use-cases/validate-owner-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/app.module.ts`

**Step 1: Add repository contract**

```ts
import type { OwnerInvitationStatus } from '@prisma/client'

export const OWNER_INVITATIONS_REPOSITORY = Symbol('OWNER_INVITATIONS_REPOSITORY')

export type OwnerInvitationDetails = {
  id: string
  propertyAssetOwnerId: string
  email: string
  status: OwnerInvitationStatus
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  propertyAssetOwner: {
    id: string
    ownerEmail: string
    ownerFirstName: string
    ownerLastName: string
    accessStatus: string
    userId: string | null
    propertyAsset: {
      id: string
      title: string
      addressLine: string
      city: string
      province: string
    }
  }
}

export type OwnerInvitationsRepository = {
  findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null>
}
```

**Step 2: Add Prisma implementation**

```ts
import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type { OwnerInvitationDetails, OwnerInvitationsRepository } from './owner-invitations.repository'

const ownerInvitationInclude = {
  propertyAssetOwner: {
    select: {
      id: true,
      ownerEmail: true,
      ownerFirstName: true,
      ownerLastName: true,
      accessStatus: true,
      userId: true,
      propertyAsset: {
        select: {
          id: true,
          title: true,
          addressLine: true,
          city: true,
          province: true,
        },
      },
    },
  },
} satisfies Prisma.OwnerInvitationInclude

@Injectable()
export class PrismaOwnerInvitationsRepository implements OwnerInvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null> {
    return this.prisma.ownerInvitation.findUnique({
      where: { tokenHash },
      include: ownerInvitationInclude,
    })
  }
}
```

**Step 3: Add response mapper**

```ts
import type { OwnerInvitationDetails } from '../owner-invitations.repository'

export type OwnerInvitationResponse = {
  id: string
  propertyAssetOwnerId: string
  email: string
  ownerFirstName: string
  ownerLastName: string
  property: {
    id: string
    title: string
    addressLine: string
    city: string
    province: string
  }
  expiresAt: string
}

export function mapOwnerInvitation(invitation: OwnerInvitationDetails): OwnerInvitationResponse {
  return {
    id: invitation.id,
    propertyAssetOwnerId: invitation.propertyAssetOwnerId,
    email: invitation.email,
    ownerFirstName: invitation.propertyAssetOwner.ownerFirstName,
    ownerLastName: invitation.propertyAssetOwner.ownerLastName,
    property: invitation.propertyAssetOwner.propertyAsset,
    expiresAt: invitation.expiresAt.toISOString(),
  }
}
```

**Step 4: Add validate use case**

```ts
import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { OwnerInvitationStatus } from '@prisma/client'
import { hashOwnerInvitationToken } from '../../property-engagements/owner-invitation-token'
import {
  OWNER_INVITATIONS_REPOSITORY,
  type OwnerInvitationsRepository,
} from '../owner-invitations.repository'
import { mapOwnerInvitation, type OwnerInvitationResponse } from '../responses/owner-invitation.response'

@Injectable()
export class ValidateOwnerInvitationUseCase {
  constructor(
    @Inject(OWNER_INVITATIONS_REPOSITORY)
    private readonly ownerInvitationsRepository: OwnerInvitationsRepository,
  ) {}

  async execute(rawToken: string): Promise<OwnerInvitationResponse> {
    const invitation = await this.ownerInvitationsRepository.findByTokenHash(hashOwnerInvitationToken(rawToken))

    if (!invitation) {
      throw new NotFoundException('Owner invitation not found')
    }

    if (invitation.status === OwnerInvitationStatus.ACCEPTED || invitation.acceptedAt) {
      throw new GoneException('Owner invitation was already accepted')
    }

    if (invitation.status === OwnerInvitationStatus.REVOKED || invitation.revokedAt) {
      throw new GoneException('Owner invitation is no longer available')
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Owner invitation has expired')
    }

    return mapOwnerInvitation(invitation)
  }
}
```

**Step 5: Add controller/module and import into AppModule**

Controller:

```ts
import { Controller, Get, Param } from '@nestjs/common'
import { ValidateOwnerInvitationUseCase } from './use-cases/validate-owner-invitation.use-case'

@Controller('owner-invitations')
export class OwnerInvitationsController {
  constructor(private readonly validateOwnerInvitationUseCase: ValidateOwnerInvitationUseCase) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.validateOwnerInvitationUseCase.execute(token)
  }
}
```

Module:

```ts
import { Module } from '@nestjs/common'
import { OwnerInvitationsController } from './owner-invitations.controller'
import { OWNER_INVITATIONS_REPOSITORY } from './owner-invitations.repository'
import { PrismaOwnerInvitationsRepository } from './prisma-owner-invitations.repository'
import { ValidateOwnerInvitationUseCase } from './use-cases/validate-owner-invitation.use-case'

@Module({
  controllers: [OwnerInvitationsController],
  providers: [
    ValidateOwnerInvitationUseCase,
    { provide: OWNER_INVITATIONS_REPOSITORY, useClass: PrismaOwnerInvitationsRepository },
  ],
})
export class OwnerInvitationsModule {}
```

In `app.module.ts`, import `OwnerInvitationsModule` and add it after `OwnerPortalModule` or near auth-adjacent modules.

**Step 6: Run validation tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

Expected: validation metadata tests PASS.

**Step 7: Commit**

```bash
git add viewpro-app/apps/api/src/owner-invitations viewpro-app/apps/api/src/app.module.ts viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts
git commit -m "feat(owners): validate owner invitation tokens"
```

---

### Task 3: Add failing e2e coverage for accepting a new owner invitation

**Files:**
- Modify: `viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts`

**Step 1: Add acceptance tests**

Add tests, with `const ownerPassword = makeTestPassword()` declared near the test token fixture:

```ts
it('accepts a pending invitation by creating an owner-only user and activating the link', async () => {
  const { ownerLink } = await createPendingInvitation(rawToken)

  const response = await request(app.getHttpServer())
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', lastName: 'Owner', password: ownerPassword })
    .expect(201)

  expect(response.body).toMatchObject({
    user: {
      email: 'invited-owner@example.com',
      firstName: 'Accepted',
      lastName: 'Owner',
    },
    memberships: [],
  })
  expect(response.headers['set-cookie']?.join(';')).toContain('viewpro_access_token')
  expect(response.headers['set-cookie']?.join(';')).toContain('viewpro_refresh_token')

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'invited-owner@example.com' } })
  await expect(prisma.tenantMembership.count({ where: { userId: user.id } })).resolves.toBe(0)
  await expect(
    prisma.propertyAssetOwner.count({
      where: {
        id: ownerLink.id,
        userId: user.id,
        accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
      },
    }),
  ).resolves.toBe(1)
  await expect(
    prisma.ownerInvitation.count({
      where: {
        propertyAssetOwnerId: ownerLink.id,
        status: OwnerInvitationStatus.ACCEPTED,
        acceptedAt: { not: null },
      },
    }),
  ).resolves.toBe(1)
})

it('lets the accepted owner access owner portal properties', async () => {
  const { engagement } = await createPendingInvitation(rawToken)
  const ownerAgent = request.agent(app.getHttpServer())

  await ownerAgent
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', lastName: 'Owner', password: ownerPassword })
    .expect(201)

  const properties = await ownerAgent.get('/api/owner/properties').expect(200)
  expect(properties.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: engagement.body.property.id, title: 'Invitation property' }),
    ]),
  )
})

it('rejects accepting the same invitation twice', async () => {
  await createPendingInvitation(rawToken)

  await request(app.getHttpServer())
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', lastName: 'Owner', password: ownerPassword })
    .expect(201)

  const response = await request(app.getHttpServer())
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', lastName: 'Owner', password: ownerPassword })
    .expect(410)

  expect(response.body.message).toBe('Owner invitation was already accepted')
})

it('rejects accepting an invitation when the owner email is already registered', async () => {
  await createPendingInvitation(rawToken)
  await registerTenantSession('invited-owner@example.com', 'Existing Owner Homes')

  const response = await request(app.getHttpServer())
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', lastName: 'Owner', password: ownerPassword })
    .expect(409)

  expect(response.body.message).toBe('Owner email is already registered')
})
```

Add the password helper and expired/revoked cases if line budget allows:

```ts
function makeTestPassword() {
  return `owner-${Date.now()}-fixture`
}

it('rejects expired invitations', async () => {
  const { invitation } = await createPendingInvitation(rawToken)
  await prisma.ownerInvitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } })

  const response = await request(app.getHttpServer())
    .post(`/api/owner-invitations/${rawToken}/accept`)
    .send({ firstName: 'Accepted', password: ownerPassword })
    .expect(410)

  expect(response.body.message).toBe('Owner invitation has expired')
})
```

**Step 2: Run to verify RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

Expected: validation tests pass, acceptance tests fail with missing route.

**Step 3: Commit red tests**

```bash
git add viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts
git commit -m "test(owners): cover owner invitation acceptance"
```

---

### Task 4: Implement acceptance DTO, repository transaction, use case, and controller route

**Files:**
- Create: `viewpro-app/apps/api/src/owner-invitations/dto/accept-owner-invitation.dto.ts`
- Create: `viewpro-app/apps/api/src/owner-invitations/use-cases/accept-owner-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/prisma-owner-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.controller.ts`
- Modify: `viewpro-app/apps/api/src/owner-invitations/owner-invitations.module.ts`
- Modify: `viewpro-app/apps/api/src/auth/auth.module.ts`

**Step 1: Export auth internals needed by the owner invitation module**

In `auth.module.ts`, add `PASSWORD_HASHER`, `REFRESH_TOKEN_REPOSITORY`, and `AuthThrottlerGuard` to exports:

```ts
exports: [AuthGuard, AuthThrottlerGuard, TokenService, PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY],
```

**Step 2: Add DTO**

```ts
import { IsOptional, IsString, MinLength } from 'class-validator'

export class AcceptOwnerInvitationDto {
  @IsString()
  @MinLength(1)
  firstName!: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsString()
  @MinLength(8)
  password!: string
}
```

**Step 3: Extend repository contract**

```ts
import type { Prisma, User } from '@prisma/client'

export type AcceptOwnerInvitationInput = {
  tokenHash: string
  passwordHash: string
  firstName: string
  lastName?: string
  now: Date
}

export type AcceptOwnerInvitationResult =
  | { status: 'accepted'; user: User }
  | { status: 'notFound' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'alreadyAccepted' }
  | { status: 'userAlreadyExists' }

export type OwnerInvitationsRepository = {
  findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null>
  acceptForNewOwner(input: AcceptOwnerInvitationInput): Promise<AcceptOwnerInvitationResult>
}
```

**Step 4: Implement transaction in Prisma repository**

```ts
async acceptForNewOwner(input: AcceptOwnerInvitationInput): Promise<AcceptOwnerInvitationResult> {
  return this.prisma.$transaction(async (tx) => {
    const invitation = await tx.ownerInvitation.findUnique({
      where: { tokenHash: input.tokenHash },
      include: { propertyAssetOwner: true },
    })

    if (!invitation) return { status: 'notFound' }
    if (invitation.status === 'ACCEPTED' || invitation.acceptedAt) return { status: 'alreadyAccepted' }
    if (invitation.status === 'REVOKED' || invitation.revokedAt) return { status: 'revoked' }
    if (invitation.expiresAt.getTime() <= input.now.getTime()) return { status: 'expired' }

    const existingUser = await tx.user.findUnique({ where: { email: invitation.email } })
    if (existingUser) return { status: 'userAlreadyExists' }

    const updatedInvitation = await tx.ownerInvitation.updateMany({
      where: {
        id: invitation.id,
        status: 'PENDING',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: input.now },
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt: input.now,
      },
    })

    if (updatedInvitation.count === 0) return { status: 'alreadyAccepted' }

    const user = await tx.user.create({
      data: {
        email: invitation.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
      },
    })

    await tx.propertyAssetOwner.update({
      where: { id: invitation.propertyAssetOwnerId },
      data: {
        userId: user.id,
        accessStatus: 'ACTIVE',
      },
    })

    return { status: 'accepted', user }
  })
}
```

**Step 5: Add accept use case**

```ts
import { ConflictException, GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { hashOwnerInvitationToken } from '../../property-engagements/owner-invitation-token'
import { mapAuthUser } from '../../auth/responses/auth-user.response'
import type { MeResponse } from '../../auth/responses/me.response'
import type { PasswordHasher } from '../../auth/security/password-hasher'
import { PASSWORD_HASHER } from '../../auth/security/password-hasher'
import type { RefreshTokenRepository } from '../../auth/tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../../auth/tokens/refresh-token.repository'
import { TokenService } from '../../auth/tokens/token.service'
import type { AuthSessionResult } from '../../auth/use-cases/register-tenant.use-case'
import type { AcceptOwnerInvitationDto } from '../dto/accept-owner-invitation.dto'
import {
  OWNER_INVITATIONS_REPOSITORY,
  type OwnerInvitationsRepository,
} from '../owner-invitations.repository'

@Injectable()
export class AcceptOwnerInvitationUseCase {
  constructor(
    @Inject(OWNER_INVITATIONS_REPOSITORY)
    private readonly ownerInvitationsRepository: OwnerInvitationsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(rawToken: string, dto: AcceptOwnerInvitationDto): Promise<AuthSessionResult> {
    const passwordHash = await this.passwordHasher.hash(dto.password)
    const result = await this.ownerInvitationsRepository.acceptForNewOwner({
      tokenHash: hashOwnerInvitationToken(rawToken),
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim() || undefined,
      now: new Date(),
    })

    if (result.status === 'notFound') throw new NotFoundException('Owner invitation not found')
    if (result.status === 'expired') throw new GoneException('Owner invitation has expired')
    if (result.status === 'revoked') throw new GoneException('Owner invitation is no longer available')
    if (result.status === 'alreadyAccepted') throw new GoneException('Owner invitation was already accepted')
    if (result.status === 'userAlreadyExists') throw new ConflictException('Owner email is already registered')

    const accessToken = await this.tokenService.signAccessToken({ sub: result.user.id, email: result.user.email })
    const refreshToken = this.tokenService.generateRefreshToken()

    await this.refreshTokenRepository.create({
      userId: result.user.id,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })

    const body: MeResponse = { user: mapAuthUser(result.user), memberships: [] }
    return { accessToken, refreshToken, body }
  }
}
```

**Step 6: Wire controller and module**

Controller additions:

```ts
import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { getAuthRateLimitConfig } from '../config/app.config'
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard'
import { TokenService } from '../auth/tokens/token.service'
import { AcceptOwnerInvitationDto } from './dto/accept-owner-invitation.dto'
import { AcceptOwnerInvitationUseCase } from './use-cases/accept-owner-invitation.use-case'

const authRateLimit = getAuthRateLimitConfig()
function toThrottleOptions(config: { limit: number; ttlSeconds: number }) {
  return { default: { limit: config.limit, ttl: config.ttlSeconds * 1000 } }
}
```

Constructor should inject `AcceptOwnerInvitationUseCase` and `TokenService`.

Add route:

```ts
@Post(':token/accept')
@UseGuards(AuthThrottlerGuard)
@Throttle(toThrottleOptions(authRateLimit.register))
async accept(
  @Param('token') token: string,
  @Body() dto: AcceptOwnerInvitationDto,
  @Res({ passthrough: true }) response: Response,
) {
  const result = await this.acceptOwnerInvitationUseCase.execute(token, dto)
  this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
  return result.body
}
```

Module should import `AuthModule` and include `AcceptOwnerInvitationUseCase` in providers.

**Step 7: Run acceptance tests**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
```

Expected: PASS.

**Step 8: Commit**

```bash
git add viewpro-app/apps/api/src/auth/auth.module.ts viewpro-app/apps/api/src/owner-invitations viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts
git commit -m "feat(owners): accept owner invitations"
```

---

### Task 5: Harden edge cases and run full affected checks

**Files:**
- Modify as needed based on failing tests or review.

**Step 1: Add/confirm edge-case tests**

Ensure `owner-invitations.e2e-spec.ts` covers:

- `GET` unknown token -> 404.
- `GET` expired token -> 410.
- `POST` expired token -> 410.
- `POST` already accepted token -> 410.
- `POST` existing email -> 409.
- Accept creates zero tenant memberships.
- Accept enables `/api/owner/properties` access.

**Step 2: Run targeted checks**

```bash
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/owner-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/property-engagements.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api exec vitest run test/auth.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
git diff --check
```

Expected: all pass.

**Step 3: Fresh review**

Run a fresh reviewer before PR:

- Check token handling.
- Check public endpoint error leakage.
- Check transaction/race behavior.
- Check owner-only user has no tenant membership.
- Check review size under 400 changed lines.

**Step 4: Final commit if changes were needed**

```bash
git add viewpro-app/apps/api/src/owner-invitations viewpro-app/apps/api/src/auth/auth.module.ts viewpro-app/apps/api/src/app.module.ts viewpro-app/apps/api/test/owner-invitations.e2e-spec.ts
git commit -m "test(owners): harden invitation acceptance"
```

Skip this commit if Task 4 already includes all hardening and the working tree is clean.

---

### Task 6: Prepare issue and PR

**Files:**
- Create temporary PR body in `/tmp`, not committed.

**Step 1: Create approved issue**

Use the issue-first workflow:

```bash
gh issue create \
  --title "feat(owners): accept owner invitations" \
  --body-file /tmp/viewpro-stage-21-owner-invitation-acceptance-issue.md \
  --label enhancement \
  --label status:approved
```

Issue body must include:

- problem: invited owners cannot create credentials or activate their link;
- proposed solution: backend token validation/acceptance;
- acceptance criteria matching this plan.

**Step 2: Push branch**

```bash
git push -u origin feat/stage-21-owner-invitation-acceptance
```

**Step 3: Open PR to develop**

```bash
gh pr create \
  --base develop \
  --head feat/stage-21-owner-invitation-acceptance \
  --title "feat(owners): accept owner invitations" \
  --body-file /tmp/viewpro-stage-21-owner-invitation-acceptance-pr.md
```

**Step 4: Add exactly one type label**

```bash
gh pr edit <PR_NUMBER> --add-label type:feature
```

**Step 5: Verify PR hygiene**

```bash
gh pr view <PR_NUMBER> --json baseRefName,headRefName,labels,mergeStateStatus,statusCheckRollup
```

Expected:

- baseRefName: `develop`;
- exactly one `type:*` label: `type:feature`;
- approved issue linked in PR body with `Closes #N`;
- checks passing or pending.
