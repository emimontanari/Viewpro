import { ForbiddenException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { ListPropertyProposalReviewUseCase } from './list-property-proposal-review.use-case'

const tenantId = 'trusted-tenant'
const reviewer = { id: 'reviewer-id', email: 'reviewer@example.test' }
const proposals = [
  { id: 'newest', tenantId, proposedByUserId: 'seller-1', state: 'EN_REVISION', version: 1, title: 'Newest', latestSubmittedAt: null, createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02') },
  { id: 'older', tenantId, proposedByUserId: 'seller-2', state: 'APROBADA', version: 2, title: 'Older', latestSubmittedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
]
const safeItems = proposals.map((proposal) => ({ proposal, proposedBy: { id: proposal.proposedByUserId, firstName: 'Ada', lastName: null }, resultLink: {} }))
const items = safeItems.map(({ proposal, proposedBy }) => ({
  id: proposal.id, state: proposal.state, version: proposal.version, title: proposal.title,
  currentReviewRoundId: undefined, latestSubmittedAt: proposal.latestSubmittedAt,
  createdAt: proposal.createdAt, updatedAt: proposal.updatedAt, proposedBy,
}))

function tenant(role: TenantRole | 'UNSUPPORTED', permissions = [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]) {
  return { tenantId, role, permissions } as never
}

function repository() {
  return {
    listForReviewer: vi.fn(),
    listSummariesForReviewer: vi.fn().mockResolvedValue({ items: safeItems, total: 2 }),
    findForReviewer: vi.fn(),
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

describe('ListPropertyProposalReviewUseCase', () => {
  it.each([TenantRole.MANAGER, TenantRole.PRINCIPAL_MANAGER])(
    'allows %s with review capability and uses the trusted tenant',
    async (role) => {
      const repo = repository()
      const filters = { state: 'APROBADA' as const, history: 'APPROVED' as const, page: 2, pageSize: 5 }
      const result = await new ListPropertyProposalReviewUseCase(repo as never).execute(tenant(role), reviewer, filters)

      expect(repo.listSummariesForReviewer).toHaveBeenCalledWith({ tenantId, reviewerUserId: reviewer.id, filters })
      expect(result).toEqual({ items, total: 2, page: 2, pageSize: 5 })
      expect(result.items).toEqual(items)
      expect(result.items[0]).not.toHaveProperty('canonicalEngagementId')
      expectNoWrites(repo)
    },
  )

  it.each([
    [TenantRole.AGENT, []],
    ['UNSUPPORTED', [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]],
    [TenantRole.MANAGER, []],
    [TenantRole.AGENT, [PERMISSIONS.PROPERTY_PROPOSALS_REVIEW]],
  ] as const)('rejects role/capability mismatch before reads', async (role, permissions) => {
    const repo = repository()
    const useCase = new ListPropertyProposalReviewUseCase(repo as never)

    await expect(useCase.execute(tenant(role, permissions as never), reviewer, {})).rejects.toBeInstanceOf(ForbiddenException)
    await expect(useCase.execute(tenant(role, permissions as never), reviewer, {})).rejects.toEqual(
      expect.objectContaining({ response: expect.objectContaining({ message: 'Insufficient permissions' }) }),
    )
    expect(repo.listSummariesForReviewer).not.toHaveBeenCalled()
    expect(repo.listForReviewer).not.toHaveBeenCalled()
    expect(repo.findForReviewer).not.toHaveBeenCalled()
    expectNoWrites(repo)
  })

  it('passes original default filters and preserves repository order while normalizing response metadata', async () => {
    const repo = repository()
    const filters = {}
    const result = await new ListPropertyProposalReviewUseCase(repo as never).execute(tenant(TenantRole.MANAGER), reviewer, filters)

    expect(repo.listSummariesForReviewer).toHaveBeenCalledWith({ tenantId, reviewerUserId: reviewer.id, filters })
    expect(result).toEqual({ items, total: 2, page: 1, pageSize: 20 })
    expect(result.items.map((item) => item.id)).toEqual(['newest', 'older'])
    expectNoWrites(repo)
  })

  it('does not rewrite supplied filters while normalizing only returned page metadata', async () => {
    const repo = repository()
    const filters = { state: 'RECHAZADA' as const, history: 'REJECTED' as const, page: 0, pageSize: 51 }
    const result = await new ListPropertyProposalReviewUseCase(repo as never).execute(tenant(TenantRole.PRINCIPAL_MANAGER), reviewer, filters)

    expect(repo.listSummariesForReviewer).toHaveBeenCalledWith({ tenantId, reviewerUserId: reviewer.id, filters })
    expect(result).toEqual({ items, total: 2, page: 1, pageSize: 20 })
    expectNoWrites(repo)
  })
})
