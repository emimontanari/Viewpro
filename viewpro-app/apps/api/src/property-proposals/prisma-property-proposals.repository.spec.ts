import { describe, expect, it, vi } from 'vitest'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'

const proposal = {
  id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', title: 'Draft',
}

function makeRepository() {
  const prisma = {
    propertyProposal: {
      findMany: vi.fn().mockResolvedValue([proposal]),
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue(proposal),
    },
  }
  return { prisma, repository: new PrismaPropertyProposalsRepository(prisma as never) }
}

describe('PrismaPropertyProposalsRepository seller reads', () => {
  it('lists only the exact tenant and proposer with deterministic pagination and no future relations', async () => {
    const { prisma, repository } = makeRepository()

    await expect(repository.listForSeller({
      tenantId: 'tenant-1', proposedByUserId: 'seller-1', page: 2, pageSize: 50,
    })).resolves.toEqual({ items: [proposal], total: 1 })

    const where = { tenantId: 'tenant-1', proposedByUserId: 'seller-1' }
    expect(prisma.propertyProposal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: 50, take: 50,
    }))
    expect(prisma.propertyProposal.count).toHaveBeenCalledWith({ where })
    const findManyInput = prisma.propertyProposal.findMany.mock.calls[0]![0]
    expect(findManyInput).not.toHaveProperty('include')
    expect(JSON.stringify(findManyInput)).not.toContain('reviewRounds')
    expect(JSON.stringify(findManyInput)).not.toContain('sourceEngagement')
  })

  it('uses one identically scoped findFirst for missing, wrong seller, and wrong tenant detail', async () => {
    const { prisma, repository } = makeRepository()
    prisma.propertyProposal.findFirst.mockResolvedValue(null)

    for (const input of [
      { tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'missing' },
      { tenantId: 'tenant-1', proposedByUserId: 'seller-2', proposalId: 'proposal-1' },
      { tenantId: 'tenant-2', proposedByUserId: 'seller-1', proposalId: 'proposal-1' },
    ]) await expect(repository.findForSeller(input)).resolves.toBeNull()

    expect(prisma.propertyProposal.findFirst).toHaveBeenCalledTimes(3)
    expect(prisma.propertyProposal.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'proposal-1', tenantId: 'tenant-2', proposedByUserId: 'seller-1' },
    })
  })

  it('normalizes direct pagination inputs before preserving the repository scope and query shape', async () => {
    const { prisma, repository } = makeRepository()
    const list = new ListPropertyProposalsUseCase(repository)
    const tenant = { tenantId: 'tenant-1' } as never
    const seller = { id: 'seller-1', email: 'seller@example.test' }
    const maxSafePageAtFifty = Math.floor(Number.MAX_SAFE_INTEGER / 50) + 1
    const cases = [
      [{}, 1, 20, 0],
      [{ page: 0, pageSize: 30 }, 1, 30, 0],
      [{ page: 2, pageSize: 51 }, 2, 50, 50],
      [{ page: NaN, pageSize: Infinity }, 1, 20, 0],
      [{ page: 1.5, pageSize: 20.5 }, 1, 20, 0],
      [{ page: -1, pageSize: -1 }, 1, 20, 0],
      [{ page: Number.MAX_SAFE_INTEGER + 1, pageSize: Number.MAX_SAFE_INTEGER + 1 }, 1, 20, 0],
      [{ page: Number.MAX_SAFE_INTEGER, pageSize: 50 }, 1, 50, 0],
      [{ page: maxSafePageAtFifty, pageSize: 50 }, maxSafePageAtFifty, 50, 9_007_199_254_740_950],
      [{ page: maxSafePageAtFifty + 1, pageSize: 50 }, 1, 50, 0],
    ] as const

    for (const [query, page, pageSize] of cases) {
      await expect(list.execute(tenant, seller, query)).resolves.toMatchObject({ page, pageSize })
    }

    const where = { tenantId: 'tenant-1', proposedByUserId: 'seller-1' }
    expect(prisma.propertyProposal.findMany.mock.calls).toHaveLength(cases.length)
    for (const [index, [, , pageSize, skip]] of cases.entries()) {
      expect(prisma.propertyProposal.findMany.mock.calls[index]?.[0]).toEqual(expect.objectContaining({
        where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip, take: pageSize,
      }))
      expect(prisma.propertyProposal.count.mock.calls[index]?.[0]).toEqual({ where })
    }
  })

  it('keeps detail reads tenant-plus-proposer scoped through trusted context', async () => {
    const port = { listForSeller: vi.fn(), findForSeller: vi.fn().mockResolvedValue(proposal) }
    const get = new GetPropertyProposalUseCase(port as never)

    await expect(get.execute(
      { tenantId: 'tenant-1' } as never,
      { id: 'seller-1', email: 'seller@example.test' },
      'proposal-1',
    )).resolves.toBe(proposal)

    expect(port.findForSeller).toHaveBeenCalledWith({
      tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1',
    })
  })
})
