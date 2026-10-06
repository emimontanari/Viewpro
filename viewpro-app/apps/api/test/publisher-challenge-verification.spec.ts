import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createCodeDigest } from '../src/property-imports/publisher-verification/challenge-code'
import { PrismaChallengeVerificationRepository } from '../src/property-imports/publisher-verification/prisma-challenge-verification.repository'

const timingSafeEqualCalls = vi.hoisted(() => [] as Array<[Buffer, Buffer]>)
vi.mock('node:crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:crypto')>()
  return {
    ...original,
    timingSafeEqual: (left: Buffer, right: Buffer) => {
      timingSafeEqualCalls.push([left, right])
      return original.timingSafeEqual(left, right)
    },
  }
})

const secret = 'a-secure-challenge-test-secret-with-more-than-32-characters'
const dbUrl = process.env.DATABASE_URL ?? ''
const parsedDbUrl = new URL(dbUrl)
const databaseName = decodeURIComponent(parsedDbUrl.pathname).split('/').filter(Boolean).at(-1) ?? ''
if (!['localhost', '127.0.0.1'].includes(parsedDbUrl.hostname) || !/^viewpro_456_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(databaseName)) {
  throw new Error('Publisher challenge verification tests require the explicit viewpro_456_test database or its isolated worker database')
}
const db = new PrismaClient({ datasources: { db: { url: dbUrl } } })
afterAll(async () => db.$disconnect())

type Fixture = { tenantId: string; otherTenantId: string; claimId: string; peerClaimId: string; otherClaimId: string; challengeId: string; clean: () => Promise<void> }
async function fixture(options: { attempts?: number; expired?: boolean; consumed?: boolean; claimState?: 'PENDING' | 'APPROVED' } = {}): Promise<Fixture> {
  const id = randomUUID()
  const tenantId = `challenge-verify-${id}`
  const otherTenantId = `${tenantId}-other`
  const claimId = randomUUID()
  const peerClaimId = randomUUID()
  const otherClaimId = randomUUID()
  const challengeId = randomUUID()
  await db.tenant.createMany({ data: [tenantId, otherTenantId].map((tenant) => ({ id: tenant, name: tenant, slug: tenant })) })
  await db.publisherClaim.createMany({ data: [
    { id: claimId, tenantId, externalSource: 'ZONAPROP', publisherId: `publisher-${id}`, state: options.claimState ?? 'PENDING' },
    { id: peerClaimId, tenantId, externalSource: 'ZONAPROP', publisherId: `publisher-${id}` },
    { id: otherClaimId, tenantId: otherTenantId, externalSource: 'ZONAPROP', publisherId: `publisher-${id}` },
  ] })
  const now = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  const issuedAt = now[0]!.now
  await db.publisherClaimChallenge.create({ data: {
    id: challengeId, tenantId, publisherClaimId: claimId, method: 'EMAIL',
    codeDigest: createCodeDigest(secret, { tenantId, publisherId: `publisher-${id}`, challengeId, method: 'EMAIL', code: '12345678' }),
    recipientFingerprint: 'not-used', attempts: options.attempts ?? 0, issuedAt,
    expiresAt: new Date(issuedAt.getTime() + (options.expired ? -1 : 60_000)),
    consumedAt: options.consumed ? issuedAt : null,
  } })
  return { tenantId, otherTenantId, claimId, peerClaimId, otherClaimId, challengeId, clean: async () => {
    await db.publisherClaimEvent.deleteMany({ where: { publisherClaimId: { in: [claimId, peerClaimId, otherClaimId] } } })
    await db.publisherClaimChallenge.deleteMany({ where: { id: challengeId } })
    await db.publisherClaim.deleteMany({ where: { id: { in: [claimId, peerClaimId, otherClaimId] } } })
    await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } })
  } }
}

async function check(f: Fixture, code: string, options: { tenantId?: string; claimId?: string; challengeId?: string } = {}) {
  return db.$transaction(async (tx) => new PrismaChallengeVerificationRepository(secret).validate(tx, {
    tenantId: options.tenantId ?? f.tenantId, publisherClaimId: options.claimId ?? f.claimId,
    challengeId: options.challengeId ?? f.challengeId, code,
  }))
}

