import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArgumentsHost, ExecutionContext } from '@nestjs/common'
import { HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AuthGuard } from '../src/auth/guards/auth.guard'
import { GetCurrentUserUseCase } from '../src/auth/use-cases/get-current-user.use-case'
import { RefreshSessionUseCase } from '../src/auth/use-cases/refresh-session.use-case'
import { ResetPasswordUseCase } from '../src/auth/use-cases/reset-password.use-case'
import { VerifyEmailUseCase } from '../src/auth/use-cases/verify-email.use-case'
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter'
import { AcceptOwnerInvitationUseCase } from '../src/owner-invitations/use-cases/accept-owner-invitation.use-case'
import { ValidateOwnerInvitationUseCase } from '../src/owner-invitations/use-cases/validate-owner-invitation.use-case'
import { AcceptTeamInvitationUseCase } from '../src/team/use-cases/accept-team-invitation.use-case'
import { ValidateTeamInvitationUseCase } from '../src/team/use-cases/validate-team-invitation.use-case'
import { RegisterTenantUseCase } from '../src/auth/use-cases/register-tenant.use-case'
import { UpdateTenantWhatsappPhoneUseCase } from '../src/tenants/use-cases/update-tenant-whatsapp-phone.use-case'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Hermetic production-mode boundary (ADR-2): the filter is constructed
 * directly with nodeEnv = 'production' so `sanitizeProductionMessage`
 * activates without mutating `process.env.NODE_ENV` for the whole worker.
 */
function catchThroughProductionFilter(exception: unknown) {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, setHeader: vi.fn() }),
      getRequest: () => ({ url: '/api/boundary-test', requestId: 'boundary-request-id' }),
    }),
  } as ArgumentsHost

  new GlobalExceptionFilter('production', undefined, {}).catch(exception, host)

  return json.mock.calls[0]?.[0]
}

async function throwFrom(operation: () => Promise<unknown> | unknown): Promise<unknown> {
  try {
    await operation()
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    return error
  }

  throw new Error('expected operation to throw')
}

function readSource(relativePath: string) {
  return readFileSync(join(apiRoot, 'src', relativePath), 'utf8')
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length
}

