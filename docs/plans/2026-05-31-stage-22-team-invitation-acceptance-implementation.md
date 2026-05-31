# Stage 22.4 Team Invitation Acceptance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let invited managers/agents accept a team invitation link as either brand-new users or existing global users, join the invited tenant, receive auth cookies, select that tenant, and land on `/dashboard`.

**Architecture:** Add a public API controller at `/team-invitations/*` while keeping the existing guarded `/team/*` management controller unchanged. Extend the team invitations repository with token validation and transactional acceptance. Add an app-new public invitation page and client flow that chooses between registration, existing-user password acceptance, and already-logged-in same-email acceptance.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Vitest, Supertest, class-validator/class-transformer, Next.js 16 App Router, React 19, Testing Library, TanStack Form, pnpm.

---

## Non-negotiables

- Use `pnpm`, not Bun.
- Implement on branch `feat/stage-22-team-invitation-acceptance`.
- Do not weaken the existing guarded `TeamController` class-level guards.
- Public acceptance must use a separate controller, recommended `TeamInvitationsPublicController`.
- Do not store raw invitation tokens.
- Do not expose `tokenHash` or raw tokens in public responses.
- Do not route through generic sign-in redirects with the raw token in `redirect_url`.
- Existing users must be able to accept either with a matching current session or by entering their password on the invitation page.
- Users logged in with a different email must not be able to accept the invitation.
- Acceptance must be transactional and race-safe.
- No email delivery, pending invitation list, resend/revoke UI, bulk import, role changes, or deactivation in this slice.
- Do not commit, push, open PRs, or delete branches unless the user explicitly approves that action.

## Task 1: Add backend public DTOs and response mapper

**Files:**
- Create: `viewpro-app/apps/api/src/team/dto/accept-team-invitation.dto.ts`
- Modify: `viewpro-app/apps/api/src/team/responses/team-invitation.response.ts`

**Step 1: Create the accept DTO**

Create a discriminated DTO with class-validator. Keep runtime validation explicit because this is a public endpoint.

```ts
import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator'

export const ACCEPT_TEAM_INVITATION_MODES = ['register', 'login', 'current-session'] as const
export type AcceptTeamInvitationMode = (typeof ACCEPT_TEAM_INVITATION_MODES)[number]

export class AcceptTeamInvitationDto {
  @IsIn(ACCEPT_TEAM_INVITATION_MODES)
  mode!: AcceptTeamInvitationMode

  @ValidateIf((dto: AcceptTeamInvitationDto) => dto.mode === 'register')
  @IsString()
  @MinLength(1)
  firstName?: string

  @ValidateIf((dto: AcceptTeamInvitationDto) => dto.mode === 'register')
  @IsOptional()
  @IsString()
  lastName?: string

  @ValidateIf((dto: AcceptTeamInvitationDto) => dto.mode === 'register' || dto.mode === 'login')
  @IsString()
  @MinLength(8)
  password?: string
}
```

**Step 2: Add public response types/mappers**

Extend `team-invitation.response.ts` with safe public metadata.

```ts
import type { TeamInvitation, TeamInvitationStatus, Tenant, TenantRole } from '@prisma/client'

export type TeamInvitationPublicResponse = {
  email: string
  role: TeamInvitationRole
  status: Extract<TeamInvitationStatus, 'PENDING'>
  expiresAt: string
  emailRegistered: boolean
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
}

export function toTeamInvitationPublicResponse(
  invitation: Pick<TeamInvitation, 'email' | 'role' | 'status' | 'expiresAt'> & { tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'status'> },
  emailRegistered: boolean,
): TeamInvitationPublicResponse {
  return {
    email: invitation.email,
    role: invitation.role as TeamInvitationRole,
    status: invitation.status as Extract<TeamInvitationStatus, 'PENDING'>,
    expiresAt: invitation.expiresAt.toISOString(),
    emailRegistered,
    tenant: {
      id: invitation.tenant.id,
      name: invitation.tenant.name,
      slug: invitation.tenant.slug,
      status: invitation.tenant.status,
    },
  }
}
```

**Step 3: Typecheck**

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

**Step 4: Checkpoint**

Do not commit unless the user has explicitly approved commits. Otherwise continue with the next task.

## Task 2: Extend repository contract and write repository RED tests