describe('internal publisher challenge verification', () => {
  it('accepts valid code only as transaction-local control flow and leaves claim/challenge/audit untouched', async () => {
    const f = await fixture()
    try {
      await expect(check(f, '12345678')).resolves.toBe('validated')
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: 0, consumedAt: null })
      expect(await db.publisherClaim.findUniqueOrThrow({ where: { id: f.claimId } })).toMatchObject({ state: 'PENDING', approvedAt: null })
      expect(await db.publisherClaimEvent.count({ where: { publisherClaimId: f.claimId } })).toBe(0)
    } finally { await f.clean() }
  })

  it('locks the eligible ZONAPROP claim before its challenge and takes one clock snapshot afterward', async () => {
    const challengeId = randomUUID()
    const claim = { id: 'claim', tenantId: 'tenant', externalSource: 'ZONAPROP', publisherId: 'publisher', state: 'PENDING' }
    const challenge = { id: challengeId, tenantId: 'tenant', publisherClaimId: 'claim', method: 'EMAIL',
      codeDigest: createCodeDigest(secret, { tenantId: 'tenant', publisherId: 'publisher', challengeId, method: 'EMAIL', code: '12345678' }),
      attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null }
    const raw = vi.fn().mockResolvedValueOnce([claim]).mockResolvedValueOnce([challenge]).mockResolvedValueOnce([{ now: new Date() }])
    const tx = { $queryRaw: raw }
    await expect(new PrismaChallengeVerificationRepository(secret).validate(tx as unknown as Prisma.TransactionClient, {
      tenantId: 'tenant', publisherClaimId: 'claim', challengeId, code: '12345678',
    })).resolves.toBe('validated')
    const queries = raw.mock.calls.map(([query]) => (query as Prisma.Sql).sql)
    expect(queries[0]).toContain('"externalSource" = \'ZONAPROP\'')
    expect(queries[0]).toContain('"state" = \'PENDING\'')
    expect(queries[0]).toContain('FOR UPDATE')
    expect(queries[1]).toContain('FOR UPDATE')
    expect(queries[2]).toContain('clock_timestamp()')
    expect(raw).toHaveBeenCalledTimes(3)
  })

  it('fails closed without disclosure for tenant or claim mismatch', async () => {
    const f = await fixture()
    const other = await fixture()
    try {
      await expect(check(f, '12345678', { tenantId: other.tenantId })).resolves.toBe('ineligible')
      await expect(check(f, '12345678', { claimId: other.claimId })).resolves.toBe('ineligible')
      await expect(check(f, '12345678', { claimId: f.peerClaimId })).resolves.toBe('ineligible')
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: 0 })
    } finally { await Promise.all([f.clean(), other.clean()]) }
  })

  it.each([
    ['expired', { expired: true }], ['consumed', { consumed: true }], ['exhausted', { attempts: 5 }], ['non-pending claim', { claimState: 'APPROVED' as const }],
  ])('does not check or audit an ineligible %s challenge', async (_label, options) => {
    const f = await fixture(options)
    try {
      await expect(check(f, '12345678')).resolves.toBe('ineligible')
      const expectedAttempts = 'attempts' in options ? options.attempts : 0
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: expectedAttempts })
      expect(await db.publisherClaimEvent.count({ where: { publisherClaimId: f.claimId } })).toBe(0)
    } finally { await f.clean() }
  })

  it('allows the correct fifth attempt after four wrong attempts', async () => {
    const f = await fixture()
    try {
      for (let attempt = 1; attempt <= 4; attempt++) await expect(check(f, '87654321')).resolves.toBe('invalid')
      await expect(check(f, '12345678')).resolves.toBe('validated')
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: 4, consumedAt: null })
      const events = await db.publisherClaimEvent.findMany({ where: { publisherClaimId: f.claimId } })
      expect(events).toHaveLength(4)
      const fourthAttempt = events.find((event) => (event.metadata as { attempt?: number } | null)?.attempt === 4)
      expect(fourthAttempt).toMatchObject({ eventType: 'publisher_challenge_attempt_failed', verificationMethod: 'EMAIL_CODE', reason: 'invalid_code', actorUserId: null, metadata: { attempt: 4, maxAttempts: 5 } })
    } finally { await f.clean() }
  })

  it('durably audits malformed and wrong codes, exhausts at five, and never increments afterward', async () => {
    const f = await fixture()
    try {
      for (const code of ['bad', '87654321', '87654321', '87654321', '87654321']) await expect(check(f, code)).resolves.toBe('invalid')
      await expect(check(f, '12345678')).resolves.toBe('ineligible')
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: 5, consumedAt: null })
      const events = await db.publisherClaimEvent.findMany({ where: { publisherClaimId: f.claimId } })
      expect(events).toHaveLength(5)
      const attempts = events.map((event) => (event.metadata as { attempt: number }).attempt).sort((a, b) => a - b)
      expect(attempts).toEqual([1, 2, 3, 4, 5])
      expect(events.every((event) => event.eventType === 'publisher_challenge_attempt_failed' && event.reason === 'invalid_code' && (event.metadata as { maxAttempts: number }).maxAttempts === 5)).toBe(true)
    } finally { await f.clean() }
  })

  it('uses timingSafeEqual with equal-length digest bytes even for malformed codes', async () => {
    const f = await fixture()
    try {
      timingSafeEqualCalls.length = 0
      await expect(check(f, 'bad')).resolves.toBe('invalid')
      expect(timingSafeEqualCalls).toHaveLength(1)
      const [candidate, stored] = timingSafeEqualCalls[0]!
      expect(candidate).toBeInstanceOf(Buffer)
      expect(stored).toBeInstanceOf(Buffer)
      expect(candidate.byteLength).toBe(stored.byteLength)
    } finally { await f.clean() }
  })

  it('requires a caller-owned transaction client and writes failure audit inside that transaction', async () => {
    const f = await fixture()
    try {
      const repository = new PrismaChallengeVerificationRepository(secret)
      let transactionState: { attempts: number; eventCount: number } | undefined
      try {
        await db.$transaction(async (tx) => {
          await repository.validate(tx, { tenantId: f.tenantId, publisherClaimId: f.claimId, challengeId: f.challengeId, code: 'bad' })
          transactionState = {
            attempts: (await tx.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).attempts,
            eventCount: await tx.publisherClaimEvent.count({ where: { publisherClaimId: f.claimId } }),
          }
          throw new Error('rollback probe')
        })
      } catch { /* rollback is the behavior under test */ }
      expect(transactionState).toEqual({ attempts: 1, eventCount: 1 })
      expect(await db.publisherClaimChallenge.findUniqueOrThrow({ where: { id: f.challengeId } })).toMatchObject({ attempts: 0 })
      expect(await db.publisherClaimEvent.count({ where: { publisherClaimId: f.claimId } })).toBe(0)
    } finally { await f.clean() }
  })
})
