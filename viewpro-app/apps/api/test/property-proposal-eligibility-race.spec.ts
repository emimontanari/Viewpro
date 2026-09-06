/* eslint-disable vitest/no-conditional-expect */
import { randomUUID } from 'node:crypto'
import { PrismaClient, TenantMembershipStatus, TenantRole } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setEligibleSellerLockBarrierForTest } from '../src/property-proposals/helpers/lock-property-proposal'
import { PrismaPropertyProposalsRepository } from '../src/property-proposals/prisma-property-proposals.repository'

type Operation = 'create' | 'update'
type Invalidation = 'inactive' | 'manager'
type Fixture = {
  marker: string
  tenantId: string
  sellerId: string
  proposalId: string
  title: string
  version: number
}
type Barrier = { arrived: Promise<{ backendPid: number }>; release: () => void }

const prefix = `c5b2-${randomUUID().slice(0, 8)}`
const names = { operation: `${prefix}-op`, invalidation: `${prefix}-inv`, observer: `${prefix}-obs` }
const timeoutMs = 8_000
const observationDeadlineMs = 2_000

function guardedUrl(name: string) {
  const url = new URL(process.env.DATABASE_URL ?? '')
  const database = decodeURIComponent(url.pathname).split('/').filter(Boolean).at(-1) ?? ''
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[A-Za-z0-9][A-Za-z0-9_-]*_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(database)) {
    throw new Error('C5B2 requires a guarded localhost *_test DATABASE_URL')
  }
  url.searchParams.set('application_name', name)
  url.searchParams.set('connect_timeout', '3')
  url.searchParams.set('connection_limit', '1')
  url.searchParams.set('options', `-c statement_timeout=${timeoutMs} -c lock_timeout=${timeoutMs}`)
  return url.toString()
}

function client(name: string) {
  return new PrismaClient({ datasources: { db: { url: guardedUrl(name) } } })
}

const operationClient = client(names.operation)
const invalidationClient = client(names.invalidation)
const observerClient = client(names.observer)

function fixtureIdentity(): Fixture {
  const marker = randomUUID()
  return {
    marker,
    tenantId: randomUUID(),
    sellerId: randomUUID(),
    proposalId: randomUUID(),
    title: 'Before',
    version: 1,
  }
}

function barrier(operation: Operation): Barrier {
  let signalArrival!: (context: { backendPid: number }) => void
  let release!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  const arrived = new Promise<{ backendPid: number }>((resolve) => { signalArrival = resolve })
  setEligibleSellerLockBarrierForTest(async (context) => {
    if (context.operation === operation) {
      signalArrival(context)
      await wait
    }
  })
  return { arrived, release }
}

async function awaitBarrierArrivalOrCommand(
  held: Barrier,
  commandPromise: Promise<unknown>,
): Promise<{ backendPid: number }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`eligibility barrier was not reached within ${observationDeadlineMs}ms`)), observationDeadlineMs)
  })
  try {
    const result = await Promise.race([
      held.arrived.then((context) => ({ kind: 'arrived' as const, context })),
      commandPromise.then(
        () => { throw new Error('operation command fulfilled before eligibility barrier arrival') },
        (error: unknown) => { throw new Error('operation command rejected before eligibility barrier arrival', { cause: error }) },
      ),
      deadline,
    ])
    return result.context
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function waitForBlock(invalidationPid: number, operationPid: number) {
  const deadline = performance.now() + observationDeadlineMs
  while (performance.now() < deadline) {
    const [activity] = await observerClient.$queryRawUnsafe<{
      pid: number
      application_name: string
      query: string
      wait_event_type: string | null
      blockers: number[]
    }[]>(`SELECT pid, application_name, query, wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid = ${invalidationPid}`)
    if (activity?.wait_event_type === 'Lock' && activity.blockers.includes(operationPid)) {
      expect(activity).toMatchObject({ pid: invalidationPid, application_name: names.invalidation })
      expect(activity.query).toMatch(/UPDATE\s+"(?:public"\.)?"tenant_memberships"/i)
      return activity
    }
    await new Promise<void>(setImmediate)
  }
  expect.fail(`invalidation PID ${invalidationPid} did not block on operation PID ${operationPid}`)
}

async function setupFixture(operation: Operation, data: Fixture) {
  await operationClient.user.create({
    data: { id: data.sellerId, email: `c5b2-${data.marker}@test.local`, passwordHash: 'hash', firstName: 'Seller' },
  })
  await operationClient.tenant.create({
    data: { id: data.tenantId, name: `C5B2 ${data.marker}`, slug: `c5b2-${data.marker}` },
  })
  await operationClient.tenantMembership.create({
    data: { userId: data.sellerId, tenantId: data.tenantId, role: TenantRole.AGENT },
  })
  if (operation === 'update') {
    await operationClient.propertyProposal.create({
      data: {
        id: data.proposalId,
        tenantId: data.tenantId,
        proposedByUserId: data.sellerId,
        title: data.title,
        state: 'BORRADOR',
        version: data.version,
      },
    })
  }
}

function command(operation: Operation, data: Fixture) {
  const repository = new PrismaPropertyProposalsRepository(operationClient as never)
  return operation === 'create'
    ? repository.createDraft({ tenantId: data.tenantId, proposedByUserId: data.sellerId, title: 'Created', addressLine: null, city: null, province: null, propertyType: null, operationType: null, totalAreaSqm: null, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null })
    : repository.updateForSeller({ tenantId: data.tenantId, proposedByUserId: data.sellerId, proposalId: data.proposalId, expectedVersion: data.version, patch: { title: 'Updated' } })
}