**Files:**
- Modify: `viewpro-app/apps/api/src/team/team-invitations.repository.ts`
- Modify: `viewpro-app/apps/api/test/team-invitations.repository.spec.ts`

**Step 1: Extend repository types**

Add types for safe validation and transactional acceptance.

```ts
import type { TeamInvitation, Tenant, User } from '@prisma/client'

export type TeamInvitationWithTenant = TeamInvitation & {
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'status'>
}

export type ValidateTeamInvitationResult =
  | { status: 'valid'; invitation: TeamInvitationWithTenant; emailRegistered: boolean }
  | { status: 'notFound' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'alreadyAccepted' }

export type AcceptTeamInvitationForNewUserInput = {
  tokenHash: string
  firstName: string
  lastName?: string
  passwordHash: string
  now?: Date
}

export type AcceptTeamInvitationForExistingUserInput = {
  tokenHash: string
  userId: string
  now?: Date
}

export type AcceptTeamInvitationResult =
  | { status: 'accepted'; user: User }
  | { status: 'notFound' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'alreadyAccepted' }
  | { status: 'alreadyMember' }
  | { status: 'userAlreadyExists' }
  | { status: 'userNotFound' }
  | { status: 'emailMismatch' }
```

Add methods to `TeamInvitationsRepository`:

```ts
validateByTokenHash(input: { tokenHash: string; now?: Date }): Promise<ValidateTeamInvitationResult>
acceptForNewUser(input: AcceptTeamInvitationForNewUserInput): Promise<AcceptTeamInvitationResult>
acceptForExistingUser(input: AcceptTeamInvitationForExistingUserInput): Promise<AcceptTeamInvitationResult>
```

**Step 2: Write RED repository tests**

Add tests to `team-invitations.repository.spec.ts` for:

- `validateByTokenHash` returns pending invitation safe metadata and `emailRegistered: false`.
- `validateByTokenHash` returns `emailRegistered: true` for an existing global user without tenant membership.
- `validateByTokenHash` maps unknown token to `notFound`.
- `validateByTokenHash` maps expired/revoked/accepted invitations.
- `acceptForNewUser` creates user, creates tenant membership with invited role, marks invitation accepted.
- `acceptForNewUser` returns `userAlreadyExists` when invitation email already exists.
- `acceptForExistingUser` creates only the missing tenant membership and marks invitation accepted.
- `acceptForExistingUser` returns `emailMismatch` when user id belongs to a different email.
- `acceptForExistingUser` returns `alreadyMember` when the user already belongs to the invited tenant.
- stale acceptance is race-safe: if the invitation is no longer pending, return `alreadyAccepted`/`revoked`/`expired` instead of creating a duplicate membership.

Use existing repository test factories/cleanup patterns. Cleanup must delete `teamInvitation` before users/tenants.

**Step 3: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected: FAIL because repository methods are not implemented.

## Task 3: Implement repository validation and acceptance

**Files:**
- Modify: `viewpro-app/apps/api/src/team/prisma-team-invitations.repository.ts`

**Step 1: Implement `validateByTokenHash`**

Use `findUnique` by `tokenHash`, include tenant metadata, then map availability.

```ts
const invitation = await this.prisma.teamInvitation.findUnique({
  where: { tokenHash: input.tokenHash },
  include: {
    tenant: { select: { id: true, name: true, slug: true, status: true } },
  },
})
```

Status mapping:

- missing -> `notFound`
- `revokedAt` or `REVOKED` -> `revoked`
- `acceptedAt` or `ACCEPTED` -> `alreadyAccepted`
- `expiresAt <= now` -> `expired`
- otherwise query `user.findUnique({ where: { email } })` and return `valid`.

**Step 2: Implement `acceptForNewUser`**

Inside one `$transaction`:

1. Load invitation by `tokenHash` including tenant.
2. Require pending and unexpired.
3. Check `user.findUnique({ where: { email: invitation.email } })`; if found return `userAlreadyExists`.
4. Create user:

```ts
const user = await tx.user.create({
  data: {
    email: invitation.email,
    passwordHash: input.passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
  },
})
```

5. Create membership:

```ts
await tx.tenantMembership.create({
  data: {
    userId: user.id,
    tenantId: invitation.tenantId,
    role: invitation.role,
  },
})
```

