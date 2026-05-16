import { AnalyticsActorType, AnalyticsEventName, PropertyEngagementStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../src/analytics/analytics.repository'
import { PrismaAnalyticsRepository } from '../src/analytics/prisma-analytics.repository'
import { GetPilotSummaryUseCase } from '../src/analytics/use-cases/get-pilot-summary.use-case'
import { ListAnalyticsEventsUseCase } from '../src/analytics/use-cases/list-analytics-events.use-case'
import { ListInactiveEngagementsUseCase } from '../src/analytics/use-cases/list-inactive-engagements.use-case'

describe('Analytics pilot reports', () => {
  it('computes active engagement update percentage for the current week by default', async () => {
    const repository = {
      countActiveEngagements: vi.fn().mockResolvedValue(4),
      countActiveEngagementsWithOwnerVisibleUpdate: vi.fn().mockResolvedValue(3),
      countTenantReportEvents: vi
        .fn()
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(7),
    } as unknown as AnalyticsRepository
    const useCase = new GetPilotSummaryUseCase(repository)

    const summary = await useCase.execute({ tenantId: 'tenant-1', now: new Date('2026-05-13T12:00:00.000Z') })

    expect(summary).toEqual({
      window: {
        from: '2026-05-11T00:00:00.000Z',
        to: '2026-05-18T00:00:00.000Z',
      },
      activeEngagements: 4,
      activeEngagementsWithOwnerVisibleUpdate: 3,
      activeEngagementUpdatePercentage: 75,
      documentEvents: {
        requested: 5,
        uploaded: 2,
        approved: 1,
        rejected: 1,
      },
      ownerViewedPropertyCount: 7,
    })
    expect(repository.countActiveEngagementsWithOwnerVisibleUpdate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      from: new Date('2026-05-11T00:00:00.000Z'),
      to: new Date('2026-05-18T00:00:00.000Z'),
    })
  })

  it('returns zero percent when no active engagements exist', async () => {
    const repository = {
      countActiveEngagements: vi.fn().mockResolvedValue(0),
      countActiveEngagementsWithOwnerVisibleUpdate: vi.fn().mockResolvedValue(0),
      countTenantReportEvents: vi.fn().mockResolvedValue(0),
    } as unknown as AnalyticsRepository
    const useCase = new GetPilotSummaryUseCase(repository)

    const summary = await useCase.execute({ tenantId: 'tenant-1', now: new Date('2026-05-13T12:00:00.000Z') })

    expect(summary.activeEngagements).toBe(0)
    expect(summary.activeEngagementUpdatePercentage).toBe(0)
  })

  it('excludes active engagements with recent movement events from inactive reports', async () => {
    const analyticsEventFindMany = vi.fn().mockResolvedValue([{ propertyEngagementId: 'engagement-active' }])
    const propertyEngagementFindMany = vi.fn().mockResolvedValue([
      {
        id: 'engagement-inactive',
        tenantId: 'tenant-1',
        propertyAssetId: 'asset-1',
        status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ])
    const repository = new PrismaAnalyticsRepository({
      analyticsEvent: { findMany: analyticsEventFindMany },
      propertyEngagement: { findMany: propertyEngagementFindMany },
    } as never)
    const from = new Date('2026-05-09T00:00:00.000Z')
    const to = new Date('2026-05-16T00:00:00.000Z')

    const inactive = await repository.listActiveEngagementsWithoutRecentUpdate({ tenantId: 'tenant-1', from, to })

    expect(inactive).toHaveLength(1)
    expect(inactive[0].id).toBe('engagement-inactive')
    expect(analyticsEventFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        eventName: AnalyticsEventName.MOVEMENT_CREATED,
        occurredAt: { gte: from, lt: to },
        propertyEngagementId: { not: null },
      },
      distinct: ['propertyEngagementId'],
      select: { propertyEngagementId: true },
    })
    expect(propertyEngagementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: { notIn: [PropertyEngagementStatus.CLOSED, PropertyEngagementStatus.CANCELLED] },
          id: { notIn: ['engagement-active'] },
        },
      }),
    )
  })

  it('uses a seven-day default window for inactive engagements', async () => {
    const repository = {
      listActiveEngagementsWithoutRecentUpdate: vi.fn().mockResolvedValue([]),
    } as unknown as AnalyticsRepository
    const useCase = new ListInactiveEngagementsUseCase(repository)

    await useCase.execute({ tenantId: 'tenant-1', now: new Date('2026-05-16T12:00:00.000Z') })

    expect(repository.listActiveEngagementsWithoutRecentUpdate).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      from: new Date('2026-05-09T12:00:00.000Z'),
      to: new Date('2026-05-16T12:00:00.000Z'),
    })
  })

  it('lists analytics events tenant-scoped and paginated', async () => {
    const occurredAt = new Date('2026-05-16T10:00:00.000Z')
    const repository = {
      listTenantEvents: vi.fn().mockResolvedValue([
        {
          id: 'event-1',
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          actorType: AnalyticsActorType.INTERNAL_USER,
          eventName: AnalyticsEventName.MOVEMENT_CREATED,
          propertyEngagementId: 'engagement-1',
          propertyAssetId: null,
          documentRequestId: null,
          movementId: 'movement-1',
          metadata: null,
          occurredAt,
        },
      ]),
      countTenantEventsForList: vi.fn().mockResolvedValue(1),
    } as unknown as AnalyticsRepository
    const useCase = new ListAnalyticsEventsUseCase(repository)

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      page: 2,
      pageSize: 1,
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
    })

    expect(result).toEqual({
      total: 1,
      page: 2,
      pageSize: 1,
      items: [
        expect.objectContaining({
          id: 'event-1',
          tenantId: 'tenant-1',
          eventName: AnalyticsEventName.MOVEMENT_CREATED,
          occurredAt: '2026-05-16T10:00:00.000Z',
        }),
      ],
    })
    expect(repository.listTenantEvents).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      page: 2,
      pageSize: 1,
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
    })
    expect(repository.countTenantEventsForList).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
    })
  })
})

describe('Analytics repository DI token', () => {
  it('uses an explicit repository token', () => {
    expect(ANALYTICS_REPOSITORY.description).toBe('ANALYTICS_REPOSITORY')
  })
})
