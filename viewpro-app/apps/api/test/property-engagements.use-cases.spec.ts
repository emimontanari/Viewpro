import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { GlobalRole, PropertyEngagementStatus, PropertyOperationType, PropertyType, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../src/permissions/permissions.constants'
import { AssignPropertyAgentUseCase } from '../src/property-engagements/use-cases/assign-property-agent.use-case'
import { CreatePropertyEngagementUseCase } from '../src/property-engagements/use-cases/create-property-engagement.use-case'
import { GetPropertyEngagementUseCase } from '../src/property-engagements/use-cases/get-property-engagement.use-case'
import { ListPropertyEngagementsUseCase } from '../src/property-engagements/use-cases/list-property-engagements.use-case'
import { UpdatePropertyEngagementUseCase } from '../src/property-engagements/use-cases/update-property-engagement.use-case'
import { mapPropertyEngagement } from '../src/property-engagements/responses/property-engagement.response'
import type { TenantContext } from '../src/tenant-context/tenant-context.types'

const tenant: TenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  tenantStatus: TenantStatus.ACTIVE,
  membershipId: 'membership-1',
  role: TenantRole.PRINCIPAL_MANAGER,
  permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL, PERMISSIONS.ENGAGEMENTS_CREATE],
  userStatus: UserStatus.ACTIVE,
}

const currentUser = { id: 'user-1', email: 'user@example.com' }