6. Mark invitation accepted with `updateMany` preconditions:

```ts
const update = await tx.teamInvitation.updateMany({
  where: {
    id: invitation.id,
    status: TeamInvitationStatus.PENDING,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  },
  data: {
    status: TeamInvitationStatus.ACCEPTED,
    acceptedAt: now,
  },
})
```

If `update.count !== 1`, return stale status. Prefer checking before membership creation or use a nested transaction order that marks first then creates membership, so a stale race does not leave a membership without an accepted invitation. If marking first, rollback by throwing is not needed because the transaction returns without committing only if no writes should remain; structure writes after successful mark.

Recommended order:

```txt
load + validate -> create/find user precheck -> updateMany accepted -> create membership -> return accepted
```

**Step 3: Implement `acceptForExistingUser`**

Inside one `$transaction`:

1. Load invitation by token hash.
2. Require pending and unexpired.
3. Load user by `input.userId`.
4. Require active user email equals invitation email.
5. Check membership by unique `{ userId_tenantId }`; if exists return `alreadyMember`.
6. Mark invitation accepted with `updateMany` preconditions.
7. Create tenant membership.
8. Return accepted user.

Catch Prisma unique membership conflicts and map to `alreadyMember` if a race creates the membership first.

**Step 4: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
```

Expected: PASS.

**Step 5: Typecheck**

```bash
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 4: Add use-case RED tests

**Files:**
- Modify: `viewpro-app/apps/api/test/team-invitations.use-cases.spec.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/validate-team-invitation.use-case.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/accept-team-invitation.use-case.ts`

**Step 1: Write validate use-case tests**

Test:

- hashes raw token before repository call;
- returns `TeamInvitationPublicResponse` for valid invitation;
- maps `notFound` to `NotFoundException`;
- maps `expired`, `revoked`, and `alreadyAccepted` to `GoneException` with distinct safe messages;
- never includes `tokenHash` or raw token in response.

**Step 2: Write accept use-case tests**

Test register mode:

- trims first/last name;
- requires first name;
- hashes password;
- calls `acceptForNewUser` with token hash;
- creates auth session from accepted user;
- maps `userAlreadyExists` to `ConflictException`.

Test login mode:

- validates invitation first to get the invited email;
- loads existing user by invited email;
- verifies password using `PASSWORD_HASHER`;
- rejects invalid password with `UnauthorizedException('Invalid email or password')`;
- calls `acceptForExistingUser` with existing user id;
- returns session including memberships.

Test current-session mode:

- requires a provided current user;
- rejects current user email mismatch with `ForbiddenException`;
- calls `acceptForExistingUser` with current user id;
- returns session.

Test stale/error mappings:

- `notFound` -> 404;
- `expired`, `revoked`, `alreadyAccepted` -> 410;
- `alreadyMember` -> 409;
- `emailMismatch` -> 403;
- `userNotFound` -> 401 or 404-safe auth failure.

