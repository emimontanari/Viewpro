import { Test } from '@nestjs/testing'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { AnalyticsCoreModule } from '../src/analytics/analytics-core.module'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../src/analytics/analytics.repository'
import { AnalyticsService } from '../src/analytics/analytics.service'
import { ConfigModule } from '../src/config/config.module'

describe('AnalyticsService', () => {
  it('delegates sanitized analytics events to the repository', async () => {
    const persistedEvent = { id: 'event-1' }
    const repository = { create: vi.fn().mockResolvedValue(persistedEvent) } as unknown as AnalyticsRepository
    const service = new AnalyticsService(repository)

    const result = await service.track({
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      actorType: AnalyticsActorType.INTERNAL_USER,
      eventName: AnalyticsEventName.MOVEMENT_CREATED,
      propertyEngagementId: 'engagement-1',
      movementId: 'movement-1',
      metadata: { source: 'manual', previousStatus: 'CAPTURE', newStatus: 'ACTIVE_PUBLICATION' },
    })

    expect(result).toEqual({ status: 'persisted', event: persistedEvent })
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        actorType: AnalyticsActorType.INTERNAL_USER,
        eventName: AnalyticsEventName.MOVEMENT_CREATED,
        propertyEngagementId: 'engagement-1',
        movementId: 'movement-1',
        metadata: { source: 'manual', previousStatus: 'CAPTURE', newStatus: 'ACTIVE_PUBLICATION' },
      }),
    )
  })

  it('drops sensitive metadata keys recursively and case-insensitively', async () => {
    const repository = { create: vi.fn().mockResolvedValue({ id: 'event-1' }) } as unknown as AnalyticsRepository
    const service = new AnalyticsService(repository)

    await service.track({
      actorType: AnalyticsActorType.OWNER,
      eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
      propertyAssetId: 'asset-1',
      metadata: {
        source: 'owner_portal',
        Email: 'owner@example.com',
        profile: { name: 'Owner Example', safeFlag: true },
        documents: [{ token: 'secret-token', kind: 'deed' }],
      },
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          source: 'owner_portal',
          profile: { safeFlag: true },
          documents: [{ kind: 'deed' }],
        },
      }),
    )
  })

  it('resolves with a failed status instead of throwing when persistence fails', async () => {
    const repository = { create: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as AnalyticsRepository
    const service = new AnalyticsService(repository)

    await expect(
      service.track({
        tenantId: 'tenant-1',
        actorType: AnalyticsActorType.SYSTEM,
        eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
      }),
    ).resolves.toEqual({ status: 'failed' })
  })

  it('wires the analytics module providers through Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, AnalyticsCoreModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue({ create: vi.fn() })
      .compile()

    expect(moduleRef.get(AnalyticsService)).toBeInstanceOf(AnalyticsService)
  })
})
