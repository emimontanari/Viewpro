import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnprocessableEntityException } from '@nestjs/common'
import { ChangeStatusOperatorUseCase } from '../change-status-operator.use-case'
import type { IOperatorRepository } from '../../../auth/repositories/operator.repository'
import type { AuditLogRepository } from '../../../platform-data/audit-log.repository'
import type { PrismaService } from '../../../database/prisma.service'

/**
 * T1.3.7 — RED: `ChangeStatusOperatorUseCase` — self-suspend rejected,
 * last-OWNER-suspend rejected, success writes native audit entry
 * (SUSPENDED/REACTIVATED action types).
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

describe('ChangeStatusOperatorUseCase (T1.3.7)', () => {
  let operatorRepository: IOperatorRepository
  let auditLogRepo: Pick<AuditLogRepository, 'appendNative'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      updateRole: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue({
        id: TARGET_ID,
        email: 'target@viewpro.app',
        role: 'OPERATIONS',
        status: 'SUSPENDED',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      countActiveOwners: vi.fn(),
    }
    auditLogRepo = { appendNative: vi.fn().mockResolvedValue(undefined) }
  })

  it('self-suspend (actor.id === targetId) is rejected with 422 BEFORE any DB read', async () => {
    const prisma = makeFakePrismaResolvingOwners([])
    const useCase = new ChangeStatusOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const error = await useCase.execute(ACTOR.id, 'SUSPENDED', ACTOR).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expect(operatorRepository.updateStatus).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('last-OWNER-suspend rejected: suspending the sole active OWNER → 422, updateStatus never applied', async () => {
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }])
    const useCase = new ChangeStatusOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const error = await useCase.execute(TARGET_ID, 'SUSPENDED', ACTOR).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expect(operatorRepository.updateStatus).not.toHaveBeenCalled()
  })

  it('success (suspend): status changed, native audit entry action=OPERATOR_SUSPENDED', async () => {
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }, { id: 'other-owner' }])
    const useCase = new ChangeStatusOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const result = await useCase.execute(TARGET_ID, 'SUSPENDED', ACTOR)

    expect(result.status).toBe('SUSPENDED')
    expect(auditLogRepo.appendNative).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OPERATOR_SUSPENDED', actor: ACTOR }),
    )
  })

  it('success (reactivate): native audit entry action=OPERATOR_REACTIVATED', async () => {
    vi.mocked(operatorRepository.updateStatus).mockResolvedValueOnce({
      id: TARGET_ID,
      email: 'target@viewpro.app',
      role: 'OPERATIONS',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }, { id: 'other-owner' }])
    const useCase = new ChangeStatusOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const result = await useCase.execute(TARGET_ID, 'ACTIVE', ACTOR)

    expect(result.status).toBe('ACTIVE')
    expect(auditLogRepo.appendNative).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OPERATOR_REACTIVATED', actor: ACTOR }),
    )
  })
})
