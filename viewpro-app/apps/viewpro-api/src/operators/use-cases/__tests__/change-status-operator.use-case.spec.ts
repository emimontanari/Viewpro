import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
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

// Commit-tracking fake: a mutation staged on the tx client is only "committed"
// once the $transaction callback resolves. If the callback throws, staged
// mutations are discarded (rolled back). Used by the JD atomicity test.
function makeCommitTrackingPrisma(ownerRows: Array<{ id: string }>) {
  const committed = new Set<string>()
  const prisma = {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const staged = new Set<string>()
      const tx = { $queryRaw: vi.fn().mockResolvedValue(ownerRows), __staged: staged }
      const result = await cb(tx)
      for (const id of staged) committed.add(id)
      return result
    }),
  }
  return { prisma: prisma as unknown as PrismaService, committed }
}

describe('ChangeStatusOperatorUseCase (T1.3.7)', () => {
  let operatorRepository: IOperatorRepository
  let auditLogRepo: Pick<AuditLogRepository, 'appendNative'>

  beforeEach(() => {
    operatorRepository = {
      findByEmail: vi.fn(),
      // Default: target exists (the 404 pre-check passes). Individual tests
      // override this to null to exercise the not-found path.
      findById: vi.fn().mockResolvedValue({
        id: TARGET_ID,
        email: 'target@viewpro.app',
        role: 'OPERATIONS',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
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

  // JD FIX 2: a well-formed but nonexistent target id must yield a clean 404
  // NotFoundException — never an unhandled Prisma P2025 → HTTP 500.
  it('nonexistent target (findById → null) → 404 NotFoundException, updateStatus never attempted', async () => {
    const prisma = makeFakePrismaResolvingOwners([{ id: TARGET_ID }, { id: 'other-owner' }])
    operatorRepository.findById = vi.fn().mockResolvedValue(null)
    const useCase = new ChangeStatusOperatorUseCase(operatorRepository, prisma, auditLogRepo as AuditLogRepository)

    const error = await useCase.execute('op-does-not-exist', 'SUSPENDED', ACTOR).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotFoundException)
    expect(operatorRepository.updateStatus).not.toHaveBeenCalled()
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
      expect.anything(),
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
      expect.anything(),
    )
  })

  // JD FIX 1 (atomicity): the status mutation and its native audit write must
  // share ONE transaction. If the audit write throws, the status change must
  // roll back (no silent audit gap on the highest-privilege action).
  it('rolls back the status change if the native audit write fails (single transaction)', async () => {
    const { prisma, committed } = makeCommitTrackingPrisma([{ id: TARGET_ID }, { id: 'other-owner' }])
    const repo: IOperatorRepository = {
      ...operatorRepository,
      findById: vi.fn().mockResolvedValue({
        id: TARGET_ID,
        email: 'target@viewpro.app',
        role: 'OPERATIONS',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
      updateStatus: vi.fn(
        async (id: string, status: string, tx?: unknown) => {
          ;(tx as { __staged?: Set<string> } | undefined)?.__staged?.add(id)
          return {
            id,
            email: 'target@viewpro.app',
            role: 'OPERATIONS',
            status,
            createdAt: new Date(),
            updatedAt: new Date(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        },
      ),
    }
    const failingAudit = { appendNative: vi.fn().mockRejectedValue(new Error('audit sink down')) }
    const useCase = new ChangeStatusOperatorUseCase(repo, prisma, failingAudit as unknown as AuditLogRepository)

    await expect(useCase.execute(TARGET_ID, 'SUSPENDED', ACTOR)).rejects.toThrow()

    expect(committed.has(TARGET_ID)).toBe(false)
  })
})