describe('Public error annotations — production emission boundary (WU-A)', () => {
  it('AuthGuard rejects a missing session cookie as SESSION_EXPIRED', async () => {
    const guard = new AuthGuard({ verifyAccessToken: vi.fn() } as never)
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: {} }) }),
    } as unknown as ExecutionContext

    const thrown = await throwFrom(() => guard.canActivate(context))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('GetCurrentUserUseCase rejects an inactive or missing user as SESSION_EXPIRED', async () => {
    const useCase = new GetCurrentUserUseCase(
      { findById: vi.fn().mockResolvedValue(null) } as never,
      { findActiveManyByUserId: vi.fn() } as never,
    )

    const thrown = await throwFrom(() => useCase.execute('user-1'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('RefreshSessionUseCase rejects a missing refresh token as SESSION_EXPIRED', async () => {
    const useCase = new RefreshSessionUseCase(
      { findByTokenHash: vi.fn() } as never,
      { hashRefreshToken: vi.fn() } as never,
      { execute: vi.fn() } as never,
    )

    const thrown = await throwFrom(() => useCase.execute(undefined))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('VerifyEmailUseCase rejects an invalid or expired token as AUTH_TOKEN_INVALID', async () => {
    const useCase = new VerifyEmailUseCase(
      { findByTokenHash: vi.fn().mockResolvedValue(null) } as never,
      { markEmailVerified: vi.fn() } as never,
      { hashEmailVerificationToken: vi.fn().mockReturnValue('hashed-token') } as never,
    )

    const thrown = await throwFrom(() => useCase.execute({ token: 'invalid-token' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid request payload',
    })
  })

  it('ResetPasswordUseCase rejects an invalid or expired token as AUTH_TOKEN_INVALID', async () => {
    const useCase = new ResetPasswordUseCase(
      { findByTokenHash: vi.fn().mockResolvedValue(null) } as never,
      { updatePassword: vi.fn() } as never,
      { hash: vi.fn() } as never,
      { revokeAllForUser: vi.fn() } as never,
      { hashPasswordResetToken: vi.fn().mockReturnValue('hashed-token') } as never,
    )

    const thrown = await throwFrom(() => useCase.execute({ token: 'invalid-token', password: 'new-Password1!' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'AUTH_TOKEN_INVALID',
      message: 'Invalid request payload',
    })
  })
})

describe('Public error annotations — per-file exhaustiveness guard (WU-A)', () => {
  it('auth.guard.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/guards/auth.guard.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('get-current-user.use-case.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/get-current-user.use-case.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('refresh-session.use-case.ts annotates every UnauthorizedException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/refresh-session.use-case.ts')

    expect(countMatches(source, /throw new UnauthorizedException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  // BadRequestException is deliberately excluded from the shared exhaustiveness pattern
  // (design.md ADR-2) because other in-scope files carry unrelated DTO-validation throws
  // that must stay unannotated. verify-email.use-case.ts and reset-password.use-case.ts
  // carry no other BadRequestException, so the file-scoped count is exact here.
  it('verify-email.use-case.ts annotates its BadRequestException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/verify-email.use-case.ts')

    expect(countMatches(source, /throw new BadRequestException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('reset-password.use-case.ts annotates its BadRequestException throw with an errorCode', () => {
    const source = readSource('auth/use-cases/reset-password.use-case.ts')

    expect(countMatches(source, /throw new BadRequestException\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  it('excludes login.use-case.ts and register-tenant.use-case.ts from the guard scope (enumeration protection)', () => {
    const loginSource = readSource('auth/use-cases/login.use-case.ts')
    const registerTenantSource = readSource('auth/use-cases/register-tenant.use-case.ts')

    expect(countMatches(loginSource, /errorCode:/g)).toBe(0)
    expect(countMatches(registerTenantSource, /errorCode:/g)).toBe(0)
  })
})

/**
 * Minimal deps for AcceptTeamInvitationUseCase (WU-B1). Only the collaborator
 * needed by the exercised throw path is given a meaningful mock; the rest
 * are unused stubs, matching the pattern in team-invitations.use-cases.spec.ts.
 */
function createAcceptTeamInvitationUseCase(overrides: { repository?: Record<string, unknown> } = {}) {
  const repository = {
    validateByTokenHash: vi.fn(),
    acceptForNewUser: vi.fn(),
    acceptForExistingUser: vi.fn(),
    ...overrides.repository,
  }

  return new AcceptTeamInvitationUseCase(
    repository as never,
    { findByEmail: vi.fn(), findById: vi.fn() } as never,
    { findActiveManyByUserId: vi.fn() } as never,
    { hash: vi.fn(), verify: vi.fn() } as never,
    { create: vi.fn() } as never,
    { signAccessToken: vi.fn(), generateRefreshToken: vi.fn(), hashRefreshToken: vi.fn(), getRefreshTokenExpiresAt: vi.fn() } as never,
  )
}

describe('Public error annotations — production emission boundary (WU-B1)', () => {
  it('ValidateTeamInvitationUseCase rejects a missing token as INVITATION_NOT_FOUND', async () => {
    const useCase = new ValidateTeamInvitationUseCase({
      validateByTokenHash: vi.fn().mockResolvedValue({ status: 'notFound' }),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('missing-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_NOT_FOUND',
      message: 'Resource not found',
    })
  })

  it('ValidateTeamInvitationUseCase rejects an expired token as INVITATION_EXPIRED', async () => {
    const useCase = new ValidateTeamInvitationUseCase({
      validateByTokenHash: vi.fn().mockResolvedValue({ status: 'expired' }),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('expired-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('ValidateTeamInvitationUseCase rejects a revoked token as INVITATION_REVOKED', async () => {
    const useCase = new ValidateTeamInvitationUseCase({
      validateByTokenHash: vi.fn().mockResolvedValue({ status: 'revoked' }),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('revoked-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_REVOKED',
      message: 'Request failed',
    })
  })

  it('ValidateTeamInvitationUseCase rejects an already-accepted token as INVITATION_ALREADY_ACCEPTED', async () => {
    const useCase = new ValidateTeamInvitationUseCase({
      validateByTokenHash: vi.fn().mockResolvedValue({ status: 'alreadyAccepted' }),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('accepted-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_ALREADY_ACCEPTED',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a mismatched authenticated email as INVITATION_EMAIL_MISMATCH', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        validateByTokenHash: vi.fn().mockResolvedValue({
          status: 'valid',
          invitation: { email: 'invited@example.com' },
          emailRegistered: true,
        }),
      },
    })

    const thrown = await throwFrom(() =>
      useCase.execute(
        'raw-token',
        { mode: 'current-session' },
        { id: 'other-user', email: 'other@example.com' },
      ),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EMAIL_MISMATCH',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a wrong login-mode password as INVITATION_INVALID_CREDENTIALS', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        validateByTokenHash: vi.fn().mockResolvedValue({
          status: 'valid',
          invitation: { email: 'invited@example.com' },
          emailRegistered: true,
        }),
      },
    })

    const thrown = await throwFrom(() => useCase.execute('raw-token', { mode: 'login', password: 'wrong-password' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_INVALID_CREDENTIALS',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a current-session acceptance without an authenticated user as SESSION_EXPIRED', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        validateByTokenHash: vi.fn().mockResolvedValue({
          status: 'valid',
          invitation: { email: 'invited@example.com' },
          emailRegistered: true,
        }),
      },
    })

    const thrown = await throwFrom(() => useCase.execute('raw-token', { mode: 'current-session' }, null))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a register-mode acceptance already claimed by another member as INVITATION_ALREADY_MEMBER', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        acceptForNewUser: vi.fn().mockResolvedValue({ status: 'alreadyMember' }),
      },
    })

    const thrown = await throwFrom(() =>
      useCase.execute('raw-token', { mode: 'register', firstName: 'New', password: 'password123' }),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_ALREADY_MEMBER',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a register-mode acceptance for an already-registered email as INVITATION_EMAIL_ALREADY_REGISTERED', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        acceptForNewUser: vi.fn().mockResolvedValue({ status: 'userAlreadyExists' }),
      },
    })

    const thrown = await throwFrom(() =>
      useCase.execute('raw-token', { mode: 'register', firstName: 'New', password: 'password123' }),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EMAIL_ALREADY_REGISTERED',
      message: 'Request failed',
    })
  })

  it('AcceptTeamInvitationUseCase rejects a register-mode acceptance over the tenant user limit as TENANT_USER_LIMIT_EXCEEDED', async () => {
    const useCase = createAcceptTeamInvitationUseCase({
      repository: {
        acceptForNewUser: vi.fn().mockResolvedValue({ status: 'tenantUserLimitExceeded' }),
      },
    })

    const thrown = await throwFrom(() =>
      useCase.execute('raw-token', { mode: 'register', firstName: 'New', password: 'password123' }),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'TENANT_USER_LIMIT_EXCEEDED',
      message: 'Request failed',
    })
  })
})

describe('Public error annotations — per-file exhaustiveness guard (WU-B1)', () => {
  it('validate-team-invitation.use-case.ts annotates every NotFoundException/GoneException throw with an errorCode', () => {
    const source = readSource('team/use-cases/validate-team-invitation.use-case.ts')

    expect(countMatches(source, /throw new (?:NotFoundException|GoneException)\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  // BadRequestException is deliberately excluded from the shared exhaustiveness pattern
  // (design.md ADR-2) because the four DTO-validation throws in this file
  // (first-name, password x2, unsupported mode) stay unannotated by scope.
  it('accept-team-invitation.use-case.ts annotates every Forbidden/Unauthorized/NotFound/Gone/ConflictException throw with an errorCode', () => {
    const source = readSource('team/use-cases/accept-team-invitation.use-case.ts')

    expect(
      countMatches(
        source,
        /throw new (?:ForbiddenException|UnauthorizedException|NotFoundException|GoneException|ConflictException)\(/g,
      ),
    ).toBe(countMatches(source, /errorCode:/g))
  })
})

/**
 * Minimal deps for AcceptOwnerInvitationUseCase (WU-B2). Only the collaborator
 * needed by the exercised throw path is given a meaningful mock; the rest
 * are unused stubs, matching the pattern used for WU-B1.
 */
function createAcceptOwnerInvitationUseCase(overrides: { repository?: Record<string, unknown> } = {}) {
  const repository = {
    findByTokenHash: vi.fn(),
    findUserByEmail: vi.fn(),
    acceptForNewOwner: vi.fn(),
    acceptForExistingOwner: vi.fn(),
    ...overrides.repository,
  }

  return new AcceptOwnerInvitationUseCase(
    repository as never,
    { hash: vi.fn(), verify: vi.fn() } as never,
    { create: vi.fn() } as never,
    { signAccessToken: vi.fn(), generateRefreshToken: vi.fn(), hashRefreshToken: vi.fn(), getRefreshTokenExpiresAt: vi.fn() } as never,
  )
}

function validOwnerInvitation(overrides: Record<string, unknown> = {}) {
  return {
    status: 'PENDING',
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    email: 'invited@example.com',
    ...overrides,
  }
}

describe('Public error annotations — production emission boundary (WU-B2)', () => {
  it('ValidateOwnerInvitationUseCase rejects a missing token as INVITATION_NOT_FOUND', async () => {
    const useCase = new ValidateOwnerInvitationUseCase({
      findByTokenHash: vi.fn().mockResolvedValue(null),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('missing-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_NOT_FOUND',
      message: 'Resource not found',
    })
  })

  it('ValidateOwnerInvitationUseCase rejects an expired token as INVITATION_EXPIRED', async () => {
    const useCase = new ValidateOwnerInvitationUseCase({
      findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation({ expiresAt: new Date(Date.now() - 1000) })),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('expired-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('ValidateOwnerInvitationUseCase rejects a revoked token as INVITATION_REVOKED', async () => {
    const useCase = new ValidateOwnerInvitationUseCase({
      findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation({ status: 'REVOKED', revokedAt: new Date() })),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('revoked-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_REVOKED',
      message: 'Request failed',
    })
  })

  it('ValidateOwnerInvitationUseCase rejects an already-accepted token as INVITATION_ALREADY_ACCEPTED', async () => {
    const useCase = new ValidateOwnerInvitationUseCase({
      findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation({ status: 'ACCEPTED', acceptedAt: new Date() })),
    } as never)

    const thrown = await throwFrom(() => useCase.execute('accepted-token'))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_ALREADY_ACCEPTED',
      message: 'Request failed',
    })
  })

  it('AcceptOwnerInvitationUseCase rejects a mismatched authenticated email as INVITATION_EMAIL_MISMATCH', async () => {
    const useCase = createAcceptOwnerInvitationUseCase({
      repository: { findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation()) },
    })

    const thrown = await throwFrom(() =>
      useCase.execute(
        'raw-token',
        { mode: 'current-session' },
        { id: 'other-user', email: 'other@example.com' },
      ),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EMAIL_MISMATCH',
      message: 'Request failed',
    })
  })

  it('AcceptOwnerInvitationUseCase rejects a wrong login-mode password as INVITATION_INVALID_CREDENTIALS', async () => {
    const useCase = createAcceptOwnerInvitationUseCase({
      repository: {
        findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation()),
        findUserByEmail: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: 'hashed' }),
      },
    })

    const thrown = await throwFrom(() => useCase.execute('raw-token', { mode: 'login', password: 'wrong-password' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_INVALID_CREDENTIALS',
      message: 'Request failed',
    })
  })

  it('AcceptOwnerInvitationUseCase rejects a current-session acceptance without an authenticated user as SESSION_EXPIRED', async () => {
    const useCase = createAcceptOwnerInvitationUseCase({
      repository: { findByTokenHash: vi.fn().mockResolvedValue(validOwnerInvitation()) },
    })

    const thrown = await throwFrom(() => useCase.execute('raw-token', { mode: 'current-session' }, null))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'SESSION_EXPIRED',
      message: 'Request failed',
    })
  })

  it('AcceptOwnerInvitationUseCase rejects a register-mode acceptance for an already-registered email as INVITATION_EMAIL_ALREADY_REGISTERED', async () => {
    const useCase = createAcceptOwnerInvitationUseCase({
      repository: {
        acceptForNewOwner: vi.fn().mockResolvedValue({ status: 'userAlreadyExists' }),
      },
    })

    const thrown = await throwFrom(() =>
      useCase.execute('raw-token', { mode: 'register', firstName: 'New', password: 'password123' }),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'INVITATION_EMAIL_ALREADY_REGISTERED',
      message: 'Request failed',
    })
  })
})

describe('Public error annotations — per-file exhaustiveness guard (WU-B2)', () => {
  it('validate-owner-invitation.use-case.ts annotates every NotFoundException/GoneException throw with an errorCode', () => {
    const source = readSource('owner-invitations/use-cases/validate-owner-invitation.use-case.ts')

    expect(countMatches(source, /throw new (?:NotFoundException|GoneException)\(/g)).toBe(
      countMatches(source, /errorCode:/g),
    )
  })

  // BadRequestException is deliberately excluded from the shared exhaustiveness pattern
  // (design.md ADR-2) because the three DTO-validation throws in this file
  // (first-name, password, unsupported mode) stay unannotated by scope.
  it('accept-owner-invitation.use-case.ts annotates every Forbidden/Unauthorized/NotFound/Gone/ConflictException throw with an errorCode', () => {
    const source = readSource('owner-invitations/use-cases/accept-owner-invitation.use-case.ts')

    expect(
      countMatches(
        source,
        /throw new (?:ForbiddenException|UnauthorizedException|NotFoundException|GoneException|ConflictException)\(/g,
      ),
    ).toBe(countMatches(source, /errorCode:/g))
  })
})

/**
 * Minimal deps for RegisterTenantUseCase (WU2b). Every collaborator is an
 * unused stub except the ones needed to reach `execute`'s constructor —
 * `parseArContactPhone` runs as the first statement and throws before any
 * of them are invoked, so none need meaningful mock behavior here.
 */
function createRegisterTenantUseCase() {
  return new RegisterTenantUseCase(
    { findByEmail: vi.fn() } as never,
    { findBySlug: vi.fn() } as never,
    { hash: vi.fn() } as never,
    { create: vi.fn() } as never,
    { registerTenant: vi.fn() } as never,
    { create: vi.fn() } as never,
    { sendEmailVerification: vi.fn() } as never,
    {
      signAccessToken: vi.fn(),
      generateRefreshToken: vi.fn(),
      hashRefreshToken: vi.fn(),
      getRefreshTokenExpiresAt: vi.fn(),
      generateEmailVerificationToken: vi.fn(),
      hashEmailVerificationToken: vi.fn(),
      getEmailVerificationExpiresAt: vi.fn(),
    } as never,
    { getOrThrow: vi.fn() } as never,
  )
}

const registerTenantBaseDto = { email: 'a@b.com', password: 'password123', firstName: 'A', tenantName: 'T' }

describe('Public error annotations — production emission boundary (WU2b)', () => {
  it('RegisterTenantUseCase rejects an absent phone as phone.required', async () => {
    const useCase = createRegisterTenantUseCase()

    const thrown = await throwFrom(() => useCase.execute({ ...registerTenantBaseDto } as never))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.required',
      message: 'Invalid request payload',
    })
  })

  it('RegisterTenantUseCase rejects an unparseable phone as phone.invalid', async () => {
    const useCase = createRegisterTenantUseCase()

    const thrown = await throwFrom(() =>
      useCase.execute({ ...registerTenantBaseDto, whatsappPhone: '123' } as never),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.invalid',
      message: 'Invalid request payload',
    })
  })

  it('RegisterTenantUseCase rejects a valid non-AR phone as phone.country_unsupported', async () => {
    const useCase = createRegisterTenantUseCase()

    const thrown = await throwFrom(() =>
      useCase.execute({ ...registerTenantBaseDto, whatsappPhone: '+56912345678' } as never),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.country_unsupported',
      message: 'Invalid request payload',
    })
  })
})

/**
 * Minimal deps for UpdateTenantWhatsappPhoneUseCase (WU4). `parseArContactPhone`
 * runs before any repository call, so the repository mock never needs to
 * resolve meaningfully for these three rejection cases.
 */
function createUpdateTenantWhatsappPhoneUseCase() {
  return new UpdateTenantWhatsappPhoneUseCase({ updateWhatsappPhone: vi.fn() } as never)
}

describe('Public error annotations — production emission boundary (WU4)', () => {
  it('UpdateTenantWhatsappPhoneUseCase rejects null as phone.required', async () => {
    const useCase = createUpdateTenantWhatsappPhoneUseCase()

    const thrown = await throwFrom(() => useCase.execute({ tenantId: 'tenant-1', whatsappPhone: null }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.required',
      message: 'Invalid request payload',
    })
  })

  it('UpdateTenantWhatsappPhoneUseCase rejects an unparseable phone as phone.invalid', async () => {
    const useCase = createUpdateTenantWhatsappPhoneUseCase()

    const thrown = await throwFrom(() => useCase.execute({ tenantId: 'tenant-1', whatsappPhone: '123' }))

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.invalid',
      message: 'Invalid request payload',
    })
  })

  it('UpdateTenantWhatsappPhoneUseCase rejects a valid non-AR phone as phone.country_unsupported', async () => {
    const useCase = createUpdateTenantWhatsappPhoneUseCase()

    const thrown = await throwFrom(() =>
      useCase.execute({ tenantId: 'tenant-1', whatsappPhone: '+56912345678' }),
    )

    expect(catchThroughProductionFilter(thrown)).toMatchObject({
      errorCode: 'phone.country_unsupported',
      message: 'Invalid request payload',
    })
  })
})
