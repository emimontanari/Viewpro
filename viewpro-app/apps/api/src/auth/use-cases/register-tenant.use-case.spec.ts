import { GlobalRole, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { RegisterTenantUseCase } from './register-tenant.use-case'

const createdUser = {
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'hashed',
  firstName: 'Jane',
  lastName: null,
  status: UserStatus.ACTIVE,
  globalRole: GlobalRole.USER,
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

const createdMembership = {
  id: 'membership-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: TenantRole.PRINCIPAL_MANAGER,
  status: 'ACTIVE',
  tenant: { id: 'tenant-1', name: 'Acme', slug: 'acme', status: TenantStatus.TRIAL },
}

const dto = {
  email: 'Jane@Example.com',
  password: 'super-secret',
  firstName: 'Jane',
  tenantName: 'Acme',
}

function buildTokenService() {
  return {
    signAccessToken: vi.fn().mockResolvedValue('access-token'),
    generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    hashRefreshToken: vi.fn().mockReturnValue('refresh-hash'),
    getRefreshTokenExpiresAt: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00.000Z')),
    generateEmailVerificationToken: vi.fn().mockReturnValue('raw-token'),
    hashEmailVerificationToken: vi.fn().mockReturnValue('hashed-token'),
    getEmailVerificationExpiresAt: vi.fn().mockReturnValue(new Date('2026-07-21T00:00:00.000Z')),
  }
}

function buildDeps(overrides: { emailSender?: unknown } = {}) {
  const usersRepository = { findByEmail: vi.fn().mockResolvedValue(null) }
  const tenantsRepository = { findBySlug: vi.fn().mockResolvedValue(null) }
  const passwordHasher = { hash: vi.fn().mockResolvedValue('hashed') }
  const refreshTokenRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const registrationRepository = {
    registerTenant: vi.fn().mockResolvedValue({ user: createdUser, memberships: [createdMembership] }),
  }
  const emailVerificationTokenRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const emailSender = overrides.emailSender ?? {
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  }
  const configService = { getOrThrow: vi.fn().mockReturnValue('https://app.inmoview.app') }
  const useCase = new RegisterTenantUseCase(
    usersRepository as never,
    tenantsRepository as never,
    passwordHasher as never,
    refreshTokenRepository as never,
    registrationRepository as never,
    emailVerificationTokenRepository as never,
    emailSender as never,
    buildTokenService() as never,
    configService as never,
  )
  return { useCase, emailVerificationTokenRepository, emailSender }
}

describe('RegisterTenantUseCase', () => {
  it('registers the tenant and best-effort sends a verification email', async () => {
    const deps = buildDeps()

    const result = await deps.useCase.execute(dto)

    expect(result.body.user.id).toBe('user-1')
    expect(deps.emailVerificationTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', tokenHash: 'hashed-token' }),
    )
    expect((deps.emailSender as { sendEmailVerification: ReturnType<typeof vi.fn> }).sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        verificationUrl: 'https://app.inmoview.app/auth/verify-email?token=raw-token',
      }),
    )
  })

  it('still completes registration when the verification email fails (soft verification)', async () => {
    const deps = buildDeps({
      emailSender: { sendEmailVerification: vi.fn().mockRejectedValue(new Error('resend down')) },
    })

    const result = await deps.useCase.execute(dto)

    expect(result.body.user.id).toBe('user-1')
    expect(result.accessToken).toBe('access-token')
  })
})
