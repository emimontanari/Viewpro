import { describe, expect, it, vi } from 'vitest'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'

const now = new Date('2026-01-01')
const proposals = [
  { id: 'proposal-1', tenantId: 'tenant', proposedByUserId: 'former-seller', state: 'APROBADA', version: 2, title: 'First', addressLine: null, city: null, province: null, propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null, latestSubmittedAt: now, createdAt: now, updatedAt: now },
  { id: 'proposal-2', tenantId: 'tenant', proposedByUserId: 'active-seller', state: 'EN_REVISION', version: 1, title: 'Second', addressLine: null, city: null, province: null, propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null, latestSubmittedAt: null, createdAt: now, updatedAt: now },
]

function prisma() {
  return {
    $queryRaw: vi.fn().mockResolvedValue(proposals.map(({ id }) => ({ id }))),
    propertyProposal: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn().mockResolvedValue(proposals) },
    propertyProposalReviewRound: { findMany: vi.fn().mockResolvedValue([{ id: 'round-1', proposalId: 'proposal-1' }, { id: 'round-2', proposalId: 'proposal-2' }]) },
    propertyEngagement: { findMany: vi.fn().mockResolvedValue([{ id: 'engagement-1', tenantId: 'tenant', sourceProposalId: 'proposal-1' }]) },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'reviewer', status: 'ACTIVE', memberships: [{ userId: 'reviewer', tenantId: 'tenant', status: 'ACTIVE', role: 'MANAGER' }] }),
      findMany: vi.fn().mockResolvedValue([{ id: 'former-seller', firstName: 'Ada', lastName: null }, { id: 'active-seller', firstName: 'Bea', lastName: 'R' }]),
    },
  }
}

describe('PrismaPropertyProposalsRepository reviewer list summaries', () => {
  it('hydrates two tenant-scoped rows in one batch each without dropping a proposer whose membership no longer exists', async () => {
    const db = prisma()
    const result = await new PrismaPropertyProposalsRepository(db as never).listSummariesForReviewer({ tenantId: 'tenant', reviewerUserId: 'reviewer', filters: {} })

    expect(result.items.map(({ proposal, proposedBy, currentReviewRoundId }) => ({ id: proposal.id, proposer: proposedBy.id, currentReviewRoundId }))).toEqual([
      { id: 'proposal-1', proposer: 'former-seller', currentReviewRoundId: 'round-1' },
      { id: 'proposal-2', proposer: 'active-seller', currentReviewRoundId: 'round-2' },
    ])
    expect(db.propertyProposalReviewRound.findMany).toHaveBeenCalledTimes(1)
    expect(db.propertyEngagement.findMany).toHaveBeenCalledTimes(1)
    expect(db.user.findMany).toHaveBeenCalledTimes(1)
    expect(db.propertyProposalReviewRound.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', proposalId: { in: ['proposal-1', 'proposal-2'] } }) }))
    expect(db.propertyEngagement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', sourceProposalId: { in: ['proposal-1', 'proposal-2'] } }) }))
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['former-seller', 'active-seller'] } } }))
  })

  it('keeps the direct source ID internal while resolving the reviewer-visible canonical result once for the page', async () => {
    const db = prisma()
    const result = await new PrismaPropertyProposalsRepository(db as never).listSummariesForReviewer({ tenantId: 'tenant', reviewerUserId: 'reviewer', filters: {} })

    expect(result.items.map(({ resultLink }) => resultLink)).toEqual([{ canonicalEngagementId: 'engagement-1' }, {}])
    expect(db.propertyEngagement.findMany).toHaveBeenCalledTimes(1)
    expect(result.items[0]).not.toHaveProperty('sourceProposalId')
  })
})
