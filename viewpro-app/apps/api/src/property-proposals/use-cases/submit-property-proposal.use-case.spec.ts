import {
  ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { SubmitPropertyProposalUseCase } from './submit-property-proposal.use-case'

const tenantId = 'tenant-context-id'
const tenant = { tenantId } as never
const seller = { id: 'seller-context-id', email: 'seller@example.test' }
const proposal = { id: 'proposal-1', tenantId, proposedByUserId: seller.id, state: 'EN_REVISION', version: 2 }

function makeRepository(result = { kind: 'submitted' as const, proposal, round: { id: 'round-1' } }) {
  return { submitForSeller: vi.fn().mockResolvedValue(result) }
}

describe('SubmitPropertyProposalUseCase', () => {
  it('derives tenant and proposer from trusted context for a successful initial submission', async () => {
    const repository = makeRepository()

    await expect(new SubmitPropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', {
      expectedVersion: 1, tenantId: 'forged-tenant', proposedByUserId: 'forged-seller', title: 'forged',
    })).resolves.toEqual({ proposal, round: { id: 'round-1' } })

    expect(repository.submitForSeller).toHaveBeenCalledWith({
      tenantId: 'tenant-context-id', proposedByUserId: 'seller-context-id', proposalId: 'proposal-1', expectedVersion: 1,
    })
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'maps invalid expected version %s to the stable conflict without a repository call',
    async (expectedVersion) => {
      const repository = makeRepository()
      await expect(new SubmitPropertyProposalUseCase(repository as never).execute(tenant, seller, 'proposal-1', { expectedVersion }))
        .rejects.toBeInstanceOf(ConflictException)
      expect(repository.submitForSeller).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['notFound', NotFoundException, { errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' }],
    ['ineligible', ForbiddenException, { message: 'Insufficient permissions' }],
    ['conflict', ConflictException, { errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' }],
    ['incomplete', UnprocessableEntityException, { errorCode: 'PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE', message: 'Property proposal submission is incomplete' }],
  ] as const)('maps %s through its transport-safe result', async (_kind, Exception, response) => {
    const repository = makeRepository({ kind: _kind } as never)
    const useCase = new SubmitPropertyProposalUseCase(repository as never)
    await expect(useCase.execute(tenant, seller, 'proposal-1', { expectedVersion: 1 }))
      .rejects.toEqual(expect.objectContaining({ response: expect.objectContaining(response) }))
    await expect(useCase.execute(tenant, seller, 'proposal-1', { expectedVersion: 1 })).rejects.toBeInstanceOf(Exception)
  })
})
