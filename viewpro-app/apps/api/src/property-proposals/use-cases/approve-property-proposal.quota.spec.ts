import { HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ActivePropertyCapacityExceededError } from '../../property-engagements/active-property-engagement-capacity'
import { ApprovePropertyProposalUseCase } from './approve-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' }
const reviewer = { id: 'manager-1', email: 'manager@example.test' }
const proposal = { id: 'proposal-1', tenantId: tenant.tenantId, proposedByUserId: 'agent-1', state: 'EN_REVISION', version: 2 }
const round = {
  id: 'round-1', proposalId: proposal.id, tenantId: tenant.tenantId, title: 'Home', addressLine: 'Street', city: 'City', province: 'Province',
  propertyType: 'HOUSE', operationType: 'SALE', totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null,
  garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null,
}

type Options = Partial<{ proposerStatus: string; proposerMembershipStatus: string; proposerRole: string; full: boolean; failUpdate: boolean }>

function candidate(options: Options = {}) {
  const events: string[] = []
  let full = options.full ?? false
  let rawCall = 0
  let current = { ...proposal }
  const durable = { canonical: [] as object[], decisions: [] as object[], get proposal() { return current } }
  const tx = {
    $queryRaw: vi.fn(async () => {
      const event = ['proposal', 'users', 'memberships'][rawCall++] ?? 'raw'
      events.push(event)
      if (event === 'proposal') return [{ id: proposal.id }]
      if (event === 'users') return [{ id: reviewer.id, status: 'ACTIVE' }, { id: proposal.proposedByUserId, status: options.proposerStatus ?? 'ACTIVE' }]
      return [
        { id: 'membership-agent', userId: proposal.proposedByUserId, status: options.proposerMembershipStatus ?? 'ACTIVE', role: options.proposerRole ?? 'AGENT' },
        { id: 'membership-manager', userId: reviewer.id, status: 'ACTIVE', role: 'MANAGER' },
      ]
    }),
    propertyProposal: {
      findFirst: vi.fn(async () => current),
      update: vi.fn(async ({ data }) => {
        events.push('update')
        if (options.failUpdate) throw new Error('update failure')
        current = { ...current, state: data.state, version: current.version + 1 }
        return current
      }),
    },
    propertyProposalReviewRound: { findFirst: vi.fn(async () => ({ ...round, decision: null })) },
    propertyProposalReviewDecision: { create: vi.fn(async (input) => { events.push('decision'); durable.decisions.push(input); return input }) },
  }
  const prisma = {
    $transaction: vi.fn(async (work) => {
      rawCall = 0
      const before = { proposal: { ...current }, canonical: [...durable.canonical], decisions: [...durable.decisions] }
      try { return await work(tx) } catch (error) {
        current = before.proposal
        durable.canonical.splice(0, durable.canonical.length, ...before.canonical)
        durable.decisions.splice(0, durable.decisions.length, ...before.decisions)
        throw error
      }
    }),
  }
  const capacity = {
    acquire: vi.fn(async () => {
      events.push('capacity-acquire')
      return { assertAvailable: async () => {
        events.push('capacity-assert')
        if (full) throw new ActivePropertyCapacityExceededError()
      } }
    }),
  }
  const materializer = { createInTransaction: vi.fn(async () => { events.push('materialize'); durable.canonical.push({ id: 'asset-1' }) }) }
  return {
    useCase: new ApprovePropertyProposalUseCase(prisma as never, materializer as never, capacity as never),
    tx, capacity, materializer, durable, events,
    restoreCapacity: () => { full = false },
  }
}

async function coded(rejection: Promise<unknown>, errorCode: string) {
  const error = await rejection.then(() => new Error('expected rejection'), (reason) => reason)
  expect(error).toBeInstanceOf(HttpException)
  expect((error as HttpException).getStatus()).toBe(409)
  expect((error as HttpException).getResponse()).toEqual(expect.objectContaining({ errorCode }))
}

describe('ApprovePropertyProposalUseCase quota and proposer eligibility', () => {
  it('maps a protected final slot to the stable quota conflict before canonical writes', async () => {
    const subject = candidate({ full: true })
    await coded(subject.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), 'TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED')
    expect(subject.events).toEqual(['proposal', 'capacity-acquire', 'users', 'memberships', 'capacity-assert'])
    expect(subject.capacity.acquire).toHaveBeenCalledWith(subject.tx, tenant.tenantId)
    const [proposalLock, userLock, membershipLock] = subject.tx.$queryRaw.mock.calls as unknown as [unknown[], unknown[], unknown[]]
    expect(proposalLock.slice(1)).toEqual([proposal.id, tenant.tenantId])
    expect(userLock[1]).toMatchObject({ values: ['agent-1', reviewer.id] })
    expect(membershipLock.slice(1, 2)).toEqual([tenant.tenantId])
    expect(membershipLock[2]).toMatchObject({ values: ['agent-1', reviewer.id] })
    expect(subject.materializer.createInTransaction).not.toHaveBeenCalled()
    expect(subject.durable).toMatchObject({ canonical: [], decisions: [], proposal: { state: 'EN_REVISION', version: 2 } })
  })

  it.each([
    ['inactive proposer', { proposerStatus: 'SUSPENDED' }],
    ['inactive proposer membership', { proposerMembershipStatus: 'DEACTIVATED' }],
    ['non-agent proposer membership', { proposerRole: 'MANAGER' }],
  ] as const)('returns the stable proposer conflict with no writes for an %s', async (_, options) => {
    const subject = candidate(options)
    await coded(subject.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), 'PROPERTY_PROPOSAL_PROPOSER_INELIGIBLE')
    expect(subject.materializer.createInTransaction).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposal.update).not.toHaveBeenCalled()
    expect(subject.durable).toMatchObject({ canonical: [], decisions: [], proposal: { state: 'EN_REVISION', version: 2 } })
  })

  it('approves exactly once in the same durable store after capacity is restored', async () => {
    const subject = candidate({ full: true })
    await coded(subject.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }), 'TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED')
    expect(subject.materializer.createInTransaction).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposal.update).not.toHaveBeenCalled()
    expect(subject.durable).toMatchObject({ canonical: [], decisions: [], proposal: { state: 'EN_REVISION', version: 2 } })

    subject.restoreCapacity()

    await expect(subject.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).resolves.toMatchObject({ state: 'APROBADA', version: 3 })
    expect(subject.materializer.createInTransaction).toHaveBeenCalledTimes(1)
    expect(subject.tx.propertyProposalReviewDecision.create).toHaveBeenCalledTimes(1)
    expect(subject.tx.propertyProposal.update).toHaveBeenCalledTimes(1)
    expect(subject.durable).toMatchObject({ canonical: [{ id: 'asset-1' }], decisions: [expect.anything()], proposal: { state: 'APROBADA', version: 3 } })
  })

  it('rolls back capacity-checked materialization and approval when the final proposal write fails', async () => {
    const subject = candidate({ failUpdate: true })
    await expect(subject.useCase.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).rejects.toThrow('update failure')
    expect(subject.events).toContain('capacity-assert')
    expect(subject.durable).toMatchObject({ canonical: [], decisions: [], proposal: { state: 'EN_REVISION', version: 2 } })
  })
})
