import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createCodeDigest, createRecipientFingerprint } from '../src/property-imports/publisher-verification/challenge-code'
import { IssuePublisherChallengeUseCase, PublisherChallengeRateLimitError } from '../src/property-imports/publisher-verification/challenge-issuance.use-cases'
import { PrismaChallengeIssuanceRepository } from '../src/property-imports/publisher-verification/prisma-challenge-issuance.repository'

const secret = 'a-secure-challenge-test-secret-with-more-than-32-characters'
const dbUrl = process.env.DATABASE_URL ?? ''
const parsedDbUrl = new URL(dbUrl)
const databaseName = decodeURIComponent(parsedDbUrl.pathname).split('/').filter(Boolean).at(-1) ?? ''
if (!['localhost', '127.0.0.1'].includes(parsedDbUrl.hostname) || !/^[A-Za-z0-9][A-Za-z0-9_-]*_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(databaseName)) {
  throw new Error('Publisher challenge issuance tests require an isolated localhost *_test database')
}

const prefix = `challenge-issue-${randomUUID()}`
function client(name: string) {
  const url = new URL(dbUrl)
  url.searchParams.set('application_name', `${prefix}-${name}`)
  url.searchParams.set('connection_limit', '1')
  return new PrismaClient({ datasources: { db: { url: url.toString() } } })
}
const prisma = client('fixture')
const observer = client('observer')
afterAll(async () => { await Promise.all([prisma.$disconnect(), observer.$disconnect()]) })

