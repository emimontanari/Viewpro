import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import * as rolePermissions from '../../permissions/role-permissions'
import { ApprovePropertyProposalUseCase } from './approve-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' }
const reviewer = { id: 'manager-1', email: 'manager@example.test' }
const proposal = { id: 'proposal-1', tenantId: tenant.tenantId, proposedByUserId: 'agent-1', state: 'APROBADA', version: 3 }
const round = {
  id: 'round-1', proposalId: proposal.id, tenantId: tenant.tenantId, roundNumber: 1,
  title: 'Home', addressLine: 'Street', city: 'City', province: 'Province', propertyType: 'HOUSE', operationType: 'SALE',
  totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null,
  orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null,
}

type Options = Partial<{
  initialState: string; decisionReviewerId: string; decisionOutcome: 'APPROVED' | 'REJECTED'; sourceTenantId: string | null
  reviewerStatus: string; reviewerMembershipStatus: string; reviewerRole: string; proposerStatus: string; proposerMembershipStatus: string
  proposerRole: string; selfReview: boolean; staleRound: boolean; missingDecision: boolean
}>

function candidate(options: Options = {}) {
  let current = { ...proposal, state: options.initialState ?? proposal.state, version: options.initialState ? 2 : proposal.version, proposedByUserId: options.selfReview ? reviewer.id : proposal.proposedByUserId }
  let sourceTenantId = options.sourceTenantId
  let proposerStatus = options.proposerStatus ?? 'ACTIVE'
  let proposerMembershipStatus = options.proposerMembershipStatus ?? 'ACTIVE'
  let proposerRole = options.proposerRole ?? 'AGENT'
  let decision: { reviewerUserId: string; outcome: string } | null = options.initialState || options.missingDecision
    ? null : { reviewerUserId: options.decisionReviewerId ?? reviewer.id, outcome: options.decisionOutcome ?? 'APPROVED' }
  let rawCall = 0
  const tx = {
    $queryRaw: vi.fn(async () => {
      if (rawCall++ === 0) return [{ id: current.id }]
      if (rawCall === 2) return [{ id: reviewer.id, status: options.reviewerStatus ?? 'ACTIVE' }, { id: current.proposedByUserId, status: proposerStatus }]
      return [
        { id: 'membership-reviewer', userId: reviewer.id, status: options.reviewerMembershipStatus ?? 'ACTIVE', role: options.reviewerRole ?? 'MANAGER' },
        { id: 'membership-proposer', userId: current.proposedByUserId, status: proposerMembershipStatus, role: proposerRole },
      ]
    }),
    propertyProposal: { findFirst: vi.fn(async () => current), update: vi.fn(async ({ data }) => current = { ...current, state: data.state, version: current.version + 1 }) },
    propertyProposalReviewRound: { findFirst: vi.fn(async () => ({ ...round, id: options.staleRound ? 'round-2' : round.id, decision })) },
    propertyEngagement: { findFirst: vi.fn(async ({ where }: { where: { sourceProposalId: string; tenantId: string } }) =>
      sourceTenantId === where.tenantId && where.sourceProposalId === proposal.id ? { id: 'engagement-1' } : null) },
    propertyProposalReviewDecision: { create: vi.fn(async ({ data }) => decision = { reviewerUserId: data.reviewerUserId, outcome: data.outcome }) },
  }
  const assertAvailable = vi.fn(async () => {})
  const capacity = { acquire: vi.fn(async () => ({ assertAvailable })) }
  const materializer = { createInTransaction: vi.fn(async () => { sourceTenantId = tenant.tenantId }) }
  const prisma = { $transaction: vi.fn(async (work) => { rawCall = 0; return work(tx) }) }
  return {
    subject: new ApprovePropertyProposalUseCase(prisma as never, materializer as never, capacity as never), tx, capacity, assertAvailable, materializer,
    changeProposer: (changes: { status?: string; membershipStatus?: string; role?: string }) => {
      proposerStatus = changes.status ?? proposerStatus
      proposerMembershipStatus = changes.membershipStatus ?? proposerMembershipStatus
      proposerRole = changes.role ?? proposerRole
    },
  }
}

