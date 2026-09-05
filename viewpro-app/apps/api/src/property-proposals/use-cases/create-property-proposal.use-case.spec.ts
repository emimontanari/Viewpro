import { ForbiddenException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { CreatePropertyProposalUseCase } from './create-property-proposal.use-case'

const tenantId = 'tenant-context-id'
const tenant = { tenantId, role: 'MANAGER' } as never
const seller = { id: 'seller-context-id', email: 'seller@example.test' }

const createdProposal = (id: string) => ({
  id,
  tenantId,
  proposedByUserId: seller.id,
  state: 'BORRADOR',
  version: 1,
  latestSubmittedAt: null,
})

function makeRepository() {
  return { createDraft: vi.fn().mockResolvedValue({ kind: 'created', proposal: createdProposal('proposal-1') }) }
}

describe('CreatePropertyProposalUseCase', () => {
  it('derives tenant and proposer from trusted context and persists normalized staged values only', async () => {
    const repository = makeRepository()
    const useCase = new CreatePropertyProposalUseCase(repository as never)

    await expect(useCase.execute(tenant, seller, {
      tenantId: 'forged-tenant', proposedByUserId: 'forged-seller',
      title: '  Draft home  ', addressLine: '  123 Main  ', city: '  Rosario ', province: ' Santa Fe ',
      propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: 120, coveredAreaSqm: 80,
      rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7,
      orientation: '  North  ', ownerName: '   ', ownerEmail: '  ', publishedPriceCents: 125_000_00,
      currency: ' ARS ',
    })).resolves.toEqual(createdProposal('proposal-1'))

    expect(repository.createDraft).toHaveBeenCalledWith({
      tenantId: 'tenant-context-id', proposedByUserId: 'seller-context-id',
      title: 'Draft home', addressLine: '123 Main', city: 'Rosario', province: 'Santa Fe',
      propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: 120, coveredAreaSqm: 80,
      rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7,
      orientation: 'North', ownerName: null, ownerEmail: null, publishedPriceCents: 125_000_00,
      currency: 'ARS',
    })
  })

  it('rejects a blank draft title before repository persistence', async () => {
    const repository = makeRepository()
    const useCase = new CreatePropertyProposalUseCase(repository as never)

    await expect(useCase.execute(tenant, seller, { title: '   ' })).rejects.toThrow('title is required')
    expect(repository.createDraft).not.toHaveBeenCalled()
  })

  it('maps the repository ineligible outcome through the existing narrow forbidden boundary', async () => {
    const repository = { createDraft: vi.fn().mockResolvedValue({ kind: 'ineligible' }) }
    const useCase = new CreatePropertyProposalUseCase(repository as never)

    await expect(useCase.execute(tenant, seller, { title: 'Draft' })).rejects.toEqual(
      expect.objectContaining({ response: expect.objectContaining({ message: 'Insufficient permissions' }) }),
    )
    await expect(useCase.execute(tenant, seller, { title: 'Draft' })).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('creates distinct drafts for duplicate normalized fields without a lookup or replay key', async () => {
    const repository = {
      createDraft: vi.fn()
        .mockResolvedValueOnce({ kind: 'created', proposal: createdProposal('proposal-1') })
        .mockResolvedValueOnce({ kind: 'created', proposal: createdProposal('proposal-2') }),
    }
    const useCase = new CreatePropertyProposalUseCase(repository as never)
    const input = { title: 'Same title', addressLine: 'Same address' }

    await expect(useCase.execute(tenant, seller, input)).resolves.toEqual(createdProposal('proposal-1'))
    await expect(useCase.execute(tenant, seller, input)).resolves.toEqual(createdProposal('proposal-2'))

    expect(repository.createDraft).toHaveBeenCalledTimes(2)
    expect(repository.createDraft.mock.calls).toEqual([
      [{ tenantId: 'tenant-context-id', proposedByUserId: 'seller-context-id', ...input, city: null, province: null,
        propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null,
        bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null,
        ownerEmail: null, publishedPriceCents: null, currency: null }],
      [{ tenantId: 'tenant-context-id', proposedByUserId: 'seller-context-id', ...input, city: null, province: null,
        propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null,
        bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null,
        ownerEmail: null, publishedPriceCents: null, currency: null }],
    ])
  })
})