type Fixture = { tenantId: string; publisherId: string; claimIds: string[]; clean: () => Promise<void> }
async function fixture() : Promise<Fixture> {
  const id = randomUUID()
  const tenantId = `challenge-tenant-${id}`
  const publisherId = `publisher-${id}`
  const claimIds = [randomUUID(), randomUUID(), randomUUID()]
  await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId } })
  await prisma.publisherClaim.createMany({ data: claimIds.map((claimId) => ({
    id: claimId, tenantId, externalSource: 'ZONAPROP', publisherId,
  })) })
  return {
    tenantId, publisherId, claimIds,
    clean: async () => {
      await prisma.publisherClaimChallenge.deleteMany({ where: { publisherClaimId: { in: claimIds } } })
      await prisma.publisherClaim.deleteMany({ where: { id: { in: claimIds } } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    },
  }
}
function useCase(database = prisma) {
  return new IssuePublisherChallengeUseCase(new PrismaChallengeIssuanceRepository(database), secret)
}
function issue(f: Fixture, options: { claimId?: string; tenantId?: string; publisherId?: string; method?: 'EMAIL' | 'LISTING'; recipient?: string } = {}) {
  return useCase().execute({
    tenantId: options.tenantId ?? f.tenantId,
    publisherClaimId: options.claimId ?? f.claimIds[0]!,
    publisherId: options.publisherId ?? f.publisherId,
    method: options.method ?? 'EMAIL',
    recipientAddress: options.recipient ?? 'Agent+tag@EXAMPLE.COM',
  })
}
async function dbNow(database = prisma) {
  const [row] = await database.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  return row!.now
}
async function seedChallenge(f: Fixture, recipient: string, issuedAt: Date, index: number) {
  const normalized = recipient.trim().replace(/@(.+)$/, (_match, domain: string) => `@${domain.toLowerCase()}`)
  const id = randomUUID()
  await prisma.publisherClaimChallenge.create({ data: {
    id, tenantId: f.tenantId, publisherClaimId: f.claimIds[index % f.claimIds.length]!, method: index % 2 ? 'LISTING' : 'EMAIL',
    codeDigest: createCodeDigest(secret, { tenantId: f.tenantId, publisherId: f.publisherId, challengeId: id, method: index % 2 ? 'LISTING' : 'EMAIL', code: '00000007' }),
    recipientFingerprint: createRecipientFingerprint(secret, f.tenantId, f.publisherId, normalized),
    issuedAt, expiresAt: new Date(issuedAt.getTime() + 900_000),
  } })
}

 describe('internal publisher challenge issuance', () => {
  it('persists only bound HMACs and uses method-specific expiry', async () => {
    const f = await fixture()
    try {
      const email = await issue(f)
      const emailRow = await prisma.publisherClaimChallenge.findUniqueOrThrow({ where: { id: email.challengeId } })
      expect(emailRow).toMatchObject({ tenantId: f.tenantId, publisherClaimId: f.claimIds[0], method: 'EMAIL' })
      expect(emailRow.codeDigest).toBe(createCodeDigest(secret, {
        tenantId: f.tenantId, publisherId: f.publisherId, challengeId: email.challengeId, method: 'EMAIL', code: email.code,
      }))
      expect(emailRow.recipientFingerprint).toBe(createRecipientFingerprint(secret, f.tenantId, f.publisherId, 'Agent+tag@example.com'))
      expect(emailRow.issuedAt).toEqual(email.issuedAt)
      expect(emailRow.expiresAt.getTime() - emailRow.issuedAt.getTime()).toBe(15 * 60_000)
      const stored = JSON.stringify(emailRow)
      expect(stored).not.toContain(email.code)
      expect(stored).not.toContain('Agent+tag@example.com')

      const listing = await issue(f, { method: 'LISTING', recipient: 'Listing@example.com' })
      const listingRow = await prisma.publisherClaimChallenge.findUniqueOrThrow({ where: { id: listing.challengeId } })
      expect(listingRow.expiresAt.getTime() - listingRow.issuedAt.getTime()).toBe(24 * 60 * 60_000)
      expect(JSON.stringify(listingRow)).not.toContain('Listing@example.com')
    } finally { await f.clean() }
  })

  it('requires the claim lookup to include the ZonaProp source before proceeding', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const tx = {
      publisherClaim: { findFirst },
      $executeRaw: vi.fn(),
      publisherClaimChallenge: { aggregate: vi.fn(), create: vi.fn() },
    }
    const database = { $transaction: (work: (transaction: unknown) => unknown) => work(tx) }
    const repository = new PrismaChallengeIssuanceRepository(database as unknown as PrismaClient)
    await expect(repository.issue({
      tenantId: 'tenant', publisherClaimId: 'claim', publisherId: 'publisher', challengeId: 'challenge',
      method: 'EMAIL', codeDigest: 'digest', recipientFingerprint: 'fingerprint', ttlMs: 900_000,
    })).rejects.toThrow('Publisher claim is not eligible')
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'claim', tenantId: 'tenant', externalSource: 'ZONAPROP', publisherId: 'publisher' },
      select: { id: true },
    })
    expect(tx.$executeRaw).not.toHaveBeenCalled()
    expect(tx.publisherClaimChallenge.create).not.toHaveBeenCalled()
  })

  it('rejects cross-tenant and publisher-mismatched claims before any challenge write', async () => {
    const f = await fixture()
    const other = await fixture()
    try {
      await expect(issue(f, { claimId: other.claimIds[0] })).rejects.toThrow('Publisher claim is not eligible for challenge issuance')
      await expect(issue(f, { tenantId: other.tenantId })).rejects.toThrow('Publisher claim is not eligible for challenge issuance')
      await expect(issue(f, { publisherId: 'different-publisher' })).rejects.toThrow('Publisher claim is not eligible for challenge issuance')
      expect(await prisma.publisherClaimChallenge.count({ where: { tenantId: { in: [f.tenantId, other.tenantId] } } })).toBe(0)
    } finally { await Promise.all([f.clean(), other.clean()]) }
  })

  it('enforces the 60-second cooldown across claims and methods and allows after its boundary', async () => {
    const f = await fixture()
    try {
      await seedChallenge(f, 'Agent+tag@example.com', new Date((await dbNow()).getTime() - 59_000), 0)
      await expect(issue(f, { claimId: f.claimIds[1], method: 'LISTING' })).rejects.toThrow('Publisher challenge issuance is rate limited')
      await prisma.publisherClaimChallenge.deleteMany({ where: { tenantId: f.tenantId } })
      await seedChallenge(f, 'Agent+tag@example.com', new Date((await dbNow()).getTime() - 61_000), 0)
      await expect(issue(f, { claimId: f.claimIds[1], method: 'LISTING' })).resolves.toMatchObject({ method: 'LISTING' })
    } finally { await f.clean() }
  })

  it('enforces three issues per rolling hour across claims and methods', async () => {
    const f = await fixture()
    try {
      const now = await dbNow()
      for (const [index, age] of [2, 4, 6].entries()) {
        await seedChallenge(f, 'Agent+tag@example.com', new Date(now.getTime() - age * 60_000), index)
      }
      await expect(issue(f, { claimId: f.claimIds[2], method: 'LISTING' })).rejects.toThrow('Publisher challenge issuance is rate limited')
      await prisma.publisherClaimChallenge.updateMany({
        where: { tenantId: f.tenantId }, data: { issuedAt: new Date(now.getTime() - 60 * 60_000 - 2_000) },
      })
      await expect(issue(f, { claimId: f.claimIds[2], method: 'LISTING' })).resolves.toMatchObject({ method: 'LISTING' })
    } finally { await f.clean() }
  })

  it('serializes overlapping issuances and snapshots database time only after the shared advisory lock', async () => {
    const f = await fixture()
    const holder = client('holder')
    const firstClient = client('waiter-a')
    const secondClient = client('waiter-b')
    let release!: () => void
    let markLocked!: (pid: number) => void
    const locked = new Promise<number>((resolve) => { markLocked = resolve })
    const held = new Promise<void>((resolve) => { release = resolve })
    try {
      const fingerprint = createRecipientFingerprint(secret, f.tenantId, f.publisherId, 'Agent+tag@example.com')
      const holdLock = holder.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint}, 0))`)
        const [row] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
        markLocked(row!.pid)
        await held
      })
      const holderPid = await locked
      const first = new IssuePublisherChallengeUseCase(new PrismaChallengeIssuanceRepository(firstClient), secret)
        .execute({ tenantId: f.tenantId, publisherClaimId: f.claimIds[0]!, publisherId: f.publisherId, method: 'EMAIL', recipientAddress: 'Agent+tag@example.com' })
      const second = new IssuePublisherChallengeUseCase(new PrismaChallengeIssuanceRepository(secondClient), secret)
        .execute({ tenantId: f.tenantId, publisherClaimId: f.claimIds[1]!, publisherId: f.publisherId, method: 'LISTING', recipientAddress: 'Agent+tag@example.com' })
      await waitForAdvisoryWaiters(holderPid, 2)
      const releaseTime = await dbNow(observer)
      release()
      await holdLock
      const outcomes = await Promise.allSettled([first, second])
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
      const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
      expect(rejected).toHaveLength(1)
      expect(rejected[0]!.reason).toBeInstanceOf(PublisherChallengeRateLimitError)
      expect(await prisma.publisherClaimChallenge.count({ where: { tenantId: f.tenantId } })).toBe(1)
      const [row] = await prisma.publisherClaimChallenge.findMany({ where: { tenantId: f.tenantId } })
      expect(row!.issuedAt).toBeInstanceOf(Date)
      expect(row!.issuedAt.getTime()).toBeGreaterThanOrEqual(releaseTime.getTime())
    } finally {
      release?.()
      await Promise.allSettled([holder.$disconnect(), firstClient.$disconnect(), secondClient.$disconnect()])
      await f.clean()
    }
  }, 20_000)
})

async function waitForAdvisoryWaiters(holderPid: number, expected: number) {
  const deadline = performance.now() + 8_000
  while (performance.now() < deadline) {
    const waiters = await observer.$queryRaw<{ pid: number; application_name: string; blockers: number[] }[]>`
      SELECT pid, application_name, pg_blocking_pids(pid) AS blockers
      FROM pg_stat_activity
      WHERE application_name LIKE ${`${prefix}-waiter-%`} AND wait_event_type = 'Lock' AND wait_event = 'advisory'
    `
    const blockedByHolder = waiters.filter((waiter) => waiter.blockers.includes(holderPid))
    const names = blockedByHolder.map((waiter) => waiter.application_name).sort()
    if (blockedByHolder.length === expected && names[0] === `${prefix}-waiter-a` && names[1] === `${prefix}-waiter-b`) return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  expect.fail(`Expected ${expected} issuance transactions to wait on advisory lock held by PID ${holderPid}`)
}
