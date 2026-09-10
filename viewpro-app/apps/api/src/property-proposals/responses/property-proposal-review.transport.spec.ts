import { describe, expect, it } from 'vitest'
import { mapReviewerDetailTransport, mapReviewerSummaryTransport } from './property-proposal-review.transport'

const proposal = {
  id: 'proposal', tenantId: 'tenant', proposedByUserId: 'seller', state: 'APROBADA' as const, version: 2,
  title: 'Safe', addressLine: 'Street', city: 'City', province: 'Province', propertyType: null, operationType: null,
  totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null,
  ageYears: null, orientation: null, ownerName: 'Owner', ownerEmail: 'owner@example.test', publishedPriceCents: null,
  currency: null, latestSubmittedAt: new Date('2026-01-03'), createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'),
}

describe('reviewer proposal summary transport', () => {
  it('projects only the literal public summary allowlist', () => {
    const result = mapReviewerSummaryTransport({
      proposal,
      currentReviewRoundId: 'round',
      proposedBy: { id: 'seller', firstName: 'Ada', lastName: null },
      resultLink: { canonicalEngagementId: 'engagement' },
    })

    expect(result).toEqual({
      id: 'proposal', state: 'APROBADA', version: 2, title: 'Safe', currentReviewRoundId: 'round',
      latestSubmittedAt: proposal.latestSubmittedAt, createdAt: proposal.createdAt, updatedAt: proposal.updatedAt,
      proposedBy: { id: 'seller', firstName: 'Ada', lastName: null }, canonicalEngagementId: 'engagement',
    })
    expect(result).not.toHaveProperty('tenantId')
    expect(result).not.toHaveProperty('proposedByUserId')
    expect(result).not.toHaveProperty('ownerEmail')
    expect(result).not.toHaveProperty('sourceProposalId')
  })

  it('omits an unavailable canonical result without widening the summary', () => {
    const result = mapReviewerSummaryTransport({
      proposal,
      proposedBy: { id: 'seller', firstName: 'Ada', lastName: null },
      resultLink: {},
    })

    expect(result).toEqual(expect.objectContaining({ id: 'proposal', proposedBy: { id: 'seller', firstName: 'Ada', lastName: null } }))
    expect(result).not.toHaveProperty('canonicalEngagementId')
    expect(Object.keys(result).sort()).toEqual(['createdAt', 'currentReviewRoundId', 'id', 'latestSubmittedAt', 'proposedBy', 'state', 'title', 'updatedAt', 'version'])
  })
})

describe('reviewer proposal detail transport', () => {
  it('projects literal staged fields, minimal people, newest history, nullable decisions, and a fresh optional result', () => {
    const result = mapReviewerDetailTransport({
      proposal,
      proposedBy: { id: 'seller', firstName: 'Ada', lastName: null },
      currentReviewRoundId: 'round-2',
      resultLink: { canonicalEngagementId: 'engagement' },
      history: [
        { id: 'round-2', roundNumber: 2, submittedAt: new Date('2026-01-03'), submittedBy: { id: 'seller', firstName: 'Ada', lastName: null }, snapshot: { ...proposal, title: 'Latest' }, decision: null },
        { id: 'round-1', roundNumber: 1, submittedAt: new Date('2026-01-02'), submittedBy: { id: 'seller', firstName: 'Ada', lastName: null }, snapshot: { ...proposal, title: 'Earlier' }, decision: { outcome: 'REJECTED', decidedAt: new Date('2026-01-02'), rejectionReason: null, reviewer: { id: 'former-reviewer', firstName: 'Grace', lastName: 'Hopper' } } },
      ],
    })

    expect(result).toEqual({
      id: 'proposal', state: 'APROBADA', version: 2, title: 'Safe', addressLine: 'Street', city: 'City', province: 'Province', propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: 'Owner', ownerEmail: 'owner@example.test', publishedPriceCents: null, currency: null, latestSubmittedAt: proposal.latestSubmittedAt, createdAt: proposal.createdAt, updatedAt: proposal.updatedAt,
      proposedBy: { id: 'seller', firstName: 'Ada', lastName: null }, currentReviewRoundId: 'round-2', canonicalEngagementId: 'engagement',
      history: [
        { id: 'round-2', roundNumber: 2, submittedAt: new Date('2026-01-03'), submittedBy: { id: 'seller', firstName: 'Ada', lastName: null }, snapshot: { title: 'Latest', addressLine: 'Street', city: 'City', province: 'Province', propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: 'Owner', ownerEmail: 'owner@example.test', publishedPriceCents: null, currency: null }, decision: null },
        { id: 'round-1', roundNumber: 1, submittedAt: new Date('2026-01-02'), submittedBy: { id: 'seller', firstName: 'Ada', lastName: null }, snapshot: { title: 'Earlier', addressLine: 'Street', city: 'City', province: 'Province', propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: 'Owner', ownerEmail: 'owner@example.test', publishedPriceCents: null, currency: null }, decision: { outcome: 'REJECTED', decidedAt: new Date('2026-01-02'), rejectionReason: null, reviewer: { id: 'former-reviewer', firstName: 'Grace', lastName: 'Hopper' } } },
      ],
    })
    expect(JSON.stringify(result)).not.toContain('tenantId')
    expect(JSON.stringify(result)).not.toContain('sourceProposalId')
  })

  it('omits an unavailable canonical result without widening detail output', () => {
    const result = mapReviewerDetailTransport({ proposal, proposedBy: { id: 'seller', firstName: 'Ada', lastName: null }, resultLink: {}, history: [] })

    expect(result).toEqual(expect.objectContaining({ id: 'proposal', proposedBy: { id: 'seller', firstName: 'Ada', lastName: null }, history: [] }))
    expect(result).not.toHaveProperty('canonicalEngagementId')
    expect(result).not.toHaveProperty('tenantId')
  })
})
