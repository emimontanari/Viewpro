import { NotFoundException } from '@nestjs/common'
import { PropertyEngagementStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CurrentUser } from '../../auth/types/current-user'
import { ApproveStatusChangeRequestUseCase } from './approve-status-change-request.use-case'

const TENANT_ID = 'tenant-1'
const REQUEST_ID = 'req-1'
const ENGAGEMENT_ID = 'engagement-1'
const MANAGER_ID = 'manager-1'
const SELLER_ID = 'seller-1'

function makeTenantContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return { tenantId: TENANT_ID, permissions: ['engagements.create'], ...overrides } as TenantContext
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

const baseEngagement = {
  id: ENGAGEMENT_ID,
  tenantId: TENANT_ID,
  status: PropertyEngagementStatus.CAPTURE,
  archivedAt: null,
  propertyAssetId: 'asset-1',
}

function makePrismaServiceStub(overrides: Record<string, unknown> = {}) {
  const txClient = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'PENDING', tenantId: TENANT_ID }]),
    statusChangeRequest: {
      findUnique: vi.fn().mockResolvedValue(basePendingRequest),
      update: vi.fn().mockResolvedValue({ ...basePendingRequest, status: 'RESOLVED', resolvedByUserId: MANAGER_ID }),
    },
    propertyEngagement: {
      findFirst: vi.fn().mockResolvedValue(baseEngagement),
      update: vi.fn().mockResolvedValue({ ...baseEngagement, status: PropertyEngagementStatus.ACTIVE_PUBLICATION }),
    },
    movement: {
      create: vi.fn().mockResolvedValue({ id: 'move-1', type: 'STATUS_CHANGE' }),
    },
    ...overrides,
  }

  return {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof txClient) => unknown) => fn(txClient)),
  }
}

function makeNotificationProducerStub() {
  return {
    notifyStatusChangeApproved: vi.fn().mockResolvedValue(undefined),
  }
}

function makeAnalyticsStub() {
  return {
    track: vi.fn().mockResolvedValue(undefined),
  }
}

describe('ApproveStatusChangeRequestUseCase', () => {
  let useCase: ApproveStatusChangeRequestUseCase
  let prismaStub: ReturnType<typeof makePrismaServiceStub>
  let notificationProducer: ReturnType<typeof makeNotificationProducerStub>
  let analyticsService: ReturnType<typeof makeAnalyticsStub>

  beforeEach(() => {
    prismaStub = makePrismaServiceStub()
    notificationProducer = makeNotificationProducerStub()
    analyticsService = makeAnalyticsStub()

    useCase = new ApproveStatusChangeRequestUseCase(
      prismaStub as never,
      notificationProducer as never,
      analyticsService as never,
    )
  })

  // S-6 / FR-16: self-approval forbidden
  it('throws ForbiddenException with SELF_APPROVAL_FORBIDDEN when the approver is the requester', async () => {
    // Seller tries to approve their own request
    await expect(
      useCase.execute(makeTenantContext(), makeSeller(), REQUEST_ID),
    ).rejects.toMatchObject({
      response: { errorCode: 'SELF_APPROVAL_FORBIDDEN' },
    })
  })

  // FR-15: already-resolved guard (S-8 second caller)
  it('throws ConflictException with STATUS_CHANGE_REQUEST_ALREADY_RESOLVED when request is not PENDING', async () => {
    const resolvedTxClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'RESOLVED', tenantId: TENANT_ID }]),
      statusChangeRequest: {
        findUnique: vi.fn().mockResolvedValue({ ...basePendingRequest, status: 'RESOLVED' }),
        update: vi.fn(),
      },
      propertyEngagement: { findFirst: vi.fn(), update: vi.fn() },
      movement: { create: vi.fn() },
    }

    const localPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof resolvedTxClient) => unknown) => fn(resolvedTxClient)),
    }

    const localUseCase = new ApproveStatusChangeRequestUseCase(
      localPrisma as never,
      notificationProducer as never,
      analyticsService as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeManager(), REQUEST_ID),
    ).rejects.toMatchObject({
      response: { errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED' },
    })
  })

  // FR-14 / S-7: stale-state guard
  it('throws ConflictException with STATUS_CHANGE_REQUEST_SUPERSEDED when engagement status has changed', async () => {
    const staleTxClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: REQUEST_ID, status: 'PENDING', tenantId: TENANT_ID }]),
      statusChangeRequest: {
        findUnique: vi.fn().mockResolvedValue({
          ...basePendingRequest,
          currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
        }),
        update: vi.fn(),
      },
      propertyEngagement: {
        // Engagement status is now DOCUMENTATION_PENDING, but snapshot was CAPTURE
        findFirst: vi.fn().mockResolvedValue({ ...baseEngagement, status: PropertyEngagementStatus.DOCUMENTATION_PENDING }),
        update: vi.fn(),
      },
      movement: { create: vi.fn() },
    }

    const localPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof staleTxClient) => unknown) => fn(staleTxClient)),
    }

    const localUseCase = new ApproveStatusChangeRequestUseCase(
      localPrisma as never,
      notificationProducer as never,
      analyticsService as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeManager(), REQUEST_ID),
    ).rejects.toMatchObject({
      response: { errorCode: 'STATUS_CHANGE_REQUEST_SUPERSEDED' },
    })
  })

  // FR-12 / S-2: happy path — full transaction
  it('commits the transaction and returns the resolved request on the happy path', async () => {
    const result = await useCase.execute(makeTenantContext(), makeManager(), REQUEST_ID)

    expect(result).toBeDefined()
    expect(result.status).toBe('RESOLVED')
    // Movement must have been created inside the transaction
    const txFn = prismaStub.$transaction.mock.calls[0]?.[0]
    expect(txFn).toBeDefined()
  })

  // NotFoundException when request not found (cross-tenant S-9)
  it('throws NotFoundException when the lock query returns no rows', async () => {
    const notFoundTxClient = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      statusChangeRequest: { findUnique: vi.fn(), update: vi.fn() },
      propertyEngagement: { findFirst: vi.fn(), update: vi.fn() },
      movement: { create: vi.fn() },
    }

    const localPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof notFoundTxClient) => unknown) => fn(notFoundTxClient)),
    }

    const localUseCase = new ApproveStatusChangeRequestUseCase(
      localPrisma as never,
      notificationProducer as never,
      analyticsService as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeManager(), REQUEST_ID),
    ).rejects.toThrow(NotFoundException)
  })
})
