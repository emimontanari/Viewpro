import { describe, expect, it, vi } from 'vitest'
import { PrismaService } from '../database/prisma.service'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'

const proposal = {
  id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', title: 'Draft',
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve })
  return { promise, resolve: resolvePromise }
}

function normalizeSql(query: unknown) {
  return Array.from(query as ArrayLike<string>).join('?').replace(/\s+/g, ' ').trim()
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
  it('retains the concrete Prisma provider token for module injection', () => {
    expect(Reflect.getMetadata('design:paramtypes', PrismaPropertyProposalsRepository)).toContain(PrismaService)
  })

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

describe('PrismaPropertyProposalsRepository draft creation', () => {
  const input = {
    tenantId: 'tenant-1', proposedByUserId: 'seller-1', title: 'Draft', addressLine: null,
    city: null, province: null, propertyType: 'HOUSE' as const, operationType: 'SALE' as const,
    totalAreaSqm: 120, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null,
    garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null,
    publishedPriceCents: null, currency: null,
  }

  it('locks the active user, then exact active AGENT membership, before one draft insert', async () => {
    const created = { ...proposal, ...input, state: 'BORRADOR', version: 1, latestSubmittedAt: null }
    const user = deferred<{ id: string }[]>()
    const membership = deferred<{ id: string }[]>()
    const insertedProposal = deferred<typeof created>()
    const tx = {
      $queryRaw: vi.fn()
        .mockImplementationOnce(() => user.promise)
        .mockImplementationOnce(() => membership.promise),
      propertyProposal: { create: vi.fn().mockImplementation(() => insertedProposal.promise) },
    }
    const prisma = { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) }
    const repository = new PrismaPropertyProposalsRepository(prisma as never)

    const result = repository.createDraft(input)
    await Promise.resolve()

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.propertyProposal.create).not.toHaveBeenCalled()
    expect(normalizeSql(tx.$queryRaw.mock.calls[0]?.[0])).toContain(
      'FROM users WHERE id = ? AND status = ?::"UserStatus" FOR NO KEY UPDATE',
    )
    expect(tx.$queryRaw.mock.calls[0]?.slice(1)).toEqual(['seller-1', 'ACTIVE'])

    user.resolve([{ id: 'seller-1' }])
    await Promise.resolve()

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(tx.propertyProposal.create).not.toHaveBeenCalled()
    expect(normalizeSql(tx.$queryRaw.mock.calls[1]?.[0])).toContain(
      'FROM tenant_memberships WHERE "userId" = ? AND "tenantId" = ? AND status = ?::"TenantMembershipStatus" AND role = ?::"TenantRole" FOR NO KEY UPDATE',
    )
    expect(tx.$queryRaw.mock.calls[1]?.slice(1)).toEqual(['seller-1', 'tenant-1', 'ACTIVE', 'AGENT'])

    membership.resolve([{ id: 'membership-1' }])
    await Promise.resolve()
    await Promise.resolve()

    expect(tx.propertyProposal.create).toHaveBeenCalledWith({
      data: { ...input, state: 'BORRADOR', version: 1, latestSubmittedAt: null },
    })
    expect(tx).not.toHaveProperty('$transaction')
    expect(Object.keys(tx)).toEqual(['$queryRaw', 'propertyProposal'])

    insertedProposal.resolve(created)
    await expect(result).resolves.toEqual({ kind: 'created', proposal: created })
  })

  it.each([
    ['inactive or missing user', [[]]],
    ['missing membership', [[{ id: 'seller-1' }], []]],
    ['inactive membership', [[{ id: 'seller-1' }], []]],
    ['non-AGENT membership', [[{ id: 'seller-1' }], []]],
  ])('returns ineligible and skips the proposal insert for an %s', async (_case, answers) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce(answers[0]).mockResolvedValueOnce(answers[1]),
      propertyProposal: { create: vi.fn() },
    }
    const prisma = { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) }

    await expect(new PrismaPropertyProposalsRepository(prisma as never).createDraft(input)).resolves.toEqual({ kind: 'ineligible' })
    expect(tx.propertyProposal.create).not.toHaveBeenCalled()
  })
})

