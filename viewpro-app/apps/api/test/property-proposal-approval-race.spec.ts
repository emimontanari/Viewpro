/* eslint-disable vitest/no-conditional-expect */
import { randomUUID } from 'node:crypto'
import { ConflictException } from '@nestjs/common'
import { PrismaClient, PropertyOperationType, PropertyType, TenantRole } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ActivePropertyEngagementCapacity } from '../src/property-engagements/active-property-engagement-capacity'
import { PrismaPropertyEngagementsRepository } from '../src/property-engagements/prisma-property-engagements.repository'
import { TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED_MESSAGE } from '../src/tenant-limits/tenant-limit-enforcement.constants'
import { CanonicalPropertyMaterializer } from '../src/property-engagements/canonical-property-materializer'
import { ApprovePropertyProposalUseCase } from '../src/property-proposals/use-cases/approve-property-proposal.use-case'
import { RejectPropertyProposalUseCase } from '../src/property-proposals/use-cases/reject-property-proposal.use-case'

type Decision = 'approve' | 'reject'
type CapacityOperation = 'approve-a' | 'approve-b' | 'direct-create' | 'active-restore'
type Fixture = { tenantId: string; proposalId: string; roundId: string; secondProposalId: string; secondRoundId: string; restoreEngagementId: string; restoreAssetId: string; proposerId: string; reviewerAId: string; reviewerBId: string }
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

function pauseAfterTenantLock(client: PrismaClient): { prisma: PrismaClient; barrier: Barrier } {
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
              if (!paused && /SELECT\s+id\s+FROM\s+tenants\s+WHERE\s+id\s*=/i.test(sql) && /FOR\s+UPDATE/i.test(sql)) {
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
        () => { throw new Error('winner settled before tenant-lock arrival') },
        (error) => { throw new Error('winner rejected before tenant-lock arrival', { cause: error }) },
      ),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('winner did not reach tenant lock')), observationMs) }),
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
  return { tenantId: randomUUID(), proposalId: randomUUID(), roundId: randomUUID(), secondProposalId: randomUUID(), secondRoundId: randomUUID(), restoreEngagementId: randomUUID(), restoreAssetId: randomUUID(), proposerId: randomUUID(), reviewerAId: randomUUID(), reviewerBId: randomUUID() }
}

async function setup(data: Fixture, needsRestore = false) {
  await winnerClient.user.createMany({ data: [data.proposerId, data.reviewerAId, data.reviewerBId].map((id, index) => ({ id, email: `${prefix}-${id}@test.local`, passwordHash: 'hash', firstName: index ? 'Reviewer' : 'Seller' })) })
  await winnerClient.tenant.create({ data: { id: data.tenantId, name: `${prefix} tenant`, slug: `${prefix}-${data.tenantId.slice(0, 8)}`, maxActivePropertyEngagements: 1 } })
  await winnerClient.tenantMembership.createMany({ data: [
    { userId: data.proposerId, tenantId: data.tenantId, role: TenantRole.AGENT },
    { userId: data.reviewerAId, tenantId: data.tenantId, role: TenantRole.MANAGER },
    { userId: data.reviewerBId, tenantId: data.tenantId, role: TenantRole.PRINCIPAL_MANAGER },
  ] })
  for (const [proposalId, roundId, title] of [[data.proposalId, data.roundId, 'Race home A'], [data.secondProposalId, data.secondRoundId, 'Race home B']] as const) {
    await winnerClient.propertyProposal.create({ data: { id: proposalId, tenantId: data.tenantId, proposedByUserId: data.proposerId, state: 'EN_REVISION', version: 2, title, addressLine: 'Race 1', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE } })
    await winnerClient.propertyProposalReviewRound.create({ data: { id: roundId, tenantId: data.tenantId, proposalId, roundNumber: 1, submittedByUserId: data.proposerId, title, addressLine: 'Race 1', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE } })
  }
  if (needsRestore) {
    await winnerClient.propertyAsset.create({ data: { id: data.restoreAssetId, title: 'Archived race home', addressLine: 'Race 2', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, createdByUserId: data.reviewerBId } })
    await winnerClient.propertyEngagement.create({ data: { id: data.restoreEngagementId, tenantId: data.tenantId, propertyAssetId: data.restoreAssetId, operationType: PropertyOperationType.SALE, status: 'CAPTURE', createdByUserId: data.reviewerBId, archivedAt: new Date(), archivedByUserId: data.reviewerBId, archiveReason: 'Final-slot restore fixture' } })
  }
}

function command(kind: Decision, prisma: PrismaClient, data: Fixture, reviewerId: string, proposalId = data.proposalId, roundId = data.roundId) {
  const tenant = { tenantId: data.tenantId }
  const reviewer = { id: reviewerId, email: `${reviewerId}@test.local` }
  return kind === 'approve'
    ? new ApprovePropertyProposalUseCase(prisma as never, new CanonicalPropertyMaterializer(), new ActivePropertyEngagementCapacity()).execute(tenant as never, reviewer, proposalId, { reviewRoundId: roundId })
    : new RejectPropertyProposalUseCase(prisma as never).execute(tenant as never, reviewer, proposalId, { reviewRoundId: roundId, reason: 'Rejected in race' })
}

