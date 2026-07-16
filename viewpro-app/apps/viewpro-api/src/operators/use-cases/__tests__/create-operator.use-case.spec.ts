import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException } from '@nestjs/common'
import { CreateOperatorUseCase } from '../create-operator.use-case'
import type { IOperatorRepository } from '../../../auth/repositories/operator.repository'
import type { IPasswordHasher } from '../../../auth/security/password-hasher'
import type { AuditLogRepository } from '../../../platform-data/audit-log.repository'
import type { PrismaService } from '../../../database/prisma.service'

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

// Fake prisma whose $transaction simply runs the callback with a throwaway tx
// client — enough for the happy-path tests that don't assert on rollback.
function makeFakePrisma(): PrismaService {
  return {
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({})),
  } as unknown as PrismaService
}

describe('CreateOperatorUseCase (T1.3.1)', () => {
  let useCase: CreateOperatorUseCase
  let operatorRepository: IOperatorRepository
  let passwordHasher: IPasswordHasher
  let auditLogRepo: Pick<AuditLogRepository, 'appendNative'>
  let prisma: PrismaService

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
    prisma = makeFakePrisma()

    useCase = new CreateOperatorUseCase(
      operatorRepository,
      passwordHasher,
      auditLogRepo as AuditLogRepository,
      prisma,
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
      expect.anything(),
    )
  })

  it('persists the EXPLICITLY given role — never relies on the ANALYST DB default', async () => {
    await useCase.execute(
      { email: 'new@viewpro.app', role: 'OWNER', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(operatorRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'OWNER' }),
      expect.anything(),
    )
  })

  it('normalizes email (lowercase/trim) before passing to the repository', async () => {
    await useCase.execute(
      { email: '  MixedCase@Viewpro.App  ', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(operatorRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mixedcase@viewpro.app' }),
      expect.anything(),
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
      expect.anything(),
    )
  })

  it('never returns passwordHash in the result', async () => {
    const result = await useCase.execute(
      { email: 'new@viewpro.app', role: 'OPERATIONS', tempPassword: 'a-strong-temp-pw12' },
      ACTOR,
    )

    expect(result).not.toHaveProperty('passwordHash')
  })

  // JD FIX 1 (atomicity): the operator INSERT and its native audit write must
  // commit-or-rollback together in ONE transaction. If the audit write throws,
  // the operator row must NOT be durably created (no silent audit gap).
  it('rolls back the operator creation if the native audit write fails (single transaction)', async () => {
    // Model commit semantics: a mutation that runs inside a tx is only
    // "committed" once the $transaction callback resolves; a mutation with no
    // tx commits immediately (the current, non-atomic behavior).
    const committed: Array<{ id: string; email: string }> = []
    const atomicPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const staged: Array<{ id: string; email: string }> = []
        const result = await cb({ __staged: staged })
        committed.push(...staged)
        return result
      }),
    } as unknown as PrismaService

    const atomicRepo: IOperatorRepository = {
      ...operatorRepository,
      create: vi.fn(
        async (input: { email: string; passwordHash: string; role: string }, tx?: unknown) => {
          const row = { id: 'op-new-1', email: input.email }
          const staged = (tx as { __staged?: Array<{ id: string; email: string }> } | undefined)?.__staged
          if (staged) {
            staged.push(row) // atomic path — committed only if the tx resolves
          } else {
            committed.push(row) // non-atomic path — durably committed immediately
          }
          return {
            id: row.id,
            email: row.email,
            role: 'ANALYST',
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        },
      ),
    }

    const failingAudit = {
      appendNative: vi.fn().mockRejectedValue(new Error('audit sink down')),
    }

    const atomicUseCase = new CreateOperatorUseCase(
      atomicRepo,
      passwordHasher,
      failingAudit as unknown as AuditLogRepository,
      atomicPrisma,
    )

    await expect(
      atomicUseCase.execute(
        { email: 'atomic@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' },
        ACTOR,
      ),
    ).rejects.toThrow()

    // The operator must NOT remain committed when the audit write failed.
    expect(committed).toHaveLength(0)
  })
})
