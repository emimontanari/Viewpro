import { describe, expect, it } from 'vitest'
import { mapReviewerSummaryTransport } from './property-proposal-review.transport'

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
