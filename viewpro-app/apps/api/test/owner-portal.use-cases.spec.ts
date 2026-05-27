import { NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { OwnerPortalRepository } from '../src/owner-portal/owner-portal.repository'
import { GetOwnerEngagementTimelineUseCase } from '../src/owner-portal/use-cases/get-owner-engagement-timeline.use-case'
import { GetOwnerPropertyUseCase } from '../src/owner-portal/use-cases/get-owner-property.use-case'
import { ListOwnerPropertiesUseCase } from '../src/owner-portal/use-cases/list-owner-properties.use-case'
import { ListOwnerPropertyEngagementsUseCase } from '../src/owner-portal/use-cases/list-owner-property-engagements.use-case'

describe('Owner portal use cases', () => {
  it('lists mapped owner properties for the current user', async () => {
    const property = makeProperty({ id: 'property-1', title: 'Owner apartment' })
    const repository = makeRepository({ findPropertiesByOwnerUserId: vi.fn().mockResolvedValue([property]) })
    const useCase = new ListOwnerPropertiesUseCase(repository)

    const result = await useCase.execute('owner-1')

    expect(repository.findPropertiesByOwnerUserId).toHaveBeenCalledWith('owner-1')
    expect(result).toEqual([
      {
        id: 'property-1',
        title: 'Owner apartment',
        addressLine: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: 'APARTMENT',
        totalAreaSqm: null,
        coveredAreaSqm: null,
        rooms: null,
        bedrooms: null,
        bathrooms: null,
        garages: null,
        ageYears: null,
        orientation: null,
        images: [],
        primaryImage: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('gets a mapped owner property when access exists', async () => {
    const property = makeProperty({ id: 'property-2', title: 'Townhouse' })
    const repository = makeRepository({ findPropertyByOwner: vi.fn().mockResolvedValue(property) })
    const analyticsService = { track: vi.fn().mockResolvedValue({ status: 'persisted' }) }
    const useCase = new GetOwnerPropertyUseCase(repository, analyticsService as never)

    const result = await useCase.execute({ userId: 'owner-1', propertyAssetId: 'property-2' })

    expect(repository.findPropertyByOwner).toHaveBeenCalledWith({ userId: 'owner-1', propertyAssetId: 'property-2' })
    expect(result).toEqual(
      expect.objectContaining({
        id: 'property-2',
        title: 'Townhouse',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    )
    expect(analyticsService.track).toHaveBeenCalledWith({
      eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
      actorType: AnalyticsActorType.OWNER,
      actorUserId: 'owner-1',
      propertyAssetId: 'property-2',
    })
  })

  it('keeps owner property detail successful when analytics tracking fails', async () => {
    const property = makeProperty({ id: 'property-2', title: 'Townhouse' })
    const repository = makeRepository({ findPropertyByOwner: vi.fn().mockResolvedValue(property) })
    const analyticsService = { track: vi.fn().mockRejectedValue(new Error('analytics unavailable')) }
    const useCase = new GetOwnerPropertyUseCase(repository, analyticsService as never)

    await expect(useCase.execute({ userId: 'owner-1', propertyAssetId: 'property-2' })).resolves.toMatchObject({ id: 'property-2' })
  })

  it('throws 404 when an owner property is missing', async () => {
    const repository = makeRepository({ findPropertyByOwner: vi.fn().mockResolvedValue(null) })
    const useCase = new GetOwnerPropertyUseCase(repository, { track: vi.fn() } as never)

    await expect(useCase.execute({ userId: 'owner-1', propertyAssetId: 'missing-property' })).rejects.toThrow(
      new NotFoundException('Owner property not found'),
    )
    expect(repository.findPropertyByOwner).toHaveBeenCalledWith({ userId: 'owner-1', propertyAssetId: 'missing-property' })
  })

  it('checks property access before listing owner property engagements', async () => {
    const property = makeProperty({ id: 'property-1' })
    const engagement = makeEngagement({ id: 'engagement-1', propertyAssetId: 'property-1' })
    const repository = makeRepository({
      findPropertyByOwner: vi.fn().mockResolvedValue(property),
      findEngagementsForOwnerProperty: vi.fn().mockResolvedValue([engagement]),
    })
    const useCase = new ListOwnerPropertyEngagementsUseCase(repository)

    const result = await useCase.execute({ userId: 'owner-1', propertyAssetId: 'property-1' })

    expect(repository.findPropertyByOwner).toHaveBeenCalledWith({ userId: 'owner-1', propertyAssetId: 'property-1' })
    expect(repository.findEngagementsForOwnerProperty).toHaveBeenCalledWith({
      userId: 'owner-1',
      propertyAssetId: 'property-1',
    })
    expect(result).toEqual([
      expect.objectContaining({
        id: 'engagement-1',
        tenant: { id: 'tenant-1', name: 'Acme Realty' },
        agents: [{ userId: 'agent-1', firstName: 'Ada', email: 'ada@example.com' }],
      }),
    ])
  })

  it('does not list engagements when owner property access is missing', async () => {
    const repository = makeRepository({
      findPropertyByOwner: vi.fn().mockResolvedValue(null),
      findEngagementsForOwnerProperty: vi.fn(),
    })
    const useCase = new ListOwnerPropertyEngagementsUseCase(repository)

    await expect(useCase.execute({ userId: 'owner-1', propertyAssetId: 'property-1' })).rejects.toThrow(
      new NotFoundException('Owner property not found'),
    )
    expect(repository.findEngagementsForOwnerProperty).not.toHaveBeenCalled()
  })

  it('returns mapped owner engagement timeline pagination', async () => {
    const engagement = makeEngagement({ id: 'engagement-1' })
    const movement = makeMovement({ id: 'movement-1', propertyEngagementId: 'engagement-1' })
    const repository = makeRepository({
      findEngagementTimelineForOwner: vi.fn().mockResolvedValue({ engagement, items: [movement], total: 1 }),
    })
    const useCase = new GetOwnerEngagementTimelineUseCase(repository)

    const result = await useCase.execute({ userId: 'owner-1', engagementId: 'engagement-1', page: 2, pageSize: 10, order: 'asc' })

    expect(repository.findEngagementTimelineForOwner).toHaveBeenCalledWith({
      userId: 'owner-1',
      engagementId: 'engagement-1',
      page: 2,
      pageSize: 10,
      order: 'asc',
    })
    expect(result).toEqual({
      engagement: expect.objectContaining({ id: 'engagement-1', tenant: { id: 'tenant-1', name: 'Acme Realty' } }),
      items: [expect.objectContaining({ id: 'movement-1', createdAt: '2026-01-05T00:00:00.000Z' })],
      total: 1,
      page: 2,
      pageSize: 10,
    })
  })

  it('throws 404 when an owner engagement timeline is missing', async () => {
    const repository = makeRepository({
      findEngagementTimelineForOwner: vi.fn().mockResolvedValue({ engagement: null, items: [], total: 0 }),
    })
    const useCase = new GetOwnerEngagementTimelineUseCase(repository)

    await expect(
      useCase.execute({ userId: 'owner-1', engagementId: 'missing-engagement', page: 1, pageSize: 20, order: 'desc' }),
    ).rejects.toThrow(new NotFoundException('Owner engagement not found'))
  })
})

function makeRepository(overrides: Partial<OwnerPortalRepository>): OwnerPortalRepository {
  return {
    findPropertiesByOwnerUserId: vi.fn(),
    findPropertyByOwner: vi.fn(),
    findEngagementsForOwnerProperty: vi.fn(),
    findEngagementTimelineForOwner: vi.fn(),
    ...overrides,
  }
}

function makeProperty(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'property-1',
    title: 'Owned apartment',
    addressLine: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    province: 'CABA',
    propertyType: 'APARTMENT',
    totalAreaSqm: null,
    coveredAreaSqm: null,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    garages: null,
    ageYears: null,
    orientation: null,
    images: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as never
}

function makeEngagement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'engagement-1',
    propertyAssetId: 'property-1',
    operationType: 'SALE',
    status: 'ACTIVE_PUBLICATION',
    publishedPriceCents: 120_000_00,
    currency: 'USD',
    tenant: { id: 'tenant-1', name: 'Acme Realty' },
    agents: [{ agentUserId: 'agent-1', agentUser: { firstName: 'Ada', email: 'ada@example.com' } }],
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
    ...overrides,
  } as never
}

function makeMovement(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'movement-1',
    propertyEngagementId: 'engagement-1',
    type: 'GENERAL_UPDATE',
    observation: 'Listing refreshed.',
    nextStep: 'Send report',
    previousStatus: null,
    newStatus: null,
    source: 'MANUAL',
    interestCount: 3,
    visitCount: 1,
    offerAmountCents: null,
    interestLevel: 'HIGH',
    createdBy: { id: 'agent-1', email: 'ada@example.com', firstName: 'Ada' },
    createdAt: new Date('2026-01-05T00:00:00.000Z'),
    ...overrides,
  } as never
}
