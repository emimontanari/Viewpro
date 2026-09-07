import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import * as rolePermissions from '../../permissions/role-permissions'
import { RejectPropertyProposalUseCase } from './reject-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' }
const reviewer = { id: 'manager-1', email: 'manager@example.test' }
const proposal = { id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'EN_REVISION', version: 2 }
const exactDecision = { reviewerUserId: reviewer.id, outcome: 'REJECTED', rejectionReason: 'Needs photos' }

type Options = Partial<{ state: string; proposer: string; role: string; reviewerStatus: string; reviewerMembershipStatus: string; noReviewCapability: boolean; decision: object | null; lockAbsent: boolean; roundAbsent: boolean; updateFails: boolean }>

function makePrisma(options: Options = {}) {
  const events: string[] = []
  let current = { ...proposal, state: options.state ?? proposal.state, proposedByUserId: options.proposer ?? proposal.proposedByUserId }
  const durable = { decisions: [] as object[], get proposal() { return current } }
  let rawCall = 0
  const tx = {
    $queryRaw: vi.fn(async () => {
      const event = ['proposal', 'users', 'memberships'][rawCall++] ?? 'raw'
      events.push(event)
      if (event === 'proposal') return options.lockAbsent ? [] : [{ id: current.id }]
      if (event === 'users') return [{ id: 'manager-1', status: options.reviewerStatus ?? 'ACTIVE' }, { id: 'seller-1', status: 'ACTIVE' }]
      return [{ id: 'membership-manager', userId: 'manager-1', role: options.role ?? 'MANAGER', status: options.reviewerMembershipStatus ?? 'ACTIVE' }, { id: 'membership-seller', userId: 'seller-1', role: 'AGENT', status: 'ACTIVE' }]
    }),
    propertyProposal: {
      findFirst: vi.fn(async () => { events.push('find'); return current }),
      update: vi.fn(async ({ data }) => {
        if (options.updateFails) throw new Error('proposal update failure')
        current = { ...current, ...data, version: current.version + 1 }
        return current
      }),
    },
    propertyProposalReviewRound: { findFirst: vi.fn(async () => {
      events.push('round')
      return options.roundAbsent ? null : { id: 'round-1', decision: options.decision ?? durable.decisions.at(-1) ?? null }
    }) },
    propertyProposalReviewDecision: { create: vi.fn(async ({ data }) => { durable.decisions.push(data); return data }) },
  }
  const prisma = { $transaction: vi.fn(async (work) => {
    const before = { proposal: { ...current }, decisions: [...durable.decisions] }
    try { return await work(tx) } catch (error) {
      current = before.proposal
      durable.decisions.splice(0, durable.decisions.length, ...before.decisions)
      throw error
    }
  }) }
  return { prisma, tx, events, durable }
}

type ExceptionConstructor = { prototype: HttpException }

async function rejectedException(rejection: Promise<unknown>): Promise<HttpException> {
  const error = await rejection.then(() => new Error('expected rejection'), (caught: unknown) => caught)
  expect(error).toBeInstanceOf(HttpException)
  return error as HttpException
}

async function expectCoded(rejection: Promise<unknown>, type: ExceptionConstructor, status: number, errorCode: string) {
  const error = await rejectedException(rejection)
  expect(error).toBeInstanceOf(type as never)
  expect(error.getStatus()).toBe(status)
  expect(error.getResponse()).toEqual(expect.objectContaining({ errorCode }))
}

function execute(prisma: object, activeTenant: { tenantId: string } = tenant, ...reason: unknown[]) {
  return new RejectPropertyProposalUseCase(prisma as never).execute(activeTenant as never, reviewer, 'proposal-1', { reviewRoundId: 'round-1', reason: reason.length ? reason[0] : 'Needs photos' })
}

