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

  it('reads own detail history in newest-first batches with minimal people and fresh result visibility', async () => {
    const detailProposal = { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'APROBADA' }
    const rounds = [
      { id: 'round-2', proposalId: 'proposal-1', roundNumber: 2, submittedByUserId: 'seller-1', submittedAt: new Date('2026-09-02'), title: 'New' },
      { id: 'round-1', proposalId: 'proposal-1', roundNumber: 1, submittedByUserId: 'seller-1', submittedAt: new Date('2026-09-01'), title: 'Old' },
    ]
    const prisma = {
      propertyProposal: { findFirst: vi.fn().mockResolvedValue(detailProposal) },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'seller-1', status: 'ACTIVE', memberships: [{ userId: 'seller-1', tenantId: 'tenant-1', status: 'ACTIVE', role: 'AGENT' }] }),
        findMany: vi.fn().mockResolvedValue([{ id: 'seller-1', firstName: 'Ada', lastName: 'Lovelace', email: 'hidden@example.test' }, { id: 'manager-1', firstName: 'Grace', lastName: 'Hopper', status: 'ACTIVE' }]),
      },
      propertyProposalReviewRound: { findMany: vi.fn().mockResolvedValue(rounds) },
      propertyProposalReviewDecision: { findMany: vi.fn().mockResolvedValue([{ reviewRoundId: 'round-1', reviewerUserId: 'manager-1', outcome: 'REJECTED', rejectionReason: 'Missing data', decidedAt: new Date('2026-09-01') }]) },
      propertyEngagement: { findMany: vi.fn().mockResolvedValue([{ id: 'engagement-1', tenantId: 'tenant-1', sourceProposalId: 'other-proposal' }]) },
      propertyAgent: { findMany: vi.fn().mockResolvedValue([{ tenantId: 'tenant-1', propertyEngagementId: 'engagement-1', agentUserId: 'seller-1' }]) },
    }
    const repository = new PrismaPropertyProposalsRepository(prisma as never) as never as { findDetailForSeller(input: { tenantId: string; proposedByUserId: string; proposalId: string }): Promise<Record<string, unknown> | null> }

    await expect(repository.findDetailForSeller({ tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1' })).resolves.toEqual(expect.objectContaining({
      proposal: detailProposal, currentReviewRoundId: 'round-2', resultLink: {},
      history: [
        expect.objectContaining({ id: 'round-2', snapshot: expect.objectContaining({ title: 'New' }), submittedBy: { id: 'seller-1', firstName: 'Ada', lastName: 'Lovelace' }, decision: null }),
        expect.objectContaining({ id: 'round-1', snapshot: expect.objectContaining({ title: 'Old' }), decision: expect.objectContaining({ outcome: 'REJECTED', rejectionReason: 'Missing data', reviewer: { id: 'manager-1', firstName: 'Grace', lastName: 'Hopper' } }) }),
      ],
    }))
    expect(prisma.propertyProposal.findFirst).toHaveBeenCalledWith({ where: { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1' } })
    expect(prisma.propertyProposalReviewRound.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', proposalId: 'proposal-1' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    }))
    expect(prisma.propertyProposalReviewDecision.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ memberships: { some: { tenantId: 'tenant-1' } } }),
    }))
    expect(prisma.propertyEngagement.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.propertyAgent.findMany).toHaveBeenCalledTimes(1)
  })

  it.each(['missing', 'wrong-seller', 'wrong-tenant'])('returns identical safe absence for %s', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repository = new PrismaPropertyProposalsRepository({ propertyProposal: { findFirst } } as never)

    await expect(repository.findDetailForSeller({ tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1' })).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1' } })
  })
})
