import { describe, expect, it, vi } from 'vitest'
import { ListPropertyProposalsUseCase } from './list-property-proposals.use-case'

const proposal = {
  id: 'proposal-1',
  tenantId: 'tenant-secret',
  proposedByUserId: 'seller-1',
  state: 'APROBADA',
  version: 3,
  title: 'Casa del parque',
  ownerEmail: 'owner@example.test',
  sourceEngagement: { id: 'engagement-secret' },
  updatedAt: new Date('2026-09-15T11:00:00.000Z'),
  createdAt: new Date('2026-09-14T10:00:00.000Z'),
  latestSubmittedAt: new Date('2026-09-15T10:00:00.000Z'),
}

describe('ListPropertyProposalsUseCase seller summaries', () => {
  it('returns only the seller summary allowlist while retaining the page envelope', async () => {
    const repository = {
      listForSeller: vi.fn().mockResolvedValue({ items: [proposal], total: 1 }),
      listSummariesForSeller: vi.fn().mockResolvedValue({
        items: [{
          proposal,
          currentReviewRoundId: 'round-1',
          resultLink: { canonicalEngagementId: 'engagement-1' },
        }],
        total: 1,
      }),
    }
    const useCase = new ListPropertyProposalsUseCase(repository as never)

    await expect(useCase.execute(
      { tenantId: 'tenant-1' } as never,
      { id: 'seller-1', email: 'seller@example.test' },
      { page: 2, pageSize: 20 },
    )).resolves.toEqual({
      items: [{
        id: 'proposal-1',
        state: 'APROBADA',
        version: 3,
        title: 'Casa del parque',
        currentReviewRoundId: 'round-1',
        canonicalEngagementId: 'engagement-1',
        latestSubmittedAt: proposal.latestSubmittedAt,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
      }],
      total: 1,
      page: 2,
      pageSize: 20,
    })
  })
})