describe('RejectPropertyProposalUseCase', () => {
  it.each([undefined, null, 1, '', '  ', 'x'.repeat(1001)])('rejects invalid direct reason %j before opening a transaction', async (reason) => {
    const { prisma } = makePrisma()
    await expectCoded(execute(prisma, tenant, reason), BadRequestException, 400, 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('accepts exactly 1000 normalized characters and rejects 1001', async () => {
    const accepted = makePrisma()
    await expect(execute(accepted.prisma, tenant, ` ${'x'.repeat(1000)} `)).resolves.toEqual(expect.objectContaining({ state: 'RECHAZADA' }))
    expect(accepted.durable.decisions).toEqual([expect.objectContaining({ rejectionReason: 'x'.repeat(1000) })])
    const rejected = makePrisma()
    await expectCoded(execute(rejected.prisma, tenant, 'x'.repeat(1001)), BadRequestException, 400, 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID')
    expect(rejected.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('binds the exact tenant, proposal, reviewer, and proposer locks before rejection', async () => {
    const { prisma, tx, events } = makePrisma()
    await expect(execute(prisma, tenant, '  Needs photos  ')).resolves.toEqual(expect.objectContaining({ state: 'RECHAZADA', version: 3 }))
    expect(events).toEqual(['proposal', 'find', 'users', 'memberships', 'round'])
    const [proposalLock, userLock, membershipLock] = tx.$queryRaw.mock.calls as unknown as [unknown[], unknown[], unknown[]]
    expect(proposalLock.slice(1)).toEqual(['proposal-1', 'tenant-1'])
    expect(userLock[1]).toMatchObject({ values: ['manager-1', 'seller-1'] })
    expect(membershipLock.slice(1, 2)).toEqual(['tenant-1'])
    expect(membershipLock[2]).toMatchObject({ values: ['manager-1', 'seller-1'] })
    expect(tx.propertyProposalReviewDecision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1', reviewRoundId: 'round-1', reviewerUserId: 'manager-1', outcome: 'REJECTED', rejectionReason: 'Needs photos' }) }))
    expect(tx.propertyProposal.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'RECHAZADA', version: { increment: 1 } }) }))
    expect((tx as object)).not.toHaveProperty('propertyAsset')
  })

  it('maps missing and cross-tenant proposal locks to the exact coded 404 without writes', async () => {
    for (const activeTenant of [tenant, { tenantId: 'tenant-2' } as never]) {
      const absent = makePrisma({ lockAbsent: true })
      await expectCoded(execute(absent.prisma, activeTenant), NotFoundException, 404, 'PROPERTY_PROPOSAL_NOT_FOUND')
      const [proposalLock] = absent.tx.$queryRaw.mock.calls as unknown as [unknown[]]
      expect(proposalLock.slice(1)).toEqual(['proposal-1', activeTenant.tenantId])
      expect(absent.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
      expect(absent.tx.propertyProposal.update).not.toHaveBeenCalled()
    }
  })

  it('denies a former reviewer before their exact replay and performs no writes', async () => {
    const formerReviewer = makePrisma({ state: 'RECHAZADA', decision: exactDecision, role: 'AGENT' })
    const error = await rejectedException(execute(formerReviewer.prisma))
    expect(error).toBeInstanceOf(ForbiddenException)
    expect(error.getStatus()).toBe(403)
    expect(formerReviewer.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(formerReviewer.tx.propertyProposal.update).not.toHaveBeenCalled()
  })

    it('denies durable self-review with the exact coded 403 before replay or writes', async () => {
      const selfReview = makePrisma({ proposer: reviewer.id, state: 'RECHAZADA', decision: exactDecision })
      await expectCoded(execute(selfReview.prisma), ForbiddenException, 403, 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN')
      expect(selfReview.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
      expect(selfReview.tx.propertyProposal.update).not.toHaveBeenCalled()
    })

    it.each(['MANAGER', 'PRINCIPAL_MANAGER'] as const)('allows an active %s with review capability', async (role) => {
      const candidate = makePrisma({ role })
      await expect(execute(candidate.prisma)).resolves.toEqual(expect.objectContaining({ state: 'RECHAZADA', version: 3 }))
      expect(candidate.durable.decisions).toEqual([expect.objectContaining({ reviewerUserId: reviewer.id, outcome: 'REJECTED' })])
    })

    it.each([
      ['inactive user', { reviewerStatus: 'INACTIVE' }], ['inactive membership', { reviewerMembershipStatus: 'INACTIVE' }],
      ['unsupported role', { role: 'AGENT' }], ['manager without capability', { role: 'MANAGER', noReviewCapability: true }],
      ['principal manager without capability', { role: 'PRINCIPAL_MANAGER', noReviewCapability: true }],
    ] as const)('returns exact generic 403 for %s before decision or proposal writes', async (_, options) => {
      const candidate = makePrisma(options)
      const permissionSpy = 'noReviewCapability' in options && options.noReviewCapability ? vi.spyOn(rolePermissions, 'getPermissionsForRole').mockReturnValue([]) : undefined
      try {
        const error = await rejectedException(execute(candidate.prisma))
        expect(error.getResponse()).toEqual({ error: 'Forbidden', message: 'Insufficient permissions', statusCode: 403 })
        expect([candidate.tx.propertyProposalReviewDecision.create.mock.calls, candidate.tx.propertyProposal.update.mock.calls]).toEqual([[], []])
      } finally { permissionSpy?.mockRestore() }
    })

  it('returns the exact authorized replay without writes and codes every competing variant as 409', async () => {
    const replay = makePrisma({ state: 'RECHAZADA', decision: exactDecision })
    await expect(execute(replay.prisma, tenant, '  Needs photos ')).resolves.toEqual(expect.objectContaining({ state: 'RECHAZADA' }))
    expect(replay.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
    expect(replay.tx.propertyProposal.update).not.toHaveBeenCalled()
    for (const options of [
      { decision: { ...exactDecision, reviewerUserId: 'manager-2' } }, { decision: { ...exactDecision, rejectionReason: 'Other' } },
      { decision: { ...exactDecision, outcome: 'APPROVED' } }, { state: 'APROBADA' }, { state: 'EN_REVISION', decision: exactDecision }, { roundAbsent: true },
    ]) {
      const competing = makePrisma({ state: 'RECHAZADA', ...options })
      await expectCoded(execute(competing.prisma), ConflictException, 409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
      expect(competing.tx.propertyProposalReviewDecision.create).not.toHaveBeenCalled()
      expect(competing.tx.propertyProposal.update).not.toHaveBeenCalled()
    }
  })

  it('rolls back the staged rejection decision when the proposal update fails', async () => {
    const failedUpdate = makePrisma({ updateFails: true })
    await expect(execute(failedUpdate.prisma)).rejects.toThrow('proposal update failure')
    expect(failedUpdate.tx.propertyProposalReviewDecision.create).toHaveBeenCalledTimes(1)
    expect(failedUpdate.durable.decisions).toEqual([])
    expect(failedUpdate.durable.proposal).toEqual(expect.objectContaining({ state: 'EN_REVISION', version: 2 }))
  })
})
