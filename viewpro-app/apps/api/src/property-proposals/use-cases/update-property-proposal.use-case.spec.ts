import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { UpdatePropertyProposalUseCase } from './update-property-proposal.use-case'

const tenantId = 'tenant-context-id'
const tenant = { tenantId } as never
const seller = { id: 'seller-context-id', email: 'seller@example.test' }
const proposal = { id: 'proposal-1', tenantId, proposedByUserId: seller.id, state: 'BORRADOR', version: 2, title: 'Draft' }

function makeRepository(result = { kind: 'updated' as const, proposal }) {
  return { updateForSeller: vi.fn().mockResolvedValue(result) }
}

describe('UpdatePropertyProposalUseCase', () => {
  it('derives trusted ownership and sends only explicitly supplied normalized staged fields', async () => {
    const repository = makeRepository()

    await expect(new UpdatePropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', {
      expectedVersion: 1, tenantId: 'forged-tenant', proposedByUserId: 'forged-seller', state: 'APROBADA',
      title: '  Saved title ', city: '  Rosario ', version: 900, latestSubmittedAt: 'forged', unknown: 'ignored',
    })).resolves.toEqual(proposal)

    expect(repository.updateForSeller).toHaveBeenCalledWith({
      tenantId: 'tenant-context-id', proposedByUserId: 'seller-context-id', proposalId: 'proposal-1', expectedVersion: 1,
      patch: { title: 'Saved title', city: 'Rosario' },
    })
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'maps invalid expected version %s to the stable conflict without a write',
    async (expectedVersion) => {
      const repository = makeRepository()
      await expect(new UpdatePropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', { expectedVersion }))
        .rejects.toBeInstanceOf(ConflictException)
      expect(repository.updateForSeller).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['notFound', NotFoundException, { errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' }],
    ['conflict', ConflictException, { errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' }],
    ['ineligible', ForbiddenException, { message: 'Insufficient permissions' }],
  ] as const)('maps %s through its transport-safe result', async (_kind, Exception, response) => {
    const repository = makeRepository({ kind: _kind } as never)
    await expect(new UpdatePropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', { expectedVersion: 1 }))
      .rejects.toEqual(expect.objectContaining({ response: expect.objectContaining(response) }))
    await expect(new UpdatePropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', { expectedVersion: 1 }))
      .rejects.toBeInstanceOf(Exception)
  })
})