const engagement = {
  id: 'engagement-1',
  tenantId: 'tenant-1',
  propertyAssetId: 'asset-1',
  operationType: PropertyOperationType.RENT,
  status: PropertyEngagementStatus.CAPTURE,
  publishedPriceCents: 25000000,
  currency: 'ARS',
  createdByUserId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  propertyAsset: {
    id: 'asset-1',
    title: 'Downtown apartment',
    addressLine: 'Av. Siempre Viva 123',
    city: 'Buenos Aires',
    province: 'CABA',
    propertyType: PropertyType.APARTMENT,
    totalAreaSqm: 72,
    coveredAreaSqm: 64,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    garages: 1,
    ageYears: 8,
    orientation: 'NE',
    ownerName: 'Owner Example',
    ownerEmail: 'owner@example.com',
    images: [],
    createdByUserId: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  agents: [
    {
      id: 'agent-assignment-1',
      tenantId: 'tenant-1',
      propertyEngagementId: 'engagement-1',
      agentUserId: 'agent-1',
      assignedByUserId: 'user-1',
      assignedAt: new Date('2026-01-03T00:00:00.000Z'),
      agentUser: {
        id: 'agent-1',
        email: 'agent@example.com',
        passwordHash: 'secret-hash',
        firstName: 'Agent',
        lastName: 'Example',
        globalRole: GlobalRole.USER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    },
  ],
  createdBy: {
    id: 'user-1',
    email: 'creator@example.com',
    passwordHash: 'creator-secret-hash',
    firstName: 'Creator',
    lastName: 'Example',
    globalRole: GlobalRole.USER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
}

describe('Property engagement response mapper', () => {
  it('maps engagement details to safe response fields only', () => {
    expect(mapPropertyEngagement(engagement)).toEqual({
      id: 'engagement-1',
      tenantId: 'tenant-1',
      operationType: PropertyOperationType.RENT,
      status: PropertyEngagementStatus.CAPTURE,
      publishedPriceCents: 25000000,
      currency: 'ARS',
      property: {
        id: 'asset-1',
        title: 'Downtown apartment',
        addressLine: 'Av. Siempre Viva 123',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.APARTMENT,
        totalAreaSqm: 72,
        coveredAreaSqm: 64,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        garages: 1,
        ageYears: 8,
        orientation: 'NE',
        ownerName: 'Owner Example',
        ownerEmail: 'owner@example.com',
        images: [],
        primaryImage: null,
      },
      agents: [{ id: 'agent-assignment-1', userId: 'agent-1', email: 'agent@example.com', firstName: 'Agent' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
  })
})

describe('Property engagement use cases', () => {
  it('creates a property asset and engagement for the current tenant and user', async () => {
    const repository = { createWithAsset: vi.fn().mockResolvedValue(engagement) }
    const useCase = new CreatePropertyEngagementUseCase(repository as never)

    const result = await useCase.execute(tenant, currentUser, {
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

    expect(result.id).toBe('engagement-1')
    expect(repository.createWithAsset).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      createdByUserId: 'user-1',
      propertyAsset: expect.objectContaining({
        title: 'Downtown apartment',
        totalAreaSqm: 72,
        coveredAreaSqm: 64,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        garages: 1,
        ageYears: 8,
        orientation: 'NE',
        createdBy: { connect: { id: 'user-1' } },
      }),
      engagement: { operationType: PropertyOperationType.RENT, publishedPriceCents: 25000000, currency: 'ARS' },
    })
  })

  it('updates property asset and engagement fields for the current tenant', async () => {
    const updatedEngagement = {
      ...engagement,
      operationType: PropertyOperationType.SALE,
      publishedPriceCents: 30000000,
      currency: 'USD',
      propertyAsset: {
        ...engagement.propertyAsset,
        title: 'Updated house',
        addressLine: 'Updated Street 456',
        propertyType: PropertyType.HOUSE,
        totalAreaSqm: 120,
        coveredAreaSqm: null,
        bedrooms: 3,
        ownerName: null,
      },
    }
    const repository = { updateForTenant: vi.fn().mockResolvedValue(updatedEngagement) }
    const useCase = new UpdatePropertyEngagementUseCase(repository as never)

    const result = await useCase.execute(tenant, currentUser, 'engagement-1', {
      title: 'Updated house',
      addressLine: 'Updated Street 456',
      propertyType: PropertyType.HOUSE,
      totalAreaSqm: 120,
      coveredAreaSqm: null,
      bedrooms: 3,
      ownerName: null,
      operationType: PropertyOperationType.SALE,
      publishedPriceCents: 30000000,
      currency: 'USD',
    })

    expect(result.property.title).toBe('Updated house')
    expect(result.operationType).toBe(PropertyOperationType.SALE)
    expect(repository.updateForTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      engagementId: 'engagement-1',
      userId: 'user-1',
      canViewAll: true,
      propertyAsset: expect.objectContaining({
        title: 'Updated house',
        addressLine: 'Updated Street 456',
        propertyType: PropertyType.HOUSE,
        totalAreaSqm: 120,
        coveredAreaSqm: null,
        bedrooms: 3,
        ownerName: null,
      }),
      engagement: {
        operationType: PropertyOperationType.SALE,
        publishedPriceCents: 30000000,
        currency: 'USD',
      },
    })
  })

  it('rejects property updates without write permission', async () => {
    const repository = { updateForTenant: vi.fn() }
    const useCase = new UpdatePropertyEngagementUseCase(repository as never)

    await expect(
      useCase.execute(
        { ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
        currentUser,
        'engagement-1',
        { title: 'Forbidden update' },
      ),
    ).rejects.toThrow(new ForbiddenException('Insufficient permissions'))
    expect(repository.updateForTenant).not.toHaveBeenCalled()
  })

  it('returns not found when updating another tenant or missing engagement', async () => {
    const repository = { updateForTenant: vi.fn().mockResolvedValue(null) }
    const useCase = new UpdatePropertyEngagementUseCase(repository as never)

    await expect(
      useCase.execute(tenant, currentUser, 'missing-engagement', { title: 'Missing update' }),
    ).rejects.toThrow(new NotFoundException('Property engagement not found'))
  })

  it('lists all tenant engagements when view-all permission is present', async () => {
    const repository = { findMany: vi.fn().mockResolvedValue({ items: [engagement], total: 1 }) }
    const useCase = new ListPropertyEngagementsUseCase(repository as never)

    const result = await useCase.execute(tenant, currentUser, { page: 2, pageSize: 10 })

    expect(result.total).toBe(1)
    expect(repository.findMany).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      canViewAll: true,
      page: 2,
      pageSize: 10,
      status: undefined,
      operationType: undefined,
    })
  })

  it('restricts list queries to assigned engagements when only assigned-view permission is present', async () => {
    const repository = { findMany: vi.fn().mockResolvedValue({ items: [engagement], total: 1 }) }
    const useCase = new ListPropertyEngagementsUseCase(repository as never)

    await useCase.execute(
      { ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED] },
      currentUser,
      { status: PropertyEngagementStatus.ACTIVE_PUBLICATION, operationType: PropertyOperationType.SALE },
    )

    expect(repository.findMany).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      canViewAll: false,
      page: 1,
      pageSize: 20,
      status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      operationType: PropertyOperationType.SALE,
    })
  })

  it('rejects list queries when neither view permission is present', async () => {
    const repository = { findMany: vi.fn() }
    const useCase = new ListPropertyEngagementsUseCase(repository as never)

    await expect(useCase.execute({ ...tenant, permissions: [] }, currentUser, {})).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    )
    expect(repository.findMany).not.toHaveBeenCalled()
  })

  it('returns not found for missing or unassigned engagement details', async () => {
    const repository = { findByIdForTenant: vi.fn().mockResolvedValue(null) }
    const useCase = new GetPropertyEngagementUseCase(repository as never)

    await expect(useCase.execute(tenant, currentUser, 'missing-engagement')).rejects.toThrow(
      new NotFoundException('Property engagement not found'),
    )
  })

  it('validates tenant membership before assigning an agent', async () => {
    const repository = {
      findByIdForTenant: vi.fn().mockResolvedValue(engagement),
      assignAgent: vi.fn().mockResolvedValue({ id: 'agent-assignment-1' }),
    }
    const membershipsRepository = { findByUserIdAndTenantId: vi.fn().mockResolvedValue({ id: 'membership-agent-1' }) }
    const useCase = new AssignPropertyAgentUseCase(repository as never, membershipsRepository as never)

    await useCase.execute(tenant, currentUser, 'engagement-1', { agentUserId: 'agent-1' })

    expect(membershipsRepository.findByUserIdAndTenantId).toHaveBeenCalledWith('agent-1', 'tenant-1')
    expect(repository.assignAgent).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      engagementId: 'engagement-1',
      agentUserId: 'agent-1',
      assignedByUserId: 'user-1',
    })
  })

  it('rejects assigning an agent that is not a tenant member', async () => {
    const repository = { findByIdForTenant: vi.fn().mockResolvedValue(engagement), assignAgent: vi.fn() }
    const membershipsRepository = { findByUserIdAndTenantId: vi.fn().mockResolvedValue(null) }
    const useCase = new AssignPropertyAgentUseCase(repository as never, membershipsRepository as never)

    await expect(useCase.execute(tenant, currentUser, 'engagement-1', { agentUserId: 'agent-1' })).rejects.toThrow(
      new BadRequestException('Agent is not a member of this tenant'),
    )
    expect(repository.assignAgent).not.toHaveBeenCalled()
  })
})