**Step 3: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
```

Expected: FAIL because use cases do not exist.

## Task 5: Implement validate and accept use cases

**Files:**
- Create: `viewpro-app/apps/api/src/team/use-cases/validate-team-invitation.use-case.ts`
- Create: `viewpro-app/apps/api/src/team/use-cases/accept-team-invitation.use-case.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`

**Step 1: Implement `ValidateTeamInvitationUseCase`**

Dependencies:

- `TEAM_INVITATIONS_REPOSITORY`

Implementation shape:

```ts
@Injectable()
export class ValidateTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
  ) {}

  async execute(rawToken: string) {
    const result = await this.teamInvitationsRepository.validateByTokenHash({
      tokenHash: hashTeamInvitationToken(rawToken),
      now: new Date(),
    })

    if (result.status === 'notFound') throw new NotFoundException('Team invitation not found')
    if (result.status === 'expired') throw new GoneException('Team invitation has expired')
    if (result.status === 'revoked') throw new GoneException('Team invitation is no longer available')
    if (result.status === 'alreadyAccepted') throw new GoneException('Team invitation was already accepted')

    return toTeamInvitationPublicResponse(result.invitation, result.emailRegistered)
  }
}
```

**Step 2: Implement `AcceptTeamInvitationUseCase`**

Dependencies:

- `TEAM_INVITATIONS_REPOSITORY`
- `USERS_REPOSITORY`
- `MEMBERSHIPS_REPOSITORY`
- `PASSWORD_HASHER`
- `REFRESH_TOKEN_REPOSITORY`
- `TokenService`

Input current user type:

```ts
import type { CurrentUser } from '../../auth/types/current-user'
```

Execute signature:

```ts
async execute(rawToken: string, dto: AcceptTeamInvitationDto, currentUser?: CurrentUser | null): Promise<AuthSessionResult>
```

Implement branches:

- `register`: validate names, hash password, `acceptForNewUser`.
- `login`: validate invitation, find user by invitation email, verify password, `acceptForExistingUser`.
- `current-session`: require `currentUser`, validate invitation email equals `currentUser.email`, `acceptForExistingUser`.

After accepted result:

```ts
const accessToken = await this.tokenService.signAccessToken({ sub: user.id, email: user.email })
const refreshToken = this.tokenService.generateRefreshToken()
await this.refreshTokenRepository.create({
  userId: user.id,
  tokenHash: this.tokenService.hashRefreshToken(refreshToken),
  expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
})
const memberships = await this.membershipsRepository.findManyByUserId(user.id)
return {
  accessToken,
  refreshToken,
  body: { user: mapAuthUser(user), memberships: memberships.map(mapMembership) },
}
```

**Step 3: Wire module providers/imports**

Modify `team.module.ts`:

- import `UsersModule` because `AcceptTeamInvitationUseCase` injects `USERS_REPOSITORY`;
- add `ValidateTeamInvitationUseCase` and `AcceptTeamInvitationUseCase` providers.

```ts
imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule, UsersModule]
```

**Step 4: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 6: Add public controller and API e2e tests

**Files:**
- Create: `viewpro-app/apps/api/src/team/team-invitations-public.controller.ts`
- Modify: `viewpro-app/apps/api/src/team/team.module.ts`
- Create: `viewpro-app/apps/api/test/team-invitations.e2e-spec.ts`

**Step 1: Write RED e2e tests**

Create tests for:

- `GET /team-invitations/:token` returns safe metadata without auth.
- validate returns `404` for unknown token.
- validate returns `410` for expired/revoked/accepted invitation.
- `POST /team-invitations/:token/accept` register mode sets auth cookies and returns `MeResponse` with invited tenant membership.
- register mode rejects an already registered email with `409`.
- login mode accepts existing global user with correct password.
- login mode rejects wrong password.
- current-session mode accepts when access-token cookie belongs to the invited email.
- current-session mode rejects another logged-in email.
- accepted invitation cannot be accepted again.

Use existing `owner-invitations.e2e-spec.ts`, `team.e2e-spec.ts`, and auth e2e helpers as patterns.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
```

Expected: FAIL because controller does not exist.

**Step 3: Implement public controller**

```ts
import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants'
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard'
import { TokenService } from '../auth/tokens/token.service'
import type { CurrentUser } from '../auth/types/current-user'
import { getAuthRateLimitConfig } from '../config/app.config'
import { AcceptTeamInvitationDto } from './dto/accept-team-invitation.dto'
import { AcceptTeamInvitationUseCase } from './use-cases/accept-team-invitation.use-case'
import { ValidateTeamInvitationUseCase } from './use-cases/validate-team-invitation.use-case'

const authRateLimit = getAuthRateLimitConfig()

function toThrottleOptions(config: { limit: number; ttlSeconds: number }) {
  return { default: { limit: config.limit, ttl: config.ttlSeconds * 1000 } }
}

@Controller('team-invitations')
export class TeamInvitationsPublicController {
  constructor(
    @Inject(ValidateTeamInvitationUseCase)
    private readonly validateTeamInvitationUseCase: ValidateTeamInvitationUseCase,
    @Inject(AcceptTeamInvitationUseCase)
    private readonly acceptTeamInvitationUseCase: AcceptTeamInvitationUseCase,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.validateTeamInvitationUseCase.execute(token)
  }

  @Post(':token/accept')
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.register))
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptTeamInvitationDto,
    @Req() request: Request & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentUser = await this.getOptionalCurrentUser(request)
    const result = await this.acceptTeamInvitationUseCase.execute(token, dto, currentUser)
    this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
    return result.body
  }

  private async getOptionalCurrentUser(
    request: Request & { cookies?: Record<string, string | undefined> },
  ): Promise<CurrentUser | null> {
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE]
    if (!token) return null

    try {
      const payload = await this.tokenService.verifyAccessToken(token)
      return { id: payload.sub, email: payload.email }
    } catch {
      return null
    }
  }
}
```