function capacityCommand(operation: CapacityOperation, prisma: PrismaClient, data: Fixture) {
  if (operation === 'approve-a') return command('approve', prisma, data, data.reviewerAId)
  if (operation === 'approve-b') return command('approve', prisma, data, data.reviewerBId, data.secondProposalId, data.secondRoundId)
  const repository = new PrismaPropertyEngagementsRepository(prisma as never, new ActivePropertyEngagementCapacity())
  if (operation === 'direct-create') return repository.createWithAsset({ tenantId: data.tenantId, createdByUserId: data.reviewerBId, propertyAsset: { title: 'Direct race home', addressLine: 'Race 3', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, createdByUserId: data.reviewerBId }, engagement: { operationType: PropertyOperationType.SALE, status: 'CAPTURE' } })
  return repository.restoreForTenant({ tenantId: data.tenantId, engagementId: data.restoreEngagementId, userId: data.reviewerBId, canViewAll: true })
}

async function cleanup(data: Fixture) {
  const failures: unknown[] = []
  const attempt = async (work: () => Promise<unknown>) => { try { await work() } catch (error) { aggregate(failures, error) } }
  const engagementIds = new Set([data.restoreEngagementId])
  const assetIds = new Set([data.restoreAssetId])
  const [engagementDiscovery, assetDiscovery] = await Promise.allSettled([
    winnerClient.propertyEngagement.findMany({ where: { tenantId: data.tenantId }, select: { id: true } }),
    winnerClient.propertyAsset.findMany({ where: { createdByUserId: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } }, select: { id: true } }),
  ])
  if (engagementDiscovery.status === 'fulfilled') for (const { id } of engagementDiscovery.value) engagementIds.add(id)
  else aggregate(failures, engagementDiscovery.reason)
  if (assetDiscovery.status === 'fulfilled') for (const { id } of assetDiscovery.value) assetIds.add(id)
  else aggregate(failures, assetDiscovery.reason)
  await attempt(() => winnerClient.propertyEngagement.deleteMany({ where: { OR: [{ id: { in: [...engagementIds] } }, { tenantId: data.tenantId }] } }))
  await attempt(() => winnerClient.propertyAsset.deleteMany({ where: { OR: [{ id: { in: [...assetIds] } }, { createdByUserId: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } }] } }))
  await attempt(() => winnerClient.propertyProposal.deleteMany({ where: { id: { in: [data.proposalId, data.secondProposalId] } } }))
  await attempt(() => winnerClient.tenant.deleteMany({ where: { id: data.tenantId } }))
  await attempt(() => winnerClient.user.deleteMany({ where: { id: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } } }))
  await attempt(async () => expect(await Promise.all([
    winnerClient.propertyEngagement.count({ where: { tenantId: data.tenantId } }),
    winnerClient.propertyAsset.count({ where: { createdByUserId: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } } }),
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

  it.each([
  ['approval A before approval B', 'approve-a', 'approve-b'],
  ['approval B before approval A', 'approve-b', 'approve-a'],
  ['approval before direct create', 'approve-a', 'direct-create'],
  ['direct create before approval', 'direct-create', 'approve-a'],
  ['approval before active restore', 'approve-a', 'active-restore'],
  ['active restore before approval', 'active-restore', 'approve-a'],
] as const)('%s consumes the final tenant slot exactly once', async (_, winnerOperation, loserOperation) => {
  const data = fixture()
  const { prisma, barrier } = pauseAfterTenantLock(winnerClient)
  let winner: Promise<unknown> | undefined
  let loser: Promise<unknown> | undefined
  let expectedLoserFailure = false
  const failures: unknown[] = []
  const approvalOperation = (operation: CapacityOperation) => operation === 'approve-a' || operation === 'approve-b'
  const approvalProposalId = (operation: CapacityOperation) => operation === 'approve-b' ? data.secondProposalId : data.proposalId
  try {
    await setup(data, winnerOperation === 'active-restore' || loserOperation === 'active-restore')
    winner = capacityCommand(winnerOperation, prisma, data)
    const winnerPid = await waitForWinner(barrier, winner)
    const loserPid = await pid(loserClient)
    loser = capacityCommand(loserOperation, loserClient, data)
    await waitForBlock(loserPid, winnerPid, loser)
    barrier.release()
    await expect(winner).resolves.toBeDefined()
    const error = await loser.then(() => new Error('loser unexpectedly consumed capacity'), (reason) => reason)
    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).getStatus()).toBe(409)
    if (approvalOperation(loserOperation)) expect((error as ConflictException).getResponse()).toMatchObject({ errorCode: 'TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED' })
    else expect((error as ConflictException).getResponse()).toEqual({ statusCode: 409, error: 'Conflict', message: TENANT_ACTIVE_PROPERTY_ENGAGEMENT_LIMIT_EXCEEDED_MESSAGE })
    expectedLoserFailure = true
    const [engagements, assets, decisions, proposals] = await Promise.all([
      winnerClient.propertyEngagement.findMany({ where: { tenantId: data.tenantId }, include: { propertyAsset: true, agents: true, movements: true } }),
      winnerClient.propertyAsset.findMany({ where: { createdByUserId: { in: [data.proposerId, data.reviewerAId, data.reviewerBId] } } }),
      winnerClient.propertyProposalReviewDecision.findMany({ where: { tenantId: data.tenantId } }),
      winnerClient.propertyProposal.findMany({ where: { id: { in: [data.proposalId, data.secondProposalId] } } }),
    ])
    const expectedAggregateCount = loserOperation === 'active-restore' ? 2 : 1
    expect(engagements).toHaveLength(expectedAggregateCount)
    expect(assets).toHaveLength(expectedAggregateCount)
    expect(engagements.filter(({ archivedAt, status }) => archivedAt === null && !['CLOSED', 'CANCELLED'].includes(status))).toHaveLength(1)
    if (approvalOperation(winnerOperation)) {
      const proposalId = approvalProposalId(winnerOperation)
      const roundId = proposalId === data.proposalId ? data.roundId : data.secondRoundId
      const reviewerId = winnerOperation === 'approve-a' ? data.reviewerAId : data.reviewerBId
      const proposal = proposals.find(({ id }) => id === proposalId)
      const sources = engagements.filter(({ sourceProposalId }) => sourceProposalId === proposalId)
      expect(proposal).toMatchObject({ state: 'APROBADA', tenantId: data.tenantId, proposedByUserId: data.proposerId })
      expect(decisions).toEqual([expect.objectContaining({ tenantId: data.tenantId, reviewRoundId: roundId, reviewerUserId: reviewerId, outcome: 'APPROVED' })])
      expect(sources).toHaveLength(1)
      expect(sources[0]).toMatchObject({ sourceProposalId: proposalId, status: 'CAPTURE', createdByUserId: data.proposerId, propertyAsset: { createdByUserId: data.proposerId }, agents: [{ agentUserId: data.proposerId, assignedByUserId: reviewerId, isPrimary: false }] })
    } else {
      expect(decisions).toHaveLength(0)
      if (winnerOperation === 'direct-create') {
        const directEngagements = engagements.filter(({ archivedAt }) => archivedAt === null)
        expect(directEngagements).toHaveLength(1)
        expect(directEngagements[0]).toMatchObject({ sourceProposalId: null, createdByUserId: data.reviewerBId, propertyAsset: { createdByUserId: data.reviewerBId } })
      }
    }
    if (approvalOperation(loserOperation)) {
      const proposalId = approvalProposalId(loserOperation)
      const roundId = proposalId === data.proposalId ? data.roundId : data.secondRoundId
      expect(proposals.find(({ id }) => id === proposalId)).toMatchObject({ id: proposalId, tenantId: data.tenantId, proposedByUserId: data.proposerId, state: 'EN_REVISION', version: 2, title: proposalId === data.proposalId ? 'Race home A' : 'Race home B', addressLine: 'Race 1', city: 'City', province: 'Province', propertyType: PropertyType.HOUSE, operationType: PropertyOperationType.SALE })
      expect(decisions.filter(({ reviewRoundId }) => reviewRoundId === roundId)).toEqual([])
      expect(decisions).toHaveLength(approvalOperation(winnerOperation) ? 1 : 0)
    }
    const restore = engagements.find(({ id }) => id === data.restoreEngagementId)
    if (winnerOperation === 'active-restore') expect(restore).toMatchObject({ archivedAt: null, archivedByUserId: null, archiveReason: null, movements: [expect.objectContaining({ tenantId: data.tenantId, propertyEngagementId: data.restoreEngagementId, createdByUserId: data.reviewerBId, type: 'RESTORED', observation: 'Property restored', source: 'MANUAL' })] })
    if (loserOperation === 'active-restore') expect(restore).toMatchObject({ archivedAt: expect.any(Date), archivedByUserId: data.reviewerBId, archiveReason: 'Final-slot restore fixture', movements: [] })
  } catch (error) {
    aggregate(failures, error)
  } finally {
    barrier.release()
    const settlements = await Promise.allSettled([winner, loser].filter((promise): promise is Promise<unknown> => Boolean(promise)))
    if (settlements[0]?.status === 'rejected') aggregate(failures, settlements[0].reason)
    if (settlements[1]?.status === 'rejected' && !expectedLoserFailure) aggregate(failures, settlements[1].reason)
    try { await cleanup(data) } catch (error) { aggregate(failures, error) }
    throwFailures(failures)
  }
}, 15_000)
    })