async function invalidate(kind: Invalidation, data: Fixture, pid: (value: number) => void) {
  return invalidationClient.$transaction(async (tx) => {
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
    pid(backend!.pid)
    await tx.tenantMembership.update({
      where: { userId_tenantId: { userId: data.sellerId, tenantId: data.tenantId } },
      data: kind === 'inactive' ? { status: TenantMembershipStatus.DEACTIVATED } : { role: TenantRole.MANAGER },
    })
  }, { maxWait: timeoutMs, timeout: timeoutMs })
}

async function cleanupFixture(data: Fixture) {
  await operationClient.propertyProposal.deleteMany({ where: { tenantId: data.tenantId } })
  await operationClient.tenantMembership.deleteMany({ where: { tenantId: data.tenantId } })
  await operationClient.tenant.deleteMany({ where: { id: data.tenantId } })
  await operationClient.user.deleteMany({ where: { id: data.sellerId } })
  expect(await operationClient.propertyProposal.count({ where: { tenantId: data.tenantId } })).toBe(0)
  const [{ count }] = await observerClient.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE application_name IN (${names.operation}, ${names.invalidation}) AND state <> 'idle'`
  expect(Number(count)).toBe(0)
}

function addError(errors: unknown[], error: unknown) {
  if (error instanceof AggregateError) errors.push(...error.errors)
  else errors.push(error)
}

function throwFailures(errors: unknown[]) {
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, 'C5B2 race and cleanup failures')
}

describe('property proposal seller eligibility PostgreSQL races', () => {
  beforeAll(async () => {
    await Promise.all([operationClient.$connect(), invalidationClient.$connect(), observerClient.$connect()])
  })

  afterAll(async () => {
    setEligibleSellerLockBarrierForTest(null)
    const results = await Promise.allSettled([
      operationClient.$disconnect(),
      invalidationClient.$disconnect(),
      observerClient.$disconnect(),
    ])
    const failures: unknown[] = []
    for (const result of results) if (result.status === 'rejected') addError(failures, result.reason)
    throwFailures(failures)
  })

  it.each([
    ['create', 'inactive', 'command-lock-first'], ['create', 'manager', 'command-lock-first'],
    ['update', 'inactive', 'command-lock-first'], ['update', 'manager', 'command-lock-first'],
    ['create', 'inactive', 'invalidation-commit-first'], ['create', 'manager', 'invalidation-commit-first'],
    ['update', 'inactive', 'invalidation-commit-first'], ['update', 'manager', 'invalidation-commit-first'],
  ] as const)('%s / %s / %s preserves the commit-order eligibility boundary', async (operation, kind, order) => {
    const data = fixtureIdentity()
    let held: Barrier | undefined
    let commandPromise: Promise<unknown> | undefined
    let invalidationPromise: Promise<unknown> | undefined
    let primaryError: unknown

    try {
      await setupFixture(operation, data)
      held = barrier(operation)
      if (order === 'invalidation-commit-first') {
        let resolvePid!: (pid: number) => void
        const invalidationPid = new Promise<number>((resolve) => { resolvePid = resolve })
        invalidationPromise = invalidate(kind, data, resolvePid)
        expect(await invalidationPid).toBeGreaterThan(0)
        await invalidationPromise
        commandPromise = command(operation, data)
        await expect(commandPromise).resolves.toMatchObject({ kind: 'ineligible' })
        const result = operation === 'create'
          ? await operationClient.propertyProposal.count({ where: { tenantId: data.tenantId } })
          : await operationClient.propertyProposal.findUnique({ where: { id: data.proposalId } })
        expect(result).toEqual(operation === 'create' ? 0 : expect.objectContaining({ title: data.title, version: data.version }))
      } else {
        commandPromise = command(operation, data)
        const { backendPid: operationPid } = await awaitBarrierArrivalOrCommand(held, commandPromise)
        let resolvePid!: (pid: number) => void
        const invalidationPid = new Promise<number>((resolve) => { resolvePid = resolve })
        invalidationPromise = invalidate(kind, data, resolvePid)
        const blocked = await waitForBlock(await invalidationPid, operationPid)
        expect(blocked.blockers).toContain(operationPid)
        held.release()
        await expect(commandPromise).resolves.toMatchObject({ kind: operation === 'create' ? 'created' : 'updated' })
        await invalidationPromise
        const result = operation === 'create'
          ? await operationClient.propertyProposal.findMany({ where: { tenantId: data.tenantId } })
          : await operationClient.propertyProposal.findUnique({ where: { id: data.proposalId } })
        expect(result).toEqual(operation === 'create'
          ? [expect.objectContaining({ version: 1, title: 'Created' })]
          : expect.objectContaining({ version: data.version + 1, title: 'Updated' }))
      }
    } catch (error) {
      primaryError = error
    } finally {
      held?.release()
      setEligibleSellerLockBarrierForTest(null)
      const settlements = await Promise.allSettled([commandPromise, invalidationPromise].filter((promise): promise is Promise<unknown> => Boolean(promise)))
      const failures: unknown[] = []
      if (primaryError !== undefined) addError(failures, primaryError)
      for (const settlement of settlements) if (settlement.status === 'rejected') addError(failures, settlement.reason)
      try {
        await cleanupFixture(data)
      } catch (error) {
        addError(failures, error)
      }
      throwFailures(failures)
    }
  }, 12_000)
})
