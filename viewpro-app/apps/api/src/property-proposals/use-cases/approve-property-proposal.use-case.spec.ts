import { ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import * as rolePermissions from '../../permissions/role-permissions'
import { ApprovePropertyProposalUseCase } from './approve-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' }
const reviewer = { id: 'manager-1', email: 'manager@example.test' }
const proposal = { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'agent-1', state: 'EN_REVISION', version: 2 }
const round = {
  id: 'round-1', tenantId: 'tenant-1', proposalId: 'proposal-1', roundNumber: 1,
  title: 'Immutable home', addressLine: 'Street 1', city: 'City', province: 'Province',
  propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: 120, coveredAreaSqm: 90,
  rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 5, orientation: 'north',
  ownerName: 'Reference owner', ownerEmail: 'owner@example.test', publishedPriceCents: 123_000,
  currency: null,
}

type Failure = 'materializer' | 'decision' | 'update'
type Options = Partial<{
  state: string
  reviewerStatus: string
  reviewerMembershipStatus: string
  role: string
  noReviewCapability: boolean
  proposer: string
  roundId: string
  decision: object | null
  failure: Failure
  lockAbsent: boolean
}>

function makeCandidate(options: Options = {}) {
  const events: string[] = []
  let current = { ...proposal, state: options.state ?? proposal.state, proposedByUserId: options.proposer ?? proposal.proposedByUserId }
  const durable = { canonical: [] as object[], decisions: [] as object[], get proposal() { return current } }
  let rawCall = 0
  const tx = {
    $queryRaw: vi.fn(async () => {
      const event = ['proposal', 'users', 'memberships'][rawCall++] ?? 'raw'
      events.push(event)
      if (event === 'proposal') return options.lockAbsent ? [] : [{ id: current.id }]
      if (event === 'users') return [
        { id: reviewer.id, status: options.reviewerStatus ?? 'ACTIVE' },
        { id: current.proposedByUserId, status: 'ACTIVE' },
      ]
      return [
        { id: 'membership-manager', userId: reviewer.id, role: options.role ?? 'MANAGER', status: options.reviewerMembershipStatus ?? 'ACTIVE' },
        { id: 'membership-seller', userId: current.proposedByUserId, role: 'AGENT', status: 'ACTIVE' },
      ]
    }),
    propertyProposal: {
      findFirst: vi.fn(async () => { events.push('find'); return current }),
      update: vi.fn(async ({ data }) => {
        events.push('update')
        if (options.failure === 'update') throw new Error('proposal update failure')
        current = { ...current, state: data.state, version: current.version + 1 }
        return current
      }),
    },
    propertyProposalReviewRound: {
      findFirst: vi.fn(async () => {
        events.push('round')
        return { ...round, id: options.roundId ?? round.id, decision: options.decision ?? null }
      }),
    },
    propertyProposalReviewDecision: {
      create: vi.fn(async ({ data }) => {
        events.push('decision')
        if (options.failure === 'decision') throw new Error('decision failure')
        durable.decisions.push(data)
        return data
      }),
    },
  }
  const prisma = {
    $transaction: vi.fn(async (work) => {
      const before = { proposal: { ...current }, canonical: [...durable.canonical], decisions: [...durable.decisions] }
      try {
        return await work(tx)
      } catch (error) {
        current = before.proposal
        durable.canonical.splice(0, durable.canonical.length, ...before.canonical)
        durable.decisions.splice(0, durable.decisions.length, ...before.decisions)
        throw error
      }
    }),
  }
  const materializer = {
    createInTransaction: vi.fn(async (receivedTx, input) => {
      events.push('materialize')
      expect(receivedTx).toBe(tx)
      durable.canonical.push({ input })
      if (options.failure === 'materializer') throw new Error('materializer failure')
      return { asset: { id: 'asset-1' }, engagement: { id: 'engagement-1' }, assignment: { id: 'assignment-1', isPrimary: false } }
    }),
  }
  return { useCase: new ApprovePropertyProposalUseCase(prisma as never, materializer as never), prisma, tx, materializer, durable, events }
}

async function exception(rejection: Promise<unknown>): Promise<HttpException> {
  const error = await rejection.then(() => new Error('expected rejection'), (caught: unknown) => caught)
  expect(error).toBeInstanceOf(HttpException)
  return error as HttpException
}

async function expectCoded(rejection: Promise<unknown>, type: typeof ConflictException | typeof ForbiddenException, status: number, errorCode: string) {
  const error = await exception(rejection)
  expect(error).toBeInstanceOf(type)
  expect(error.getStatus()).toBe(status)
  expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode }))
}

const sql = (call: unknown[]) => (call[0] as TemplateStringsArray).join('?').replace(/\s+/g, ' ').trim()

