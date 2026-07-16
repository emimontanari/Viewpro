import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnprocessableEntityException } from '@nestjs/common'
import { ChangeRoleOperatorUseCase } from '../change-role-operator.use-case'
import type { IOperatorRepository } from '../../../auth/repositories/operator.repository'
import type { AuditLogRepository } from '../../../platform-data/audit-log.repository'
import type { PrismaService } from '../../../database/prisma.service'

/**
 * T1.3.5 — RED: `ChangeRoleOperatorUseCase` — self-demote rejected (actor id
 * === target id, 422, BEFORE any DB read), last-OWNER rejected, success path
 * writes a native audit entry with previous/new role.
 */
const ACTOR = { id: 'op-owner-1', email: 'owner@viewpro.app' }
const TARGET_ID = 'op-target-1'

function makeFakePrismaResolvingOwners(ownerRows: Array<{ id: string }>) {
  const tx = { $queryRaw: vi.fn().mockResolvedValue(ownerRows) }
  const prisma = {
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(tx)),
  }
  return prisma as unknown as PrismaService
}

describe('ChangeRoleOperatorUseCase (T1.3.5)', () => {
  let operatorRepository: IOperatorRepository
  let auditLogRepo: Pick<AuditLogRepository, 'appendNative'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      updateRole: vi.fn().mockResolvedValue({
        id: TARGET_ID,
        email: 'target@viewpro.app',
        role: 'OPERATIONS',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateStatus: vi.fn(),
      countActiveOwners: vi.fn(),
    }
    auditLogRepo = { appendNative: vi.fn().mockResolvedValue(undefined) }
  })

  it('self-demote (actor.id === targetId) is rejected with 422 BEFORE any DB read', async () => {
    const prisma = makeFakePrismaResolvingOwners([])
    const useCase = new ChangeRoleOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const error = await useCase.execute(ACTOR.id, 'ANALYST', ACTOR).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expect(operatorRepository.updateRole).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('last-OWNER rejected: demoting the sole active OWNER → 422, updateRole never applied', async () => {
    // FOR UPDATE lock returns only the target itself as the active OWNER set.
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }])
    const useCase = new ChangeRoleOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const error = await useCase.execute(TARGET_ID, 'ANALYST', ACTOR).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expect(operatorRepository.updateRole).not.toHaveBeenCalled()
  })

  it('success path: role changed, native audit entry written with actor/target/new role', async () => {
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }, { id: 'other-owner' }])
    const useCase = new ChangeRoleOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const result = await useCase.execute(TARGET_ID, 'OPERATIONS', ACTOR)

    expect(result.role).toBe('OPERATIONS')
    expect(operatorRepository.updateRole).toHaveBeenCalledWith(TARGET_ID, 'OPERATIONS', expect.anything())
    expect(auditLogRepo.appendNative).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPERATOR_ROLE_CHANGED',
        actor: ACTOR,
        target: { id: TARGET_ID, email: 'target@viewpro.app' },
        newValue: { role: 'OPERATIONS' },
      }),
    )
  })
})
