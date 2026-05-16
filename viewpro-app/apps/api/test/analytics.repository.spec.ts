import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PrismaAnalyticsRepository } from '../src/analytics/prisma-analytics.repository'

describe('Analytics repository foundation', () => {
  it('exposes analytics enums from Prisma Client', () => {
    expect(AnalyticsActorType.INTERNAL_USER).toBe('INTERNAL_USER')
    expect(AnalyticsActorType.OWNER).toBe('OWNER')
    expect(AnalyticsActorType.SYSTEM).toBe('SYSTEM')
    expect(AnalyticsEventName.MOVEMENT_CREATED).toBe('MOVEMENT_CREATED')
    expect(AnalyticsEventName.OWNER_VIEWED_PROPERTY).toBe('OWNER_VIEWED_PROPERTY')
  })

  it('creates an analytics event with nullable tenant and safe JSON metadata', async () => {
    const occurredAt = new Date('2026-05-16T10:00:00.000Z')
    const createdEvent = { id: 'event-1', tenantId: null, metadata: { source: 'owner_portal' } }
    const create = vi.fn().mockResolvedValue(createdEvent)
    const repository = new PrismaAnalyticsRepository({ analyticsEvent: { create } } as never)

    await expect(
      repository.create({
        tenantId: null,
        actorUserId: 'owner-1',
        actorType: AnalyticsActorType.OWNER,
        eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
        propertyAssetId: 'asset-1',
        metadata: { source: 'owner_portal' },
        occurredAt,
      }),
    ).resolves.toBe(createdEvent)

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: null,
        actorUserId: 'owner-1',
        actorType: AnalyticsActorType.OWNER,
        eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
        propertyAssetId: 'asset-1',
        metadata: { source: 'owner_portal' },
        occurredAt,
      }),
    })
  })

  it('lists tenant events paginated and newest first', async () => {
    const items = [{ id: 'event-2' }, { id: 'event-1' }]
    const findMany = vi.fn().mockResolvedValue(items)
    const repository = new PrismaAnalyticsRepository({ analyticsEvent: { findMany } } as never)

    await expect(repository.listTenantEvents({ tenantId: 'tenant-1', page: 2, pageSize: 10 })).resolves.toBe(items)

    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { occurredAt: 'desc' },
      skip: 10,
      take: 10,
    })
  })

  it('filters tenant event lists by event name', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'event-1' }])
    const repository = new PrismaAnalyticsRepository({ analyticsEvent: { findMany } } as never)

    await repository.listTenantEvents({
      tenantId: 'tenant-1',
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
      page: 1,
      pageSize: 25,
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', eventName: AnalyticsEventName.MOVEMENT_CREATED },
      }),
    )
  })

  it('counts tenant events in an occurred-at date range', async () => {
    const count = vi.fn().mockResolvedValue(3)
    const repository = new PrismaAnalyticsRepository({ analyticsEvent: { count } } as never)
    const from = new Date('2026-05-10T00:00:00.000Z')
    const to = new Date('2026-05-17T00:00:00.000Z')

    await expect(repository.countTenantEvents({ tenantId: 'tenant-1', from, to })).resolves.toBe(3)

    expect(count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', occurredAt: { gte: from, lt: to } },
    })
  })
})