If the implementation chooses to reject invalid cookies for `current-session`, do that inside the use case when no valid current user is provided.

**Step 4: Wire controller**

In `team.module.ts`:

```ts
controllers: [TeamController, TeamInvitationsPublicController]
```

**Step 5: Run GREEN**

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api typecheck
```

Expected: PASS.

## Task 7: Add app-new team invitation API client

**Files:**
- Create: `viewpro-app/apps/app-new/src/features/team-invitations/api/types.ts`
- Create: `viewpro-app/apps/app-new/src/features/team-invitations/api/service.ts`
- Create: `viewpro-app/apps/app-new/src/features/team-invitations/api/service.test.ts`

**Step 1: Write RED service tests**

Test:

- `getTeamInvitation(token)` calls `/team-invitations/<encoded-token>` with `GET`, `cache: 'no-store'`.
- `acceptTeamInvitation(token, input)` calls `/team-invitations/<encoded-token>/accept` with `POST` and body.

**Step 2: Run RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/api/service.test.ts
```

Expected: FAIL because service does not exist.

**Step 3: Implement types**

```ts
import type { Session } from '@/lib/session'

export type TeamInvitationRole = 'MANAGER' | 'AGENT'

export type TeamInvitationResponse = {
  email: string
  role: TeamInvitationRole
  status: 'PENDING'
  expiresAt: string
  emailRegistered: boolean
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
}

export type AcceptTeamInvitationInput =
  | { mode: 'register'; firstName: string; lastName?: string; password: string }
  | { mode: 'login'; password: string }
  | { mode: 'current-session' }

export type TeamInvitationSession = Session
```

**Step 4: Implement service**

```ts
import { apiRequest } from '@/lib/api-client'
import type { AcceptTeamInvitationInput, TeamInvitationResponse, TeamInvitationSession } from './types'

export function getTeamInvitation(token: string) {
  return apiRequest<TeamInvitationResponse>(`/team-invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    method: 'GET',
  })
}

export function acceptTeamInvitation(token: string, input: AcceptTeamInvitationInput) {
  return apiRequest<TeamInvitationSession>(`/team-invitations/${encodeURIComponent(token)}/accept`, {
    body: input,
    method: 'POST',
  })
}
```

**Step 5: Run GREEN**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/api/service.test.ts
```

Expected: PASS.

## Task 8: Add app-new public page and acceptance view tests

**Files:**
- Create: `viewpro-app/apps/app-new/src/app/team-invitations/[token]/page.tsx`
- Create: `viewpro-app/apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.tsx`
- Create: `viewpro-app/apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx`

**Step 1: Implement the route shell first**

Use the owner invitation page as pattern.

```tsx
import { TeamInvitationAcceptanceView } from '@/features/team-invitations/components/team-invitation-acceptance-view'

export const metadata = {
  robots: { index: false, follow: false },
}

type TeamInvitationPageProps = {
  params: Promise<{ token: string }>
}

export default async function TeamInvitationPage({ params }: TeamInvitationPageProps) {
  const { token } = await params
  return <TeamInvitationAcceptanceView token={token} />
}
```

**Step 2: Write RED acceptance view tests**

Mock:

- `getTeamInvitation`
- `acceptTeamInvitation`
- `getSessionWithRefresh`
- `setSelectedTenantId`
- `next/navigation` router

Test cases:

- loading then register form for `emailRegistered: false`.
- register submit sends `{ mode: 'register', firstName, lastName, password }`.
- existing registered email with matching session shows direct accept button and sends `{ mode: 'current-session' }`.
- existing registered email without session shows password form and sends `{ mode: 'login', password }`.
- logged-in different email shows wrong-account warning and does not allow direct acceptance.
- successful acceptance calls `setSelectedTenantId(invitation.tenant.id)`, pushes `/dashboard`, and refreshes.
- expired/invalid API errors render Spanish error cards.

