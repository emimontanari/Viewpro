import { describe, expect, it, vi } from 'vitest'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'

describe('PrismaPropertyProposalsRepository seller list summaries', () => {
  it('batches the fresh visibility reads and never returns raw proposal relations', async () => {
    const proposal = {
      id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'APROBADA',
      version: 3, title: 'Casa del parque', createdAt: new Date(), updatedAt: new Date(), latestSubmittedAt: new Date(),
    }
    const prisma = {
      propertyProposal: {
        findMany: vi.fn().mockResolvedValue([proposal, { ...proposal, id: 'proposal-2', state: 'BORRADOR' }]),
        count: vi.fn().mockResolvedValue(2),
      },
      user: { findUnique: vi.fn().mockResolvedValue({
        id: 'seller-1', status: 'ACTIVE', memberships: [{ userId: 'seller-1', tenantId: 'tenant-1', status: 'ACTIVE', role: 'AGENT' }],
      }) },
      propertyProposalReviewRound: { findMany: vi.fn().mockResolvedValue([{ id: 'round-1', proposalId: 'proposal-1' }]) },
      propertyEngagement: { findMany: vi.fn().mockResolvedValue([{ id: 'engagement-1', tenantId: 'tenant-1', sourceProposalId: 'proposal-1' }]) },
      propertyAgent: { findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', propertyEngagementId: 'engagement-1', agentUserId: 'seller-1' }]) },
    }
    const repository = new PrismaPropertyProposalsRepository(prisma as never) as never as {
      listSummariesForSeller(input: { tenantId: string; proposedByUserId: string; page: number; pageSize: number }): Promise<{ items: Array<{ currentReviewRoundId?: string; resultLink: { canonicalEngagementId?: string }; proposal: typeof proposal }>; total: number }>
    }

    await expect(repository.listSummariesForSeller({
      tenantId: 'tenant-1', proposedByUserId: 'seller-1', page: 1, pageSize: 20,
    })).resolves.toEqual({
      items: [
        { proposal, currentReviewRoundId: 'round-1', resultLink: { canonicalEngagementId: 'engagement-1' } },
        { proposal: { ...proposal, id: 'proposal-2', state: 'BORRADOR' }, resultLink: {} },
      ], total: 2,
    })

    expect(prisma.propertyProposal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', proposedByUserId: 'seller-1' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20,
    }))
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
    expect(prisma.propertyProposalReviewRound.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.propertyEngagement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', sourceProposalId: { in: ['proposal-1', 'proposal-2'] } },
    }))
    expect(prisma.propertyEngagement.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.propertyAgent.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.propertyAgent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', agentUserId: 'seller-1', propertyEngagementId: { in: ['engagement-1'] } },
    }))
  })
})
