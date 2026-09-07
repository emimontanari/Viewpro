import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { GetPropertyProposalReviewUseCase } from './get-property-proposal-review.use-case'

const tenantId = 'trusted-tenant'
const reviewer = { id: 'reviewer-id', email: 'reviewer@example.test' }
const proposal = { id: 'proposal-id', tenantId, state: 'APROBADA', title: 'All-state proposal' }

function tenant(role: TenantRole | 'UNSUPPORTED', permissions = [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]) {
  return { tenantId, role, permissions } as never
}

function repository(result: typeof proposal | null = proposal) {
  return {
    listForReviewer: vi.fn(),
    findForReviewer: vi.fn().mockResolvedValue(result),
    createDraft: vi.fn(),
    updateForSeller: vi.fn(),
    submitForSeller: vi.fn(),
  }
}

function expectNoWrites(repo: ReturnType<typeof repository>) {
  expect(repo.createDraft).not.toHaveBeenCalled()
  expect(repo.updateForSeller).not.toHaveBeenCalled()
  expect(repo.submitForSeller).not.toHaveBeenCalled()
}

describe('GetPropertyProposalReviewUseCase', () => {
  it.each([TenantRole.MANAGER, TenantRole.PRINCIPAL_MANAGER])(
    'allows %s to read every proposal state in the trusted tenant',
    async (role) => {
      const repo = repository()
      const result = await new GetPropertyProposalReviewUseCase(repo as never).execute(tenant(role), reviewer, proposal.id)

      expect(repo.findForReviewer).toHaveBeenCalledWith({ tenantId, proposalId: proposal.id })
      expect(result).toEqual(proposal)
      expect(result).not.toHaveProperty('canonicalEngagementId')
      expectNoWrites(repo)
    },
  )

  it.each([
    [TenantRole.AGENT, []],
    ['UNSUPPORTED', [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]],
    [TenantRole.PRINCIPAL_MANAGER, []],
    [TenantRole.AGENT, [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]],
  ] as const)('rejects %s authority mismatch before detail lookup', async (role, permissions) => {
    const repo = repository()
    const useCase = new GetPropertyProposalReviewUseCase(repo as never)

    await expect(useCase.execute(tenant(role, permissions as never), reviewer, proposal.id)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(useCase.execute(tenant(role, permissions as never), reviewer, proposal.id)).rejects.toEqual(
      expect.objectContaining({ response: expect.objectContaining({ message: 'Insufficient permissions' }) }),
    )
    expect(repo.findForReviewer).not.toHaveBeenCalled()
    expect(repo.listForReviewer).not.toHaveBeenCalled()
    expectNoWrites(repo)
  })

  it.each(['missing-id', 'cross-tenant-id'])('maps %s absence to the coded proposal 404', async (proposalId) => {
    const repo = repository(null)
    const useCase = new GetPropertyProposalReviewUseCase(repo as never)

    await expect(useCase.execute(tenant(TenantRole.MANAGER), reviewer, proposalId)).rejects.toBeInstanceOf(NotFoundException)
    await expect(useCase.execute(tenant(TenantRole.MANAGER), reviewer, proposalId)).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' }),
      }),
    )
    expect(repo.findForReviewer).toHaveBeenCalledWith({ tenantId, proposalId })
    expectNoWrites(repo)
  })
})
