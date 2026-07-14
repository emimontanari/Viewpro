import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// T-11 — RED: change-feed controller tests
//
// Spec: platform-data-lane-outbox — Change-Feed Endpoint (6 scenarios + env config)
//   1. Valid token + since=0 returns events ordered by seqNo ASC; nextCursor = max seqNo
//   2. since=2 with events 1,2,3 returns only event 3; nextCursor=3
//   3. No new events: empty array; nextCursor = supplied cursor
//   4. Batch bounded: more events than limit → at most batchSize; nextCursor < max seqNo in table
//   5. Missing/invalid service token → 401
//   6. Ms-collision events (same occurredAt, distinct seqNo) both returned when since=N-1
//   7. PLATFORM_DATA_BATCH_LIMIT env var respected
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = process.env.PLATFORM_CONTROL_SECRET ?? 'test-platform-control-secret-min16'

const serviceSigner = new JwtService({ secret: PLATFORM_CONTROL_SECRET })

async function mintServiceToken(): Promise<string> {
  return serviceSigner.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-test', jti: `jti-${Date.now()}` },
    { expiresIn: '120s' },
  )
}

describe('PlatformDataController — change-feed endpoint', () => {
  let app: INestApplication
  let prisma: import('@prisma/client').PrismaClient

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

    const { createApiApp } = await import('../../bootstrap/create-app.js')
    app = await createApiApp()
    await app.init()

    const { PrismaService } = await import('../../database/prisma.service.js')
    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await prisma.platformOutboxEvent.deleteMany()
  })

  // Helper: insert an outbox event row directly via Prisma
  async function insertOutboxEvent(tenantId: string, occurredAt: Date = new Date()) {
    return prisma.platformOutboxEvent.create({
      data: {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId,
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        occurredAt,
      },
    })
  }

  // -------------------------------------------------------------------------
  // Scenario 1: Valid token + since=0 returns events ordered by seqNo ASC
  // -------------------------------------------------------------------------
  it('valid token + since=0 returns all events ordered by seqNo ASC; nextCursor = max seqNo', async () => {
    const now = new Date()
    await insertOutboxEvent('tenant-a', now)
    await insertOutboxEvent('tenant-b', now)
    await insertOutboxEvent('tenant-c', now)

    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: Array<{ seqNo: number; tenantId: string }>; nextCursor: number }

    expect(body.events).toHaveLength(3)

    // Ordered by seqNo ascending
    const seqNos = body.events.map((e) => e.seqNo)
    expect(seqNos[0]).toBeLessThan(seqNos[1]!)
    expect(seqNos[1]).toBeLessThan(seqNos[2]!)

    // nextCursor is the maximum seqNo
    expect(body.nextCursor).toBe(seqNos[2])
  })

  // -------------------------------------------------------------------------
  // Scenario 2: Cursor excludes already-seen events
  // -------------------------------------------------------------------------
  it('since=<seqNo of 2nd event> returns only event 3; nextCursor=seqNo of event 3', async () => {
    const now = new Date()
    const evt1 = await insertOutboxEvent('tenant-a', now)
    const evt2 = await insertOutboxEvent('tenant-b', now)
    const evt3 = await insertOutboxEvent('tenant-c', now)

    const since = Number(evt2.seqNo)
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get(`/api/internal/platform/changes?since=${since}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: Array<{ seqNo: number }>; nextCursor: number }

    expect(body.events).toHaveLength(1)
    expect(body.events[0]!.seqNo).toBe(Number(evt3.seqNo))
    expect(body.nextCursor).toBe(Number(evt3.seqNo))

    // Verify evt1 and evt2 are NOT in the response
    const returnedSeqNos = body.events.map((e) => e.seqNo)
    expect(returnedSeqNos).not.toContain(Number(evt1.seqNo))
    expect(returnedSeqNos).not.toContain(Number(evt2.seqNo))
  })

  // -------------------------------------------------------------------------
  // Scenario 3: Empty result when no new events
  // -------------------------------------------------------------------------
  it('no new events: empty array; nextCursor equals the supplied cursor', async () => {
    const evt = await insertOutboxEvent('tenant-a')
    const currentMax = Number(evt.seqNo)
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get(`/api/internal/platform/changes?since=${currentMax}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: unknown[]; nextCursor: number }

    expect(body.events).toHaveLength(0)
    expect(body.nextCursor).toBe(currentMax)
  })

  // -------------------------------------------------------------------------
  // Scenario 4: Batch is bounded
  // -------------------------------------------------------------------------
  it('batch bounded: inserts > limit events, response contains at most batchSize; nextCursor < max seqNo in table', async () => {
    // Insert 5 events; with PLATFORM_DATA_BATCH_LIMIT=3 only 3 should come back
    process.env.PLATFORM_DATA_BATCH_LIMIT = '3'

    const now = new Date()
    const events = []
    for (let i = 0; i < 5; i++) {
      events.push(await insertOutboxEvent(`tenant-batch-${i}`, now))
    }
    const maxSeqNoInTable = Math.max(...events.map((e) => Number(e.seqNo)))

    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: Array<{ seqNo: number }>; nextCursor: number }

    expect(body.events.length).toBeLessThanOrEqual(3)
    expect(body.nextCursor).toBeLessThan(maxSeqNoInTable)

    // Restore env
    delete process.env.PLATFORM_DATA_BATCH_LIMIT
  })

  // -------------------------------------------------------------------------
  // Scenario 5: Missing/invalid service token → 401
  // -------------------------------------------------------------------------
  it('missing Authorization header → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .expect(401)
  })

  it('invalid/expired token → 401', async () => {
    const wrongSigner = new JwtService({ secret: 'wrong-secret-that-is-long-enough' })
    const badToken = await wrongSigner.signAsync(
      { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op', jti: 'bad-jti' },
      { expiresIn: '120s' },
    )

    await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${badToken}`)
      .expect(401)
  })

  // -------------------------------------------------------------------------
  // Scenario 6: Ms-collision events (same occurredAt, distinct seqNo) both returned
  // -------------------------------------------------------------------------
  it('millisecond-collision: two events share same occurredAt but distinct seqNo — both returned', async () => {
    const collisionTime = new Date('2026-01-01T00:00:00.000Z')
    const evtN = await insertOutboxEvent('tenant-collision-1', collisionTime)
    const evtN1 = await insertOutboxEvent('tenant-collision-2', collisionTime)

    const since = Number(evtN.seqNo) - 1
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get(`/api/internal/platform/changes?since=${since}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: Array<{ seqNo: number; tenantId: string }>; nextCursor: number }

    const seqNos = body.events.map((e) => e.seqNo)
    expect(seqNos).toContain(Number(evtN.seqNo))
    expect(seqNos).toContain(Number(evtN1.seqNo))

    // Verify they are distinct
    expect(Number(evtN.seqNo)).not.toBe(Number(evtN1.seqNo))
  })

  // -------------------------------------------------------------------------
  // Scenario 7: PLATFORM_DATA_BATCH_LIMIT env var respected
  // -------------------------------------------------------------------------
  it('PLATFORM_DATA_BATCH_LIMIT=2 caps response at 2 events', async () => {
    process.env.PLATFORM_DATA_BATCH_LIMIT = '2'

    const now = new Date()
    for (let i = 0; i < 4; i++) {
      await insertOutboxEvent(`tenant-limit-${i}`, now)
    }

    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: unknown[]; nextCursor: number }

    expect(body.events.length).toBeLessThanOrEqual(2)

    // Restore env
    delete process.env.PLATFORM_DATA_BATCH_LIMIT
  })

  // -------------------------------------------------------------------------
  // Response shape: seqNo must be a safe number (not BigInt, not string)
  // -------------------------------------------------------------------------
  it('seqNo in response is a plain number (JSON-serializable, no BigInt errors)', async () => {
    await insertOutboxEvent('tenant-json', new Date())
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: Array<{ seqNo: unknown }>; nextCursor: unknown }

    expect(typeof body.events[0]!.seqNo).toBe('number')
    expect(typeof body.nextCursor).toBe('number')
  })

  // -------------------------------------------------------------------------
  // Default since: missing or invalid since defaults to 0
  // -------------------------------------------------------------------------
  it('missing since param defaults to 0 (returns all events)', async () => {
    await insertOutboxEvent('tenant-default', new Date())
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .get('/api/internal/platform/changes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const body = response.body as { events: unknown[] }
    expect(body.events.length).toBeGreaterThanOrEqual(1)
  })
})