**Step 3: Run RED**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx
```

Expected: FAIL until component is implemented.

## Task 9: Implement team invitation acceptance view

**Files:**
- Create/modify: `viewpro-app/apps/app-new/src/features/team-invitations/components/team-invitation-acceptance-view.tsx`

**Step 1: Build state loading**

On mount/token change:

- clear previous errors;
- load invitation with `getTeamInvitation(token)`;
- try `getSessionWithRefresh()`; treat 401/403 as no session and other errors as non-blocking session absence unless the product wants stricter behavior.

**Step 2: Define forms**

Use `useAppForm`/`useFormFields` like owner invitations.

Register schema:

```ts
const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Ingresá tu nombre.'),
  lastName: z.string(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
})
```

Login schema:

```ts
const loginSchema = z.object({
  password: z.string().min(8, 'Ingresá tu contraseña.'),
})
```

**Step 3: Determine flow**

```ts
const sessionEmail = session?.user.email.toLowerCase() ?? null
const invitationEmail = invitation.email.toLowerCase()
const isMatchingSession = sessionEmail === invitationEmail
const isWrongSession = Boolean(sessionEmail && sessionEmail !== invitationEmail)
```

Render:

- new user register card when `!invitation.emailRegistered`;
- direct accept card when `invitation.emailRegistered && isMatchingSession`;
- password card when `invitation.emailRegistered && !sessionEmail`;
- wrong account card when `isWrongSession`.

If `invitation.emailRegistered === false` but a matching session exists, prefer a conflict/action card because backend register mode will reject existing user. This should be rare; the validation response is source of truth.

**Step 4: Submit handlers**

On successful `acceptTeamInvitation`:

```ts
const invitedMembership = session.memberships.find(
  (membership) => membership.tenant.id === invitation.tenant.id,
)
setSelectedTenantId(invitedMembership?.tenant.id ?? invitation.tenant.id)
router.push('/dashboard')
router.refresh()
```

**Step 5: Error cards**

Map API errors similar to owner invitation UI:

- `404`: `Link inválido`
- `410` + expired: `Invitación expirada`
- `410` + accepted: `Invitación ya aceptada`
- `409`: `Ya pertenecés a esta inmobiliaria` or safe conflict copy
- `401`: invalid password/session copy
- `403`: wrong account copy

**Step 6: Run GREEN**

```bash
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/api/service.test.ts
```

Expected: PASS.

## Task 10: Focused validation

**Files:**
- No expected source changes unless validation finds issues.

Run from repo root:

```bash
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.repository.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.use-cases.spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team-invitations.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api test test/team.e2e-spec.ts
pnpm --dir viewpro-app --filter @viewpro/api db:validate
pnpm --dir viewpro-app --filter @viewpro/api typecheck
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter test src/features/team-invitations/api/service.test.ts src/features/team-invitations/components/team-invitation-acceptance-view.test.tsx
pnpm --dir viewpro-app --filter next-shadcn-dashboard-starter exec tsc --noEmit
git diff --check
```

Expected: all pass.

If app-new public route tests are added, include them in the focused app-new test command.

## Task 11: Fresh review before final summary

**Files:**
- No source changes unless review finds blockers.

Ask a fresh-context reviewer to inspect the final diff for:

- public/private controller separation;
- no raw token or token hash exposure;
- rate limiting on public accept;
- existing-user email ownership checks;
- same-tenant already-member behavior;
- transactional/race-safe acceptance;
- selected tenant set to the invited tenant;
- app-new copy and error states;
- test coverage for new/existing/current-session flows.

Fix only confirmed blockers or small in-scope issues. Defer broader product improvements.

## Task 12: Stop for user confirmation

Summarize:

- files changed;
- validation evidence;
- fresh review outcome;
- remaining risks/non-goals;
- expected PR size.

Do not create GitHub issue/PR, push, merge, close issue, or delete branches until the user explicitly says to proceed.

## Review-size forecast

This slice will likely exceed 400 changed lines because it touches backend repository/use cases/controller/e2e tests and app-new service/UI/tests. It is cohesive, but before PR creation ask for a size exception or offer to split into:

1. backend acceptance API;
2. app-new public acceptance UI.