async function conflict(promise: Promise<unknown>) {
  const error = await promise.then(() => new Error('expected conflict'), (reason) => reason)
  expect(error).toBeInstanceOf(ConflictException)
  expect((error as HttpException).getStatus()).toBe(409)
  expect((error as HttpException).getResponse()).toEqual(expect.objectContaining({ errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT' }))
}

describe('ApprovePropertyProposalUseCase approval replay', () => {
  it.each([
    ['a changed proposer role', { role: 'MANAGER' }],
    ['an inactive proposer membership', { membershipStatus: 'DEACTIVATED' }],
  ])('approves once then replays from the same durable store after %s', async (_, change) => {
    const subject = candidate({ initialState: 'EN_REVISION' })
    await expect(subject.subject.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).resolves.toMatchObject({ state: 'APROBADA', version: 3 })
    subject.changeProposer(change)
    await expect(subject.subject.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).resolves.toMatchObject({ state: 'APROBADA', version: 3 })
    expect(subject.assertAvailable).toHaveBeenCalledTimes(1)
    expect(subject.tx.propertyEngagement.findFirst).toHaveBeenCalledWith({ where: { sourceProposalId: proposal.id, tenantId: tenant.tenantId } })
    expect(subject.materializer.createInTransaction).toHaveBeenCalledTimes(1)
    expect(subject.tx.propertyProposalReviewDecision.create).toHaveBeenCalledTimes(1)
    expect(subject.tx.propertyProposal.update).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['different reviewer', { decisionReviewerId: 'manager-2', sourceTenantId: tenant.tenantId }],
    ['stale round', { staleRound: true, sourceTenantId: tenant.tenantId }],
    ['rejected decision', { decisionOutcome: 'REJECTED', sourceTenantId: tenant.tenantId }],
    ['missing decision', { missingDecision: true, sourceTenantId: tenant.tenantId }],
    ['missing source', { sourceTenantId: null }],
    ['cross-tenant source', { sourceTenantId: 'tenant-2' }],
  ] as const)('returns state conflict before proposer eligibility for %s', async (_, options) => {
    const subject = candidate({ ...options, proposerStatus: 'SUSPENDED' })
    await conflict(subject.subject.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id }))
    expect(subject.assertAvailable).not.toHaveBeenCalled()
    expect(subject.materializer.createInTransaction).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(subject.tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each([
    ['revoked reviewer', { reviewerStatus: 'SUSPENDED' }],
    ['revoked reviewer membership', { reviewerMembershipStatus: 'DEACTIVATED' }],
    ['reviewer role loss', { reviewerRole: 'AGENT' }],
    ['durable self-review', { selfReview: true }],
  ] as const)('denies %s before replay lookup', async (_, options) => {
    const subject = candidate({ ...options, sourceTenantId: tenant.tenantId })
    await expect(subject.subject.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).rejects.toBeInstanceOf(ForbiddenException)
    expect(subject.tx.propertyProposalReviewRound.findFirst).not.toHaveBeenCalled()
    expect(subject.tx.propertyEngagement.findFirst).not.toHaveBeenCalled()
  })

  it('denies lost reviewer capability before replay lookup', async () => {
    const capability = vi.spyOn(rolePermissions, 'getPermissionsForRole').mockReturnValue([])
    const subject = candidate({ sourceTenantId: tenant.tenantId })
    try {
      await expect(subject.subject.execute(tenant as never, reviewer, proposal.id, { reviewRoundId: round.id })).rejects.toBeInstanceOf(ForbiddenException)
      expect(subject.tx.propertyProposalReviewRound.findFirst).not.toHaveBeenCalled()
      expect(subject.tx.propertyEngagement.findFirst).not.toHaveBeenCalled()
    } finally {
      capability.mockRestore()
    }
  })
})
