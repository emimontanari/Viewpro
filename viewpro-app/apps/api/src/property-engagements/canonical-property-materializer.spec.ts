import {
  Prisma,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType,
} from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { CanonicalPropertyMaterializer } from './canonical-property-materializer'

const input = {
  tenantId: 'tenant-1', creatorUserId: 'seller-1', sourceProposalId: 'proposal-1',
  title: 'Canonical home', addressLine: 'Street 1', city: 'City', province: 'Province',
  propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE,
  totalAreaSqm: 120, coveredAreaSqm: 90, rooms: 4, bedrooms: 3, bathrooms: 2,
  garages: 1, ageYears: 5, orientation: 'north', ownerName: 'Reference owner',
  ownerEmail: 'owner@example.test', publishedPriceCents: 123_000, currency: null,
  assignment: { agentUserId: 'seller-1', assignedByUserId: 'manager-1' },
} as const

function transaction() {
  const asset = { id: 'asset-1' }
  const engagement = { id: 'engagement-1' }
  const assignment = { id: 'assignment-1', isPrimary: false }
  const propertyAssetCreate = vi.fn().mockResolvedValue(asset)
  const propertyEngagementCreate = vi.fn().mockResolvedValue(engagement)
  const propertyAgentCreate = vi.fn().mockResolvedValue(assignment)
  const rawTx = {
    propertyAsset: { create: propertyAssetCreate },
    propertyEngagement: { create: propertyEngagementCreate },
    propertyAgent: { create: propertyAgentCreate },
  }
  return {
    tx: rawTx as unknown as Prisma.TransactionClient, rawTx, asset, engagement, assignment,
    propertyAssetCreate, propertyEngagementCreate, propertyAgentCreate,
  }
}

describe('CanonicalPropertyMaterializer', () => {
  it('creates an explicitly non-primary proposer assignment after the CAPTURE engagement', async () => {
    const {
      tx, rawTx, asset, engagement, assignment, propertyAssetCreate,
      propertyEngagementCreate, propertyAgentCreate,
    } = transaction()

    await expect(new CanonicalPropertyMaterializer().createInTransaction(tx, input)).resolves.toEqual({
      asset, engagement, assignment,
    })

    expect(propertyAssetCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: input.title, createdByUserId: input.creatorUserId }),
    }))
    expect(propertyEngagementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: input.tenantId, propertyAssetId: asset.id,
        sourceProposalId: input.sourceProposalId, operationType: input.operationType,
        status: PropertyEngagementStatus.CAPTURE,
      }),
    }))
    expect(propertyAgentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: input.tenantId, propertyEngagementId: engagement.id,
        agentUserId: input.assignment.agentUserId,
        assignedByUserId: input.assignment.assignedByUserId, isPrimary: false,
      },
    })
    expect(assignment).toMatchObject({ isPrimary: false })
    expect(rawTx).not.toHaveProperty('$transaction')
    expect(propertyAssetCreate.mock.invocationCallOrder[0]).toBeLessThan(
      propertyEngagementCreate.mock.invocationCallOrder[0]!,
    )
    expect(propertyEngagementCreate.mock.invocationCallOrder[0]).toBeLessThan(
      propertyAgentCreate.mock.invocationCallOrder[0]!,
    )
  })

  it('omits null currency and assignment data when neither is supplied', async () => {
    const { tx, propertyEngagementCreate, propertyAgentCreate } = transaction()

    await expect(new CanonicalPropertyMaterializer().createInTransaction(tx, {
      ...input, sourceProposalId: undefined, assignment: undefined,
    })).resolves.toMatchObject({ assignment: null })

    const data = propertyEngagementCreate.mock.calls[0]![0].data
    expect(data).not.toHaveProperty('currency')
    expect(data).not.toHaveProperty('sourceProposalId')
    expect(propertyAgentCreate).not.toHaveBeenCalled()
  })

  it('passes supplied currency without primary inference', async () => {
    const { tx, propertyEngagementCreate, propertyAgentCreate } = transaction()

    await new CanonicalPropertyMaterializer().createInTransaction(tx, { ...input, currency: 'USD' })

    expect(propertyEngagementCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currency: 'USD' }),
    }))
    expect(propertyAgentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isPrimary: false }),
    }))
  })
})
