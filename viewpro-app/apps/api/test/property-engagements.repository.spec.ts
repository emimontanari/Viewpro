import { PropertyEngagementStatus, PropertyOperationType, PropertyType } from '@prisma/client'
import { validate } from 'class-validator'
import { describe, expect, it, vi } from 'vitest'
import { CreatePropertyEngagementDto } from '../src/property-engagements/dto/create-property-engagement.dto'
import { ListPropertyEngagementsQuery } from '../src/property-engagements/dto/list-property-engagements.query'
import { UpdatePropertyEngagementDto } from '../src/property-engagements/dto/update-property-engagement.dto'
import { PrismaPropertyEngagementsRepository } from '../src/property-engagements/prisma-property-engagements.repository'

describe('Property engagements foundation', () => {
  it('exposes the Stage 4 property domain enums from Prisma Client', () => {
    expect(PropertyType.APARTMENT).toBe('APARTMENT')
    expect(PropertyOperationType.RENT).toBe('RENT')
    expect(PropertyEngagementStatus.CAPTURE).toBe('CAPTURE')
  })

  it('validates create DTO fields for property asset and engagement data', async () => {
    const dto = Object.assign(new CreatePropertyEngagementDto(), {
      title: 'Downtown apartment',
      addressLine: 'Av. Siempre Viva 123',
      city: 'Buenos Aires',
      province: 'CABA',
      propertyType: PropertyType.APARTMENT,
      ownerName: 'Owner Example',
      ownerEmail: 'owner@example.com',
      totalAreaSqm: 72,
      coveredAreaSqm: 64,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      garages: 1,
      ageYears: 8,
      orientation: 'NE',
      operationType: PropertyOperationType.RENT,
      publishedPriceCents: 25000000,
      currency: 'ARS',
    })

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('validates update DTO fields as optional property and engagement data', async () => {
    const dto = Object.assign(new UpdatePropertyEngagementDto(), {
      title: 'Updated apartment',
      coveredAreaSqm: null,
      ownerName: null,
      operationType: PropertyOperationType.SALE,
      publishedPriceCents: 30000000,
      currency: 'USD',
    })

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('rejects invalid list query pagination and enum filters', async () => {
    const query = Object.assign(new ListPropertyEngagementsQuery(), {
      page: 0,
      pageSize: 51,
      status: 'UNKNOWN_STATUS',
      operationType: 'LEASE',
    })

    const errors = await validate(query)

    expect(errors.map((error) => error.property)).toEqual(['page', 'pageSize', 'status', 'operationType'])
  })

  it('creates a property asset and tenant-scoped engagement inside one transaction', async () => {
    const createdAsset = { id: 'asset-1' }
    const createdEngagement = { id: 'engagement-1', tenantId: 'tenant-1' }
    const transaction = vi.fn(async (callback) =>
      callback({
        propertyAsset: { create: vi.fn().mockResolvedValue(createdAsset) },
        propertyEngagement: { create: vi.fn().mockResolvedValue(createdEngagement) },
      }),
    )
    const repository = new PrismaPropertyEngagementsRepository({ $transaction: transaction } as never)

    const result = await repository.createWithAsset({
      tenantId: 'tenant-1',
      createdByUserId: 'user-1',
      propertyAsset: {
        title: 'Downtown apartment',
        addressLine: 'Av. Siempre Viva 123',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.APARTMENT,
        createdBy: { connect: { id: 'user-1' } },
      },
      engagement: { operationType: PropertyOperationType.RENT },
    })

    expect(transaction).toHaveBeenCalledOnce()
    expect(result).toBe(createdEngagement)
  })

  it('restricts assigned-only list queries to matching tenant assignments', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'engagement-1' }])
    const count = vi.fn().mockResolvedValue(1)
    const repository = new PrismaPropertyEngagementsRepository({
      propertyEngagement: { findMany, count },
    } as never)

    const result = await repository.findMany({
      tenantId: 'tenant-1',
      userId: 'agent-1',
      canViewAll: false,
      page: 2,
      pageSize: 10,
      status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      operationType: PropertyOperationType.SALE,
    })

    expect(result).toEqual({ items: [{ id: 'engagement-1' }], total: 1 })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
          operationType: PropertyOperationType.SALE,
          agents: { some: { agentUserId: 'agent-1', tenantId: 'tenant-1' } },
        }),
      }),
    )
    expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ tenantId: 'tenant-1' }) })
  })

  it('finds one tenant engagement without revealing unassigned records', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'engagement-1' })
    const repository = new PrismaPropertyEngagementsRepository({ propertyEngagement: { findFirst } } as never)

    await expect(
      repository.findByIdForTenant({
        tenantId: 'tenant-1',
        engagementId: 'engagement-1',
        userId: 'agent-1',
        canViewAll: false,
      }),
    ).resolves.toEqual({ id: 'engagement-1' })

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'engagement-1',
          tenantId: 'tenant-1',
          agents: { some: { agentUserId: 'agent-1', tenantId: 'tenant-1' } },
        },
      }),
    )
  })

  it('updates a tenant engagement and its property asset inside one transaction', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'engagement-1', propertyAssetId: 'asset-1' })
    const updatePropertyAsset = vi.fn().mockResolvedValue({ id: 'asset-1' })
    const updateEngagement = vi.fn().mockResolvedValue({ id: 'engagement-1' })
    const findUnique = vi.fn().mockResolvedValue({ id: 'engagement-1' })
    const transaction = vi.fn(async (callback) =>
      callback({
        propertyAsset: { update: updatePropertyAsset },
        propertyEngagement: { findFirst, findUnique, update: updateEngagement },
      }),
    )
    const repository = new PrismaPropertyEngagementsRepository({ $transaction: transaction } as never)

    await expect(
      repository.updateForTenant({
        tenantId: 'tenant-1',
        engagementId: 'engagement-1',
        userId: 'manager-1',
        canViewAll: true,
        propertyAsset: { title: 'Updated property', coveredAreaSqm: null },
        engagement: { operationType: PropertyOperationType.SALE, publishedPriceCents: 30000000 },
      }),
    ).resolves.toEqual({ id: 'engagement-1' })

    expect(transaction).toHaveBeenCalledOnce()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'engagement-1', tenantId: 'tenant-1' },
        select: { id: true, propertyAssetId: true },
      }),
    )
    expect(updatePropertyAsset).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: { title: 'Updated property', coveredAreaSqm: null },
    })
    expect(updateEngagement).toHaveBeenCalledWith({
      where: { id: 'engagement-1' },
      data: { operationType: PropertyOperationType.SALE, publishedPriceCents: 30000000 },
    })
  })

  it('returns null instead of updating an invisible tenant engagement', async () => {
    const updatePropertyAsset = vi.fn()
    const updateEngagement = vi.fn()
    const transaction = vi.fn(async (callback) =>
      callback({
        propertyAsset: { update: updatePropertyAsset },
        propertyEngagement: { findFirst: vi.fn().mockResolvedValue(null), update: updateEngagement },
      }),
    )
    const repository = new PrismaPropertyEngagementsRepository({ $transaction: transaction } as never)

    await expect(
      repository.updateForTenant({
        tenantId: 'tenant-1',
        engagementId: 'engagement-1',
        userId: 'agent-1',
        canViewAll: false,
        propertyAsset: { title: 'No leak' },
        engagement: {},
      }),
    ).resolves.toBeNull()
    expect(updatePropertyAsset).not.toHaveBeenCalled()
    expect(updateEngagement).not.toHaveBeenCalled()
  })

  it('assigns an agent within the engagement tenant boundary', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'agent-assignment-1' })
    const repository = new PrismaPropertyEngagementsRepository({ propertyAgent: { create } } as never)

    await expect(
      repository.assignAgent({
        tenantId: 'tenant-1',
        engagementId: 'engagement-1',
        agentUserId: 'agent-1',
        assignedByUserId: 'manager-1',
      }),
    ).resolves.toEqual({ id: 'agent-assignment-1' })

    expect(create).toHaveBeenCalledWith({
      data: {
        tenant: { connect: { id: 'tenant-1' } },
        propertyEngagement: { connect: { id: 'engagement-1' } },
        agentUser: { connect: { id: 'agent-1' } },
        assignedByUser: { connect: { id: 'manager-1' } },
      },
    })
  })
})