describe('ApprovePropertyProposalUseCase', () => {
  it('materializes immutable current-round values, records approval, and transitions once in one transaction', async () => {
    const candidate = makeCandidate()

    await expect(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).resolves.toEqual({
      ...proposal, state: 'APROBADA', version: 3,
    })

    expect(candidate.events).toEqual(['proposal', 'find', 'users', 'memberships', 'round', 'materialize', 'decision', 'update'])
    const [proposalLock, userLock, membershipLock] = candidate.tx.$queryRaw.mock.calls as unknown as [unknown[], unknown[], unknown[]]
    expect(proposalLock.slice(1)).toEqual([proposal.id, tenant.tenantId])
    expect(userLock[1]).toMatchObject({ values: ['agent-1', reviewer.id] })
    expect(membershipLock.slice(1, 2)).toEqual([tenant.tenantId])
    expect(membershipLock[2]).toMatchObject({ values: ['agent-1', reviewer.id] })
    expect(sql(userLock)).toContain('ORDER BY id ASC FOR NO KEY UPDATE')
    expect(sql(membershipLock)).toContain('ORDER BY id ASC FOR NO KEY UPDATE')
    expect(candidate.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(candidate.materializer.createInTransaction).toHaveBeenCalledWith(candidate.tx, expect.objectContaining({
      tenantId: tenant.tenantId, creatorUserId: proposal.proposedByUserId, sourceProposalId: proposal.id,
      title: round.title, addressLine: round.addressLine, city: round.city, province: round.province,
      propertyType: round.propertyType, operationType: round.operationType, totalAreaSqm: round.totalAreaSqm,
      coveredAreaSqm: round.coveredAreaSqm, rooms: round.rooms, bedrooms: round.bedrooms,
      bathrooms: round.bathrooms, garages: round.garages, ageYears: round.ageYears,
      orientation: round.orientation, ownerName: round.ownerName, ownerEmail: round.ownerEmail,
      publishedPriceCents: round.publishedPriceCents, currency: null,
      assignment: { agentUserId: proposal.proposedByUserId, assignedByUserId: reviewer.id },
    }))
    expect(candidate.tx.propertyProposalReviewDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: tenant.tenantId, reviewRoundId: round.id, reviewerUserId: reviewer.id, outcome: 'APPROVED', rejectionReason: null }),
    }))
    expect(candidate.tx.propertyProposal.update).toHaveBeenCalledWith({
      where: { id: proposal.id }, data: { state: 'APROBADA', version: { increment: 1 } },
    })
    expect(candidate.durable.canonical).toHaveLength(1)
    expect(candidate.durable.decisions).toHaveLength(1)
  })

  it.each(['MANAGER', 'PRINCIPAL_MANAGER'] as const)('revalidates an active %s reviewer before canonical writes', async (role) => {
    const candidate = makeCandidate({ role })
    await expect(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).resolves.toEqual(expect.objectContaining({ state: 'APROBADA' }))
    expect(candidate.durable.canonical).toHaveLength(1)
  })

  it.each([
    ['inactive reviewer', { reviewerStatus: 'SUSPENDED' }],
    ['inactive membership', { reviewerMembershipStatus: 'DEACTIVATED' }],
    ['seller role', { role: 'AGENT' }],
    ['lost review capability', { role: 'MANAGER', noReviewCapability: true }],
  ] as const)('denies %s before canonical writes', async (_, options) => {
    const candidate = makeCandidate(options)
    const permissionSpy = 'noReviewCapability' in options && options.noReviewCapability
      ? vi.spyOn(rolePermissions, 'getPermissionsForRole').mockReturnValue([])
      : undefined
    try {
      const error = await exception(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }))
      expect(error).toBeInstanceOf(ForbiddenException)
      expect(error.getStatus()).toBe(403)
      expect(error.getResponse()).toEqual({ error: 'Forbidden', message: 'Insufficient permissions', statusCode: 403 })
      expect(candidate.durable.canonical).toEqual([])
      expect(candidate.durable.decisions).toEqual([])
    } finally {
      permissionSpy?.mockRestore()
    }
  })

  it('denies durable self-review before canonical writes', async () => {
    const candidate = makeCandidate({ proposer: reviewer.id })
    await expectCoded(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), ForbiddenException, 403, 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN')
    expect(candidate.durable.canonical).toEqual([])
    expect(candidate.durable.decisions).toEqual([])
  })

  it.each([
    ['wrong state', { state: 'RECHAZADA' }],
    ['wrong round', { roundId: 'round-2' }],
    ['existing decision', { decision: { reviewerUserId: reviewer.id, outcome: 'APPROVED', rejectionReason: null } }],
  ] as const)('requires EN_REVISION, the exact current round, and no decision for %s', async (_, options) => {
    const candidate = makeCandidate(options)
    await expectCoded(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), ConflictException, 409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
    expect(candidate.durable.canonical).toEqual([])
    expect(candidate.durable.decisions).toEqual([])
    expect(candidate.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(candidate.tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each([tenant, { tenantId: 'tenant-2' }] as const)('maps a missing or cross-tenant proposal lock to coded 404 without writes', async (activeTenant) => {
    const candidate = makeCandidate({ lockAbsent: true })
    await expectCoded(candidate.useCase.execute(activeTenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), NotFoundException, 404, 'PROPERTY_PROPOSAL_NOT_FOUND')
    expect(candidate.tx.$queryRaw.mock.calls[0]?.slice(1)).toEqual([proposal.id, activeTenant.tenantId])
    expect(candidate.tx.propertyProposal.findFirst).not.toHaveBeenCalled()
    expect(candidate.tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each(['materializer', 'decision', 'update'] as const)('rolls back all staged state when the injected %s write fails', async (failure) => {
    const candidate = makeCandidate({ failure })
    await expect(candidate.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).rejects.toThrow(`${failure} failure`)
    expect(candidate.durable.canonical).toEqual([])
    expect(candidate.durable.decisions).toEqual([])
    expect(candidate.durable.proposal).toEqual(expect.objectContaining({ state: 'EN_REVISION', version: 2 }))
  })

  it('declares no owner, image, notification, or analytics collaborator contract', () => {
    const candidate = makeCandidate()
    expect(Object.keys(candidate.useCase as object).sort()).toEqual(['materializer', 'prisma'])
    expect(Object.keys(candidate.tx).sort()).toEqual([
      '$queryRaw', 'propertyProposal', 'propertyProposalReviewDecision', 'propertyProposalReviewRound',
    ])
  })
})
