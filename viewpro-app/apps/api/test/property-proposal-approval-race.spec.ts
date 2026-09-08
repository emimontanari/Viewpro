/* eslint-disable vitest/no-conditional-expect */
import { randomUUID } from 'node:crypto'
import { ConflictException } from '@nestjs/common'
import { PrismaClient, PropertyOperationType, PropertyType, TenantRole } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ActivePropertyEngagementCapacity } from '../src/property-engagements/active-property-engagement-capacity'
import { CanonicalPropertyMaterializer } from '../src/property-engagements/canonical-property-materializer'
import { ApprovePropertyProposalUseCase } from '../src/property-proposals/use-cases/approve-property-proposal.use-case'
import { RejectPropertyProposalUseCase } from '../src/property-proposals/use-cases/reject-property-proposal.use-case'

type Decision = 'approve' | 'reject'
type Fixture = { tenantId: string; proposalId: string; roundId: string; proposerId: string; reviewerAId: string; reviewerBId: string }
type Barrier = { arrived: Promise<number>; release: () => void }

const timeoutMs = 8_000
const observationMs = 2_000
const disconnectDeadlineMs = 5_000
const prefix = `u11b2-${randomUUID().slice(0, 8)}`
const names = { winner: `${prefix}-winner`, loser: `${prefix}-loser`, observer: `${prefix}-observer` }

function url(name: string) {
  const value = new URL(process.env.DATABASE_URL ?? '')
  const database = decodeURIComponent(value.pathname).split('/').filter(Boolean).at(-1) ?? ''
  if (!['localhost', '127.0.0.1'].includes(value.hostname) || !/^[A-Za-z0-9][A-Za-z0-9_-]*_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(database)) {
    throw new Error('U11B2 requires a guarded localhost *_test DATABASE_URL')
  }
  value.searchParams.set('application_name', name)
  value.searchParams.set('connect_timeout', '3')
  value.searchParams.set('connection_limit', '1')
  value.searchParams.set('options', `-c statement_timeout=${timeoutMs} -c lock_timeout=${timeoutMs}`)
  return value.toString()
}

const winnerClient = new PrismaClient({ datasources: { db: { url: url(names.winner) } } })
const loserClient = new PrismaClient({ datasources: { db: { url: url(names.loser) } } })
const observerClient = new PrismaClient({ datasources: { db: { url: url(names.observer) } } })

function aggregate(errors: unknown[], error: unknown) {
  if (error instanceof AggregateError) errors.push(...error.errors)
  else errors.push(error)
}

