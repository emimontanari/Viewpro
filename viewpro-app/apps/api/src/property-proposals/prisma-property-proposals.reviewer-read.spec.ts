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

describe('PrismaPropertyProposalsRepository reviewer detail', () => {
  const detailProposal = proposals[0]!
  const rounds = [
    { id: 'round-new', proposalId: detailProposal.id, tenantId: 'tenant', roundNumber: 2, submittedByUserId: 'former-seller', submittedAt: new Date('2026-01-03'), title: 'Newest', addressLine: 'New street', city: 'City', province: 'Province', propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null },
    { id: 'round-old', proposalId: detailProposal.id, tenantId: 'tenant', roundNumber: 1, submittedByUserId: 'former-seller', submittedAt: new Date('2026-01-02'), title: 'Oldest', addressLine: 'Old street', city: 'City', province: 'Province', propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null },
  ]

  function detailPrisma(people = [
    { id: 'former-seller', firstName: 'Ada', lastName: null },
    { id: 'former-reviewer', firstName: 'Grace', lastName: 'Hopper' },
  ]) {
    return {
      propertyProposal: { findFirst: vi.fn().mockResolvedValue(detailProposal) },
      propertyProposalReviewRound: { findMany: vi.fn().mockResolvedValue(rounds) },
      propertyProposalReviewDecision: { findMany: vi.fn().mockResolvedValue([
        { reviewRoundId: 'round-old', tenantId: 'tenant', reviewerUserId: 'former-reviewer', outcome: 'REJECTED', decidedAt: new Date('2026-01-02'), rejectionReason: 'Incomplete' },
      ]) },
      propertyEngagement: { findMany: vi.fn().mockResolvedValue([{ id: 'engagement-1', tenantId: 'tenant', sourceProposalId: detailProposal.id }]) },
      propertyAgent: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'reviewer', status: 'ACTIVE', memberships: [{ userId: 'reviewer', tenantId: 'tenant', status: 'ACTIVE', role: 'MANAGER' }] }),
        findMany: vi.fn().mockResolvedValue(people),
      },
    }
  }

  it('hydrates newest-first immutable history with former actors, nullable decisions, fresh result visibility, and bounded tenant-scoped batches', async () => {
    const db = detailPrisma()
    const result = await new PrismaPropertyProposalsRepository(db as never).findDetailForReviewer({ tenantId: 'tenant', reviewerUserId: 'reviewer', proposalId: detailProposal.id })

    expect(result).toEqual(expect.objectContaining({
      proposal: detailProposal,
      proposedBy: { id: 'former-seller', firstName: 'Ada', lastName: null },
      currentReviewRoundId: 'round-new',
      resultLink: { canonicalEngagementId: 'engagement-1' },
      history: [
        expect.objectContaining({ id: 'round-new', roundNumber: 2, snapshot: expect.objectContaining({ title: 'Newest', addressLine: 'New street' }), submittedBy: { id: 'former-seller', firstName: 'Ada', lastName: null }, decision: null }),
        expect.objectContaining({ id: 'round-old', roundNumber: 1, snapshot: expect.objectContaining({ title: 'Oldest', addressLine: 'Old street' }), decision: { outcome: 'REJECTED', decidedAt: new Date('2026-01-02'), rejectionReason: 'Incomplete', reviewer: { id: 'former-reviewer', firstName: 'Grace', lastName: 'Hopper' } } }),
      ],
    }))
    expect(db.propertyProposal.findFirst).toHaveBeenCalledWith({ where: { id: detailProposal.id, tenantId: 'tenant' } })
    expect(db.propertyProposalReviewRound.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', proposalId: detailProposal.id }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }))
    expect(db.propertyProposalReviewDecision.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', reviewRoundId: { in: ['round-new', 'round-old'] } } }))
    expect(db.propertyEngagement.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', sourceProposalId: detailProposal.id } }))
    expect(db.propertyAgent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant', propertyEngagementId: { in: ['engagement-1'] } } }))
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ memberships: expect.objectContaining({ where: { tenantId: 'tenant' } }) }),
    }))
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['former-seller', 'former-reviewer'] } } }))
    expect(db.user.findMany.mock.calls[0]![0].where).not.toHaveProperty('memberships')
    expect(db.propertyProposalReviewRound.findMany).toHaveBeenCalledTimes(1)
    expect(db.propertyProposalReviewDecision.findMany).toHaveBeenCalledTimes(1)
    expect(db.propertyEngagement.findMany).toHaveBeenCalledTimes(1)
    expect(db.propertyAgent.findMany).toHaveBeenCalledTimes(1)
    expect(db.user.findUnique).toHaveBeenCalledTimes(1)
    expect(db.user.findMany).toHaveBeenCalledTimes(1)
  })

  it('treats a missing durable history actor as an integrity failure instead of dropping history', async () => {
    const db = detailPrisma([{ id: 'former-seller', firstName: 'Ada', lastName: null }])

    await expect(new PrismaPropertyProposalsRepository(db as never).findDetailForReviewer({ tenantId: 'tenant', reviewerUserId: 'reviewer', proposalId: detailProposal.id })).rejects.toThrow('proposal history actor is missing')
  })

  it.each(['missing-id', 'cross-tenant-id'])('returns identical reviewer-safe absence for %s', async (proposalId) => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repository = new PrismaPropertyProposalsRepository({ propertyProposal: { findFirst } } as never)

    await expect(repository.findDetailForReviewer({ tenantId: 'tenant', reviewerUserId: 'reviewer', proposalId })).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith({ where: { id: proposalId, tenantId: 'tenant' } })
  })
})