describe('PrismaPropertyProposalsRepository atomic seller updates', () => {
  const current = {
    id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'BORRADOR', version: 2,
    title: 'Draft', city: null as string | null, addressLine: null, province: null, propertyType: null, operationType: null,
    totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null,
    ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null,
    latestSubmittedAt: null,
  }
  const updateInput = { tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1', expectedVersion: 2 }
  const transaction = (proposal = current, answers: unknown[][] = [[{ id: 'proposal-1' }], [{ id: 'seller-1' }], [{ id: 'membership-1' }]]) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce(answers[0]).mockResolvedValueOnce(answers[1]).mockResolvedValueOnce(answers[2]),
      propertyProposal: { findFirst: vi.fn().mockResolvedValue(proposal), update: vi.fn().mockImplementation(({ data }) => ({ ...proposal, ...data, version: 3 })) },
      propertyProposalReviewRound: { create: vi.fn() }, propertyAsset: { create: vi.fn() },
      propertyEngagement: { create: vi.fn() }, propertyAgent: { create: vi.fn() },
    }
    return { tx, prisma: { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) } }
  }
  const expectNoReviewOrCanonicalWrites = (tx: ReturnType<typeof transaction>['tx']) => {
    expect(tx.propertyProposalReviewRound.create).not.toHaveBeenCalled()
    expect(tx.propertyAsset.create).not.toHaveBeenCalled()
    expect(tx.propertyEngagement.create).not.toHaveBeenCalled()
    expect(tx.propertyAgent.create).not.toHaveBeenCalled()
  }

  it('awaits proposal lock, authoritative re-read, user lock, membership lock, then update in order with exact bindings', async () => {
    const proposalLock = deferred<{ id: string }[]>()
    const reread = deferred<typeof current>()
    const userLock = deferred<{ id: string }[]>()
    const membershipLock = deferred<{ id: string }[]>()
    const updated = deferred<typeof current>()
    const tx = {
      $queryRaw: vi.fn().mockImplementationOnce(() => proposalLock.promise).mockImplementationOnce(() => userLock.promise).mockImplementationOnce(() => membershipLock.promise),
      propertyProposal: { findFirst: vi.fn().mockImplementation(() => reread.promise), update: vi.fn().mockImplementation(() => updated.promise) },
    }
    const prisma = { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) }
    const result = new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: { city: 'Rosario' } })

    await Promise.resolve()
    expect(tx.$queryRaw.mock.calls[0]?.slice(1)).toEqual(['proposal-1', 'tenant-1', 'seller-1'])
    expect(tx.propertyProposal.findFirst).not.toHaveBeenCalled()
    proposalLock.resolve([{ id: 'proposal-1' }]); await Promise.resolve()
    expect(tx.propertyProposal.findFirst).toHaveBeenCalledWith({ where: { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1' } })
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    reread.resolve(current); await Promise.resolve()
    expect(tx.$queryRaw.mock.calls[1]?.slice(1)).toEqual(['seller-1', 'ACTIVE'])
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
    userLock.resolve([{ id: 'seller-1' }]); await Promise.resolve()
    expect(tx.$queryRaw.mock.calls[2]?.slice(1)).toEqual(['seller-1', 'tenant-1', 'ACTIVE', 'AGENT'])
    membershipLock.resolve([{ id: 'membership-1' }]); await Promise.resolve(); await Promise.resolve()
    expect(tx.propertyProposal.update).toHaveBeenCalledWith({ where: { id: 'proposal-1' }, data: { city: 'Rosario', title: 'Draft', version: { increment: 1 } } })
    updated.resolve({ ...current, city: 'Rosario', version: 3 })
    await expect(result).resolves.toMatchObject({ kind: 'updated', proposal: { version: 3 } })
  })

  it.each([
    ['missing', 'tenant-1', 'seller-1'], ['wrong tenant', 'tenant-2', 'seller-1'], ['wrong seller', 'tenant-1', 'seller-2'],
  ])('returns the same safe absence for %s proposal scope', async (_name, tenantId, proposedByUserId) => {
    const { tx, prisma } = transaction(current, [[], [], []])
    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, tenantId, proposedByUserId, patch: {} }))
      .resolves.toEqual({ kind: 'notFound' })
    expect(tx.propertyProposal.findFirst).not.toHaveBeenCalled()
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each([
    ['inactive user', [[], [], []]], ['missing membership', [[{ id: 'seller-1' }], [], []]], ['inactive membership', [[{ id: 'seller-1' }], [], []]], ['non-AGENT membership', [[{ id: 'seller-1' }], [], []]],
  ])('returns ineligible without writing for %s', async (_name, answers) => {
    const { tx, prisma } = transaction(current, [[{ id: 'proposal-1' }], ...answers])
    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: {} })).resolves.toEqual({ kind: 'ineligible' })
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it('rejects an EN_REVISION replay-shaped empty patch after the expected version', async () => {
    const { tx, prisma } = transaction({ ...current, state: 'EN_REVISION', version: 3 })

    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: {} }))
    .resolves.toEqual({ kind: 'conflict' })

    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
    expectNoReviewOrCanonicalWrites(tx)
  })

  it('rejects an APROBADA replay-shaped patch after the expected version', async () => {
    const { tx, prisma } = transaction({ ...current, state: 'APROBADA', city: 'Rosario', version: 3 })

    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: { city: ' Rosario ' } }))
      .resolves.toEqual({ kind: 'conflict' })

    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
    expectNoReviewOrCanonicalWrites(tx)
  })

  it('updates an empty current-version patch exactly once', async () => {
    const { tx, prisma } = transaction()

    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: {} }))
      .resolves.toMatchObject({ kind: 'updated', proposal: { version: 3 } })

    expect(tx.propertyProposal.update).toHaveBeenCalledOnce()
    expect(tx.propertyProposal.update).toHaveBeenCalledWith({ where: { id: 'proposal-1' }, data: { title: 'Draft', version: { increment: 1 } } })
    expectNoReviewOrCanonicalWrites(tx)
  })

  it('updates RECHAZADA data without changing its editable state', async () => {
    const rejected = { ...current, state: 'RECHAZADA' }
    const { tx, prisma } = transaction(rejected)

    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, patch: { city: 'Rosario' } }))
      .resolves.toMatchObject({ kind: 'updated', proposal: { state: 'RECHAZADA', city: 'Rosario', version: 3 } })

    expect(tx.propertyProposal.update).toHaveBeenCalledWith({ where: { id: 'proposal-1' }, data: { city: 'Rosario', title: 'Draft', version: { increment: 1 } } })
    expectNoReviewOrCanonicalWrites(tx)
  })

  it.each([
    ['exact same normalized patch', { city: ' Rosario ' }, { ...current, city: 'Rosario', version: 3 }, 'replayed'],
    ['empty patch', {}, { ...current, version: 3 }, 'replayed'],
    ['different patch after version increment', { city: 'Cordoba' }, { ...current, city: 'Rosario', version: 3 }, 'conflict'],
    ['locked EN_REVISION state', {}, { ...current, state: 'EN_REVISION' }, 'conflict'],
    ['blank merged title', { title: '   ' }, current, 'conflict'],
    ['stale version', {}, { ...current, version: 4 }, 'conflict'],
  ] as const)('%s has no update write when it is a replay or conflict', async (_name, patch, durable, kind) => {
    const expectedVersion = _name === 'stale version' ? 1 : 2
    const { tx, prisma } = transaction(durable)
    await expect(new PrismaPropertyProposalsRepository(prisma as never).updateForSeller({ ...updateInput, expectedVersion, patch })).resolves.toMatchObject({ kind })
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })
})
