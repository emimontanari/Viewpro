/**
 * WU2b — Registration wiring: mandatory Argentine contact phone (#287).
 *
 * Covers:
 *   RegisterTenantUseCase
 *     - Rejects phone.required / phone.invalid / phone.country_unsupported
 *       before any repository I/O (enumeration protection: `findByEmail` is
 *       never reached when the phone is rejected)
 *     - Success: the canonical E.164 value reaches the registration
 *       repository's `registerTenant()` input
 *
 *   PrismaAuthRegistrationRepository
 *     - `tenant.create` persists the canonical `whatsappPhone`
 *     - `user.create` is called WITHOUT a `whatsappPhone` key (personal /
 *       agency phone separation — spec.md "Personal phone remains untouched")
 */

import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PrismaAuthRegistrationRepository } from '../src/auth/repositories/prisma-auth-registration.repository'
import { RegisterTenantUseCase } from '../src/auth/use-cases/register-tenant.use-case'

const VALID_AR_PHONE = '3510000000'
const CANONICAL_E164 = '+543510000000'

const baseDto = {
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

function buildUseCase() {
  const usersRepository = { findByEmail: vi.fn().mockResolvedValue(null) }
  const tenantsRepository = { findBySlug: vi.fn().mockResolvedValue(null) }
  const passwordHasher = { hash: vi.fn().mockResolvedValue('hashed') }
  const refreshTokenRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const registrationRepository = {
    registerTenant: vi.fn().mockResolvedValue({
      user: { id: 'user-1', email: 'jane@example.com' },
      memberships: [
        {
          id: 'membership-1',
          role: TenantRole.PRINCIPAL_MANAGER,
          tenant: { id: 'tenant-1', name: 'Acme', slug: 'acme', status: 'TRIAL' },
        },
      ],
    }),
  }
  const emailVerificationTokenRepository = { create: vi.fn().mockResolvedValue(undefined) }
  const emailSender = { sendEmailVerification: vi.fn().mockResolvedValue(undefined) }
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

  return { useCase, usersRepository, registrationRepository }
}

describe('RegisterTenantUseCase — mandatory AR contact phone (WU2b)', () => {
  it('rejects an absent phone as phone.required, before checking email existence', async () => {
    const { useCase, usersRepository } = buildUseCase()

    await expect(useCase.execute({ ...baseDto } as never)).rejects.toMatchObject({
      response: { errorCode: 'phone.required' },
    })
    expect(usersRepository.findByEmail).not.toHaveBeenCalled()
  })

  it('rejects an unparseable phone as phone.invalid, before checking email existence', async () => {
    const { useCase, usersRepository } = buildUseCase()

    await expect(
      useCase.execute({ ...baseDto, whatsappPhone: '123' } as never),
    ).rejects.toMatchObject({
      response: { errorCode: 'phone.invalid' },
    })
    expect(usersRepository.findByEmail).not.toHaveBeenCalled()
  })

  it('rejects a valid non-AR phone as phone.country_unsupported, before checking email existence', async () => {
    const { useCase, usersRepository } = buildUseCase()

    await expect(
      useCase.execute({ ...baseDto, whatsappPhone: '+56912345678' } as never),
    ).rejects.toMatchObject({
      response: { errorCode: 'phone.country_unsupported' },
    })
    expect(usersRepository.findByEmail).not.toHaveBeenCalled()
  })

  it('throws BadRequestException (not another type) for a rejected phone', async () => {
    const { useCase } = buildUseCase()

    await expect(useCase.execute({ ...baseDto } as never)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('passes the canonical E.164 value through to the registration repository on success', async () => {
    const { useCase, registrationRepository } = buildUseCase()

    await useCase.execute({ ...baseDto, whatsappPhone: VALID_AR_PHONE } as never)

    expect(registrationRepository.registerTenant).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappPhone: CANONICAL_E164 }),
    )
  })
})

describe('PrismaAuthRegistrationRepository — agency phone lands on Tenant only (WU2b)', () => {
  function buildMockPrisma() {
    const userCreate = vi.fn().mockResolvedValue({ id: 'user-1', email: 'owner@acme.com' })
    const tenantCreate = vi.fn().mockResolvedValue({
      id: 'tenant-1',
      name: 'Acme',
      slug: 'acme',
      status: 'TRIAL',
      maxUsers: 10,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: 500,
    })
    const membershipCreate = vi.fn().mockResolvedValue({
      id: 'membership-1',
      role: TenantRole.PRINCIPAL_MANAGER,
      tenant: { id: 'tenant-1' },
    })

    const mockTx: Partial<Prisma.TransactionClient> = {
      user: { create: userCreate } as never,
      tenant: { create: tenantCreate } as never,
      tenantMembership: { create: membershipCreate } as never,
    }

    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          fn(mockTx as Prisma.TransactionClient),
        ),
    }

    return { prisma, userCreate, tenantCreate }
  }

  function buildMockOutboxWriter() {
    return { emit: vi.fn().mockResolvedValue(undefined) }
  }

  it("tenant.create persists the canonical whatsappPhone", async () => {
    const { prisma, tenantCreate } = buildMockPrisma()
    const repo = new PrismaAuthRegistrationRepository(prisma as never, buildMockOutboxWriter() as never)

    await repo.registerTenant({
      email: 'owner@acme.com',
      passwordHash: 'hashed',
      firstName: 'Alice',
      tenantName: 'Acme',
      tenantSlug: 'acme',
      role: TenantRole.PRINCIPAL_MANAGER,
      whatsappPhone: CANONICAL_E164,
    })

    const [createArgs] = tenantCreate.mock.calls[0]!
    expect(createArgs.data.whatsappPhone).toBe(CANONICAL_E164)
  })

  it('user.create is called without a whatsappPhone key (personal phone stays untouched)', async () => {
    const { prisma, userCreate } = buildMockPrisma()
    const repo = new PrismaAuthRegistrationRepository(prisma as never, buildMockOutboxWriter() as never)

    await repo.registerTenant({
      email: 'owner@acme.com',
      passwordHash: 'hashed',
      firstName: 'Alice',
      tenantName: 'Acme',
      tenantSlug: 'acme',
      role: TenantRole.PRINCIPAL_MANAGER,
      whatsappPhone: CANONICAL_E164,
    })

    const [createArgs] = userCreate.mock.calls[0]!
    expect(createArgs.data).not.toHaveProperty('whatsappPhone')
  })
})