async function disconnectWithDeadline(prisma: PrismaClient, name: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} disconnect exceeded ${disconnectDeadlineMs}ms`)), disconnectDeadlineMs)
  })
  try {
    await Promise.race([prisma.$disconnect(), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function throwFailures(errors: unknown[]) {
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'U11B2 race cleanup failures')
}

function pauseAfterProposalLock(client: PrismaClient): { prisma: PrismaClient; barrier: Barrier } {
  let arrive!: (pid: number) => void
  let release!: () => void
  let paused = false
  const arrived = new Promise<number>((resolve) => { arrive = resolve })
  const wait = new Promise<void>((resolve) => { release = resolve })
  const prisma = new Proxy(client, {
    get(target, property) {
      if (property !== '$transaction') return Reflect.get(target, property)
      return async (work: (tx: PrismaClient) => Promise<unknown>, options?: object) => target.$transaction(async (tx) => {
        const transaction = new Proxy(tx, {
          get(transactionTarget, transactionProperty) {
            if (transactionProperty !== '$queryRaw') return Reflect.get(transactionTarget, transactionProperty)
            return async (...args: unknown[]) => {
              const result = await (transactionTarget.$queryRaw as (...query: unknown[]) => Promise<unknown>)(...args)
              const sql = Array.isArray(args[0]) ? args[0].join(' ') : ''
              if (!paused && /property_proposals/i.test(sql) && /FOR UPDATE/i.test(sql)) {
                paused = true
                const [backend] = await transactionTarget.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
                arrive(backend!.pid)
                await wait
              }
              return result
            }
          },
        })
        return work(transaction as never)
      }, options as never)
    },
  })
  return { prisma, barrier: { arrived, release } }
}

async function pid(client: PrismaClient) {
  const [backend] = await client.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
  return backend!.pid
}

async function waitForWinner(barrier: Barrier, winner: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      barrier.arrived,
      winner.then(
        () => { throw new Error('winner settled before proposal-lock arrival') },
        (error) => { throw new Error('winner rejected before proposal-lock arrival', { cause: error }) },
      ),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('winner did not reach proposal lock')), observationMs) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function waitForBlock(loserPid: number, winnerPid: number, loser: Promise<unknown>) {
  let settled = false
  void loser.then(() => { settled = true; return undefined }, () => { settled = true; return undefined })
  const deadline = performance.now() + observationMs
  while (performance.now() < deadline) {
    if (settled) throw new Error('loser settled before lock observation')
    const [activity] = await observerClient.$queryRawUnsafe<{ pid: number; application_name: string; wait_event_type: string | null; blockers: number[] }[]>(
      `SELECT pid, application_name, wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid = ${loserPid}`,
    )
    if (activity?.wait_event_type === 'Lock') {
      expect(activity).toMatchObject({ pid: loserPid, application_name: names.loser })
      expect(activity.blockers).toEqual([winnerPid])
      return
    }
    await new Promise<void>(setImmediate)
  }
  expect.fail(`loser PID ${loserPid} did not wait only on winner PID ${winnerPid}`)
}

function fixture(): Fixture {
  return { tenantId: randomUUID(), proposalId: randomUUID(), roundId: randomUUID(), proposerId: randomUUID(), reviewerAId: randomUUID(), reviewerBId: randomUUID() }
}

async function setup(data: Fixture) {
  await winnerClient.user.createMany({ data: [data.proposerId, data.reviewerAId, data.reviewerBId].map((id, index) => ({ id, email: `${prefix}-${id}@test.local`, passwordHash: 'hash', firstName: index ? 'Reviewer' : 'Seller' })) })
  await winnerClient.tenant.create({ data: { id: data.tenantId, name: `${prefix} tenant`, slug: `${prefix}-${data.tenantId.slice(0, 8)}` } })
  await winnerClient.tenantMembership.createMany({ data: [
    { userId: data.proposerId, tenantId: data.tenantId, role: TenantRole.AGENT },
    { userId: data.reviewerAId, tenantId: data.tenantId, role: TenantRole.MANAGER },
    { userId: data.reviewerBId, tenantId: data.tenantId, role: TenantRole.PRINCIPAL_MANAGER },
  ] })
  await winnerClient.propertyProposal.create({ data: {
    id: data.proposalId, tenantId: data.tenantId, proposedByUserId: data.proposerId, state: 'EN_REVISION', version: 2,
    title: 'Race home', addressLine: 'Race 1', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE,
  } })
  await winnerClient.propertyProposalReviewRound.create({ data: {
    id: data.roundId, tenantId: data.tenantId, proposalId: data.proposalId, roundNumber: 1, submittedByUserId: data.proposerId,
    title: 'Race home', addressLine: 'Race 1', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE,
  } })
}

function command(kind: Decision, prisma: PrismaClient, data: Fixture, reviewerId: string) {
  const tenant = { tenantId: data.tenantId }
  const reviewer = { id: reviewerId, email: `${reviewerId}@test.local` }
  return kind === 'approve'
    ? new ApprovePropertyProposalUseCase(prisma as never, new CanonicalPropertyMaterializer(), new ActivePropertyEngagementCapacity()).execute(tenant as never, reviewer, data.proposalId, { reviewRoundId: data.roundId })
    : new RejectPropertyProposalUseCase(prisma as never).execute(tenant as never, reviewer, data.proposalId, { reviewRoundId: data.roundId, reason: 'Rejected in race' })
}

async function cleanup(data: Fixture) {
  const failures: unknown[] = []
  const attempt = async (work: () => Promise<unknown>) => { try { await work() } catch (error) { aggregate(failures, error) } }
  const [engagements, assets] = await Promise.all([
    winnerClient.propertyEngagement.findMany({ where: { tenantId: data.tenantId }, select: { id: true } }),
    winnerClient.propertyAsset.findMany({ where: { createdByUserId: data.proposerId }, select: { id: true } }),
  ]).catch((error) => { aggregate(failures, error); return [[], []] as const })
  await attempt(() => winnerClient.propertyEngagement.deleteMany({ where: { id: { in: engagements.map(({ id }) => id) } } }))
  await attempt(() => winnerClient.propertyAsset.deleteMany({ where: { id: { in: assets.map(({ id }) => id) } } }))
  await attempt(() => winnerClient.propertyProposal.deleteMany({ where: { id: data.proposalId } }))
  await attempt(() => winnerClient.tenant.deleteMany({ where: { id: data.tenantId } }))
  await attempt(() => winnerClient.user.deleteMany({ where: { id: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } } }))
  await attempt(async () => expect(await Promise.all([
    winnerClient.propertyEngagement.count({ where: { tenantId: data.tenantId } }),
    winnerClient.propertyAsset.count({ where: { createdByUserId: data.proposerId } }),
    winnerClient.propertyProposal.count({ where: { id: data.proposalId } }),
    winnerClient.tenant.count({ where: { id: data.tenantId } }),
    winnerClient.user.count({ where: { id: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } } }),
  ])).toEqual([0, 0, 0, 0, 0]))
  throwFailures(failures)
}

describe('property proposal approval PostgreSQL races', () => {
  beforeAll(async () => { await Promise.all([winnerClient.$connect(), loserClient.$connect(), observerClient.$connect()]) })
  afterAll(async () => {
    const results = await Promise.allSettled([
      disconnectWithDeadline(winnerClient, names.winner),
      disconnectWithDeadline(loserClient, names.loser),
      disconnectWithDeadline(observerClient, names.observer),
    ])
    throwFailures(results.filter((result) => result.status === 'rejected').map((result) => (result as PromiseRejectedResult).reason))
  })

  it.each([
    ['approve A before approve B', 'approve', 'approve', 'reviewerAId', 'reviewerBId', 'APROBADA'],
    ['approve B before approve A', 'approve', 'approve', 'reviewerBId', 'reviewerAId', 'APROBADA'],
    ['approve A before reject B', 'approve', 'reject', 'reviewerAId', 'reviewerBId', 'APROBADA'],
    ['reject B before approve A', 'reject', 'approve', 'reviewerBId', 'reviewerAId', 'RECHAZADA'],
  ] as const)('%s yields one durable decision and coded loser conflict', async (_, winnerKind, loserKind, winnerKey, loserKey, state) => {
    const data = fixture()
    const { prisma, barrier } = pauseAfterProposalLock(winnerClient)
    let winner: Promise<unknown> | undefined
    let loser: Promise<unknown> | undefined
    let expectedLoserConflict = false
    const failures: unknown[] = []
    try {
      await setup(data)
      winner = command(winnerKind, prisma, data, data[winnerKey])
      const winnerPid = await waitForWinner(barrier, winner)
      const loserPid = await pid(loserClient)
      loser = command(loserKind, loserClient, data, data[loserKey])
      await waitForBlock(loserPid, winnerPid, loser)
      barrier.release()
      await expect(winner).resolves.toMatchObject({ state })
      const error = await loser.then(() => new Error('loser unexpectedly succeeded'), (reason) => reason)
      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).getStatus()).toBe(409)
      expect((error as ConflictException).getResponse()).toEqual(expect.objectContaining({ errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT' }))
      expectedLoserConflict = true
      const [proposal, decisions, engagements, assets] = await Promise.all([
        winnerClient.propertyProposal.findUniqueOrThrow({ where: { id: data.proposalId } }),
        winnerClient.propertyProposalReviewDecision.findMany({ where: { tenantId: data.tenantId } }),
        winnerClient.propertyEngagement.findMany({ where: { tenantId: data.tenantId }, include: { propertyAsset: true, agents: true } }),
        winnerClient.propertyAsset.findMany({ where: { createdByUserId: data.proposerId } }),
      ])
      const sources = engagements.filter(({ sourceProposalId }) => sourceProposalId === data.proposalId)
      expect(proposal).toMatchObject({ id: data.proposalId, tenantId: data.tenantId, proposedByUserId: data.proposerId, state })
      expect(decisions).toEqual([expect.objectContaining({ tenantId: data.tenantId, reviewRoundId: data.roundId, reviewerUserId: data[winnerKey], outcome: state === 'APROBADA' ? 'APPROVED' : 'REJECTED' })])
      expect(engagements).toHaveLength(state === 'APROBADA' ? 1 : 0)
      expect(assets).toHaveLength(state === 'APROBADA' ? 1 : 0)
      expect(sources).toHaveLength(state === 'APROBADA' ? 1 : 0)
      if (state === 'APROBADA') {
        expect(sources[0]).toMatchObject({ tenantId: data.tenantId, sourceProposalId: data.proposalId, status: 'CAPTURE', propertyAsset: { id: assets[0]?.id, createdByUserId: data.proposerId }, agents: [{ agentUserId: data.proposerId, assignedByUserId: data[winnerKey], isPrimary: false }] })
      }
    } catch (error) {
      aggregate(failures, error)
    } finally {
      barrier.release()
      const [winnerSettlement, loserSettlement] = await Promise.allSettled([winner, loser].filter((promise): promise is Promise<unknown> => Boolean(promise)))
      if (winnerSettlement?.status === 'rejected') aggregate(failures, winnerSettlement.reason)
      if (loserSettlement?.status === 'rejected' && !expectedLoserConflict) aggregate(failures, loserSettlement.reason)
      try { await cleanup(data) } catch (error) { aggregate(failures, error) }
      throwFailures(failures)
    }
  }, 15_000)
})
