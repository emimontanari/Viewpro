import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException } from '@nestjs/common'
import { CreateOperatorUseCase } from '../create-operator.use-case'
import type { IOperatorRepository } from '../../../auth/repositories/operator.repository'
import type { IPasswordHasher } from '../../../auth/security/password-hasher'
import type { AuditLogRepository } from '../../../platform-data/audit-log.repository'

/**
 * T1.3.1 — RED: `CreateOperatorUseCase` — Argon2 hash via the DI
 * PASSWORD_HASHER, explicit role persisted (never rely on the ANALYST DB
 * default), email normalized, duplicate-email → distinct error type, native
 * audit entry appended on success.
 */
const ACTOR = { id: 'op-owner-1', email: 'owner@viewpro.app' }

class P2002Error extends Error {
  code = 'P2002'
}

describe('CreateOperatorUseCase (T1.3.1)', () => {
  let useCase: CreateOperatorUseCase
  let operatorRepository: IOperatorRepository
  let passwordHasher: IPasswordHasher
  let auditLogRepo: Pick<AuditLogRepository, 'appendNative'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: 'op-new-1',
        email: 'new@viewpro.app',
        role: 'OPERATIONS',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      list: vi.fn(),
      updateRole: vi.fn(),
      updateStatus: vi.fn(),
      countActiveOwners: vi.fn(),
    }
    passwordHasher = {
      hash: vi.fn().mockResolvedValue('$argon2id$hashed-temp-password'),
      verify: vi.fn(),
    }
    auditLogRepo = {
      appendNative: vi.fn().mockResolvedValue(undefined),
    }

    useCase = new CreateOperatorUseCase(
      operatorRepository,
      passwordHasher,
      auditLogRepo as AuditLogRepository,
    )
  })

  it('hashes the temp password via the injected IPasswordHasher (Argon2), never storing the raw password', async () => {
    await useCase.execute(
      { email: 'New@Viewpro.App', role: 'OPERATIONS', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(passwordHasher.hash).toHaveBeenCalledWith('a-strong-temp-pw12')
    expect(operatorRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: '$argon2id$hashed-temp-password' }),
    )
  })

  it('persists the EXPLICITLY given role — never relies on the ANALYST DB default', async () => {
    await useCase.execute(
      { email: 'new@viewpro.app', role: 'OWNER', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(operatorRepository.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'OWNER' }))
  })

  it('normalizes email (lowercase/trim) before passing to the repository', async () => {
    await useCase.execute(
      { email: '  MixedCase@Viewpro.App  ', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(operatorRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mixedcase@viewpro.app' }),
    )
  })

  it('duplicate email (Prisma P2002 from the repository) surfaces as a distinct ConflictException (409), not a generic error', async () => {
    vi.mocked(operatorRepository.create).mockRejectedValueOnce(new P2002Error('duplicate'))

    const error = await useCase
      .execute({ email: 'dup@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' }, ACTOR)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictException)
  })

  it('on success, appends a native OPERATOR_CREATED audit entry with actor and target', async () => {
    const result = await useCase.execute(
      { email: 'new@viewpro.app', role: 'OPERATIONS', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(auditLogRepo.appendNative).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPERATOR_CREATED',
        actor: ACTOR,
        target: { id: result.id, email: result.email },
      }),
    )
  })

  it('never returns passwordHash in the result', async () => {
    const result = await useCase.execute(
      { email: 'new@viewpro.app', role: 'OPERATIONS', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(result).not.toHaveProperty('passwordHash')
  })
})
