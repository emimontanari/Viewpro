import { describe, expect, it, vi } from 'vitest'
import { GetPropertyProposalUseCase } from './get-property-proposal.use-case'

const proposal = {
  id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'RECHAZADA', version: 3,
  title: 'Casa', addressLine: null, city: null, province: null, propertyType: null, operationType: null,
  totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null,
  ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null,
  latestSubmittedAt: null, createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-02'),
}

describe('GetPropertyProposalUseCase seller detail', () => {
  it('returns the safe detail read through trusted tenant and proposer context', async () => {
    const repository = { findDetailForSeller: vi.fn().mockResolvedValue({ proposal, currentReviewRoundId: 'round-1', history: [], resultLink: {} }) }

    await expect(new GetPropertyProposalUseCase(repository as never).execute(
      { tenantId: 'tenant-1' } as never, { id: 'seller-1' } as never, 'proposal-1',
    )).resolves.toMatchObject({ id: 'proposal-1', currentReviewRoundId: 'round-1', history: [] })
    expect(repository.findDetailForSeller).toHaveBeenCalledWith({ tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1' })
  })

  it.each(['missing', 'other-seller', 'other-tenant'])('maps %s absence to the existing coded 404', async (proposalId) => {
    const repository = { findDetailForSeller: vi.fn().mockResolvedValue(null) }

    await expect(new GetPropertyProposalUseCase(repository as never).execute(
      { tenantId: 'tenant-1' } as never, { id: 'seller-1' } as never, proposalId,
    )).rejects.toEqual(expect.objectContaining({
      response: expect.objectContaining({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' }),
    }))
  })
})
