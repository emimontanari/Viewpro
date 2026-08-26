import { NotFoundException } from '@nestjs/common'
import { PropertyEngagementStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CurrentUser } from '../../auth/types/current-user'
import { RejectStatusChangeRequestUseCase } from './reject-status-change-request.use-case'

const TENANT_ID = 'tenant-1'
const REQUEST_ID = 'req-1'
const ENGAGEMENT_ID = 'engagement-1'
const MANAGER_ID = 'manager-1'
const SELLER_ID = 'seller-1'

function makeTenantContext(): TenantContext {
  return { tenantId: TENANT_ID, permissions: ['engagements.create'] } as TenantContext
}

function makeManager(): CurrentUser {
  return { id: MANAGER_ID, email: 'manager@test.com', globalRole: 'USER' } as CurrentUser
}

function makeSeller(): CurrentUser {
  return { id: SELLER_ID, email: 'seller@test.com', globalRole: 'USER' } as CurrentUser
}

const basePendingRequest = {
  id: REQUEST_ID,
  tenantId: TENANT_ID,
  propertyEngagementId: ENGAGEMENT_ID,
  requestedByUserId: SELLER_ID,
  targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
  currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
  requestNote: null,
  status: 'PENDING' as const,
  resolvedByUserId: null,
  resolvedAt: null,
  resolutionComment: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makePrismaServiceStub(overrides: Record<string, unknown> = {}) {
  const txClient = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'PENDING', tenantId: TENANT_ID }]),
    statusChangeRequest: {
      findUnique: vi.fn().mockResolvedValue(basePendingRequest),
      update: vi.fn().mockResolvedValue({
        ...basePendingRequest,
        status: 'RESOLVED',
        resolvedByUserId: MANAGER_ID,
        resolutionComment: 'Documentation incomplete',
      }),
    },
    ...overrides,
  }

  return {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txClient) => unknown) => fn(txClient)),
  }
}

function makeNotificationProducerStub() {
  return {
    notifyStatusChangeRejected: vi.fn().mockResolvedValue(undefined),
  }
}

describe('RejectStatusChangeRequestUseCase', () => {
  let useCase: RejectStatusChangeRequestUseCase
  let prismaStub: ReturnType<typeof makePrismaServiceStub>
  let notificationProducer: ReturnType<typeof makeNotificationProducerStub>

  beforeEach(() => {
    prismaStub = makePrismaServiceStub()
    notificationProducer = makeNotificationProducerStub()

    useCase = new RejectStatusChangeRequestUseCase(
      prismaStub as never,
      notificationProducer as never,
    )
  })

  // S-4: missing resolutionComment → validation catches this at DTO level; use case receives empty string guard
  it('throws when resolutionComment is blank (empty string)', async () => {
    await expect(
      useCase.execute(makeTenantContext(), makeManager(), REQUEST_ID, { resolutionComment: '' }),
    ).rejects.toThrow()
  })

  // FR-20: self-rejection forbidden
  it('throws ForbiddenException with SELF_APPROVAL_FORBIDDEN when the rejector is the requester', async () => {
    await expect(
      useCase.execute(makeTenantContext(), makeSeller(), REQUEST_ID, { resolutionComment: 'Some comment' }),
    ).rejects.toMatchObject({ response: { errorCode: 'SELF_APPROVAL_FORBIDDEN' } })
  })

  // Already-resolved guard
  it('throws ConflictException with STATUS_CHANGE_REQUEST_ALREADY_RESOLVED when request is already resolved', async () => {
    const resolvedTxClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'RESOLVED', tenantId: TENANT_ID }]),
      statusChangeRequest: {
        findUnique: vi.fn().mockResolvedValue({ ...basePendingRequest, status: 'RESOLVED' }),
        update: vi.fn(),
      },
    }

    const localPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof resolvedTxClient) => unknown) => fn(resolvedTxClient)),
    }

    const localUseCase = new RejectStatusChangeRequestUseCase(localPrisma as never, notificationProducer as never)

    await expect(
      localUseCase.execute(makeTenantContext(), makeManager(), REQUEST_ID, { resolutionComment: 'Reason' }),
    ).rejects.toMatchObject({ response: { errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED' } })
  })

  // S-3: happy path
  it('marks the request RESOLVED and returns it on the happy path', async () => {
    const result = await useCase.execute(makeTenantContext(), makeManager(), REQUEST_ID, {
      resolutionComment: 'Documentation incomplete',
    })

    expect(result).toBeDefined()
    expect(result.status).toBe('RESOLVED')
  })

  // Not found
  it('throws NotFoundException when the lock query returns no rows', async () => {
    const notFoundTxClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      statusChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
    }

    const localPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof notFoundTxClient) => unknown) => fn(notFoundTxClient)),
    }

    const localUseCase = new RejectStatusChangeRequestUseCase(localPrisma as never, notificationProducer as never)

    await expect(
      localUseCase.execute(makeTenantContext(), makeManager(), REQUEST_ID, { resolutionComment: 'Reason' }),
    ).rejects.toThrow(NotFoundException)
  })
})
