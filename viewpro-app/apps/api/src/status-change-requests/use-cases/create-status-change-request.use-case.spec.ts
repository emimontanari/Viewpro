import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import { PropertyEngagementStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CurrentUser } from '../../auth/types/current-user'
import type { StatusChangeRequestsRepository } from '../status-change-requests.repository'
import { STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT } from '../constants/db'
import { CreateStatusChangeRequestUseCase } from './create-status-change-request.use-case'

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1'
const ENGAGEMENT_ID = 'engagement-1'
const SELLER_ID = 'seller-1'

function makeTenantContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: TENANT_ID,
    permissions: ['movements.create', 'engagements.view_assigned'],
    ...overrides,
  } as TenantContext
}

function makeCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: SELLER_ID, email: 'seller@test.com', globalRole: 'USER', ...overrides } as CurrentUser
}

function makeCreateDto() {
  return {
    targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
    currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
    requestNote: 'Ready to publish',
  }
}

const fakeEngagement = {
  id: ENGAGEMENT_ID,
  tenantId: TENANT_ID,
  status: PropertyEngagementStatus.CAPTURE,
  archivedAt: null as Date | null,
  propertyAssetId: 'asset-1',
  agents: [{ agentUserId: SELLER_ID }],
}

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

const fakePendingRecord = {
  id: 'req-1',
  tenantId: TENANT_ID,
  propertyEngagementId: ENGAGEMENT_ID,
  requestedByUserId: SELLER_ID,
  targetStatus: 'ACTIVE_PUBLICATION',
  currentStatusSnapshot: 'CAPTURE',
  requestNote: null,
  status: 'PENDING',
  resolvedByUserId: null,
  resolvedAt: null,
  resolutionComment: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRepoStub(overrides: Partial<StatusChangeRequestsRepository> = {}): StatusChangeRequestsRepository {
  return {
    createPending: vi.fn().mockResolvedValue(fakePendingRecord),
    findByIdForTenant: vi.fn().mockResolvedValue(null),
    findActivePendingByEngagement: vi.fn().mockResolvedValue(null),
    listByEngagementForTenant: vi.fn().mockResolvedValue([]),
    listPendingForTenant: vi.fn().mockResolvedValue([]),
    resolveInTransaction: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function makeEngagementsRepoStub(engagement: typeof fakeEngagement | null = fakeEngagement) {
  return {
    findByIdForTenant: vi.fn().mockResolvedValue(engagement),
  }
}

function makeNotificationProducerStub() {
  return {
    notifyStatusChangeRequested: vi.fn().mockResolvedValue(undefined),
  }
}

function makePrismaStub(managers: { userId: string }[] = [{ userId: 'manager-1' }]) {
  return {
    tenantMembership: {
      findMany: vi.fn().mockResolvedValue(managers),
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateStatusChangeRequestUseCase', () => {
  let useCase: CreateStatusChangeRequestUseCase
  let repo: StatusChangeRequestsRepository
  let notificationProducer: ReturnType<typeof makeNotificationProducerStub>
  let prismaStub: ReturnType<typeof makePrismaStub>
  let engagementsRepo: ReturnType<typeof makeEngagementsRepoStub>

  beforeEach(() => {
    repo = makeRepoStub()
    notificationProducer = makeNotificationProducerStub()
    prismaStub = makePrismaStub()
    engagementsRepo = makeEngagementsRepoStub()

    useCase = new CreateStatusChangeRequestUseCase(
      repo as never,
      engagementsRepo as never,
      notificationProducer as never,
      prismaStub as never,
    )
  })

  // FR-3: seller must be assigned to the engagement
  it('throws ForbiddenException when seller is not assigned to the engagement', async () => {
    const engagementWithoutAgent = { ...fakeEngagement, agents: [] }
    const localEngagementsRepo = makeEngagementsRepoStub(engagementWithoutAgent)

    const localUseCase = new CreateStatusChangeRequestUseCase(
      repo as never,
      localEngagementsRepo as never,
      notificationProducer as never,
      prismaStub as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto()),
    ).rejects.toThrow(ForbiddenException)
  })

  // FR-24: archived engagement guard
  it('throws UnprocessableEntityException with ENGAGEMENT_ARCHIVED when engagement is archived', async () => {
    const archivedEngagement = { ...fakeEngagement, archivedAt: new Date() }
    const localEngagementsRepo = makeEngagementsRepoStub(archivedEngagement)

    const localUseCase = new CreateStatusChangeRequestUseCase(
      repo as never,
      localEngagementsRepo as never,
      notificationProducer as never,
      prismaStub as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto()),
    ).rejects.toMatchObject({ response: { errorCode: 'ENGAGEMENT_ARCHIVED' } })
  })

  // FR-6: same-status guard
  it('throws UnprocessableEntityException with TARGET_STATUS_SAME_AS_CURRENT when target equals current status', async () => {
    const sameStatusDto = {
      targetStatus: PropertyEngagementStatus.CAPTURE,
      currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
    }

    await expect(
      useCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, sameStatusDto),
    ).rejects.toMatchObject({ response: { errorCode: 'TARGET_STATUS_SAME_AS_CURRENT' } })
  })

  // FR-5 / S-5: duplicate PENDING → 409 via meta.constraint shape
  it('throws ConflictException with STATUS_CHANGE_REQUEST_ALREADY_PENDING when P2002 meta.constraint fires', async () => {
    const p2002ConstraintErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { constraint: STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT },
    })

    const repoWithDuplicate = makeRepoStub({ createPending: vi.fn().mockRejectedValue(p2002ConstraintErr) })
    const localUseCase = new CreateStatusChangeRequestUseCase(
      repoWithDuplicate as never,
      engagementsRepo as never,
      notificationProducer as never,
      prismaStub as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto()),
    ).rejects.toMatchObject({ response: { errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_PENDING' } })
  })

  // FR-5 / S-5: duplicate PENDING → 409 via meta.target array shape
  it('throws ConflictException with STATUS_CHANGE_REQUEST_ALREADY_PENDING when P2002 meta.target fires', async () => {
    const p2002TargetErr = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: [STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT] },
    })

    const repoWithDuplicate = makeRepoStub({ createPending: vi.fn().mockRejectedValue(p2002TargetErr) })
    const localUseCase = new CreateStatusChangeRequestUseCase(
      repoWithDuplicate as never,
      engagementsRepo as never,
      notificationProducer as never,
      prismaStub as never,
    )

    await expect(
      localUseCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto()),
    ).rejects.toMatchObject({ response: { errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_PENDING' } })
  })

  // S-11: unassigned seller → 403
  it('throws ForbiddenException for a seller not in PropertyAgent for this engagement', async () => {
    const differentSeller = makeCurrentUser({ id: 'different-seller' })

    await expect(
      useCase.execute(makeTenantContext(), differentSeller, ENGAGEMENT_ID, makeCreateDto()),
    ).rejects.toThrow(ForbiddenException)
  })

  // Happy path
  it('creates a request and returns it on the happy path', async () => {
    const result = await useCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto())
    expect(result).toBeDefined()
    expect(repo.createPending).toHaveBeenCalledOnce()
  })

  // FR-T-17 / Issue #7: requester excluded from notification recipient list
  it('excludes the requester from STATUS_CHANGE_REQUESTED notification recipients even when they hold manager membership', async () => {
    // The prisma query uses { not: requestedByUserId } — so we simulate the DB returning
    // only the non-requester managers (as the DB WHERE clause would filter them out).
    // However, if the implementation has a bug and returns the requester, the assertion catches it.
    const managersExcludingRequester = [{ userId: 'manager-1' }]
    const localPrismaStub = makePrismaStub(managersExcludingRequester)

    const localUseCase = new CreateStatusChangeRequestUseCase(
      repo as never,
      engagementsRepo as never,
      notificationProducer as never,
      localPrismaStub as never,
    )

    await localUseCase.execute(makeTenantContext(), makeCurrentUser(), ENGAGEMENT_ID, makeCreateDto())

    // The prisma query's WHERE userId: { not: requestedByUserId } handles exclusion at DB level.
    // Assert that the notification producer received the correct tenant membership query with exclusion.
    expect(localPrismaStub.tenantMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: SELLER_ID },
        }),
      }),
    )
    // And the producer is called with recipients that don't include the requester
    expect(notificationProducer.notifyStatusChangeRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserIds: expect.not.arrayContaining([SELLER_ID]),
      }),
    )
  })
})
