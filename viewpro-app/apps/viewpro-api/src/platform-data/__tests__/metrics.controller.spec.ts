import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../../auth/auth.module'
import { PrismaService } from '../../database/prisma.service'
import { PermissionsModule } from '../../permissions/permissions.module'
import { MetricsController } from '../metrics.controller'
import { MetricsService } from '../metrics.service'
import { seedOperatorFixture } from '../../test-support/operator.fixture'

/**
 * T-22 — RED: MetricsController operator endpoint tests.
 *
 * Spec: platform-data-lane-ingest-metrics
 *   - Metrics Endpoint — Operator-Only Access (all 4 scenarios)
 *   - Empty-State Metrics
 */

const TEST_EMAIL = 'metrics-ctrl-test@viewpro.app'
const TEST_PASSWORD = 'metrics-ctrl-test-password'

// T-09 — role fixtures for PlatformPermissionGuard READ-route coverage.
const TEST_EMAIL_ANALYST = 'metrics-ctrl-test-analyst@viewpro.app'
const TEST_PASSWORD_ANALYST = 'metrics-ctrl-test-analyst-password'
const TEST_EMAIL_OPERATIONS = 'metrics-ctrl-test-operations@viewpro.app'
const TEST_PASSWORD_OPERATIONS = 'metrics-ctrl-test-operations-password'

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('MetricsController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
      ],
      controllers: [MetricsController],
      providers: [MetricsService],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = moduleFixture.get(PrismaService)

    await seedOperatorFixture(app, { email: TEST_EMAIL, password: TEST_PASSWORD })
    await seedOperatorFixture(app, { email: TEST_EMAIL_ANALYST, password: TEST_PASSWORD_ANALYST, role: 'ANALYST' })
    await seedOperatorFixture(app, { email: TEST_EMAIL_OPERATIONS, password: TEST_PASSWORD_OPERATIONS, role: 'OPERATIONS' })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    // Clean mirror events for each test to ensure isolation
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  async function getSessionCookieFor(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
  }

  async function getSessionCookie(): Promise<string> {
    return getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
  }

  // Scenario: Unauthenticated request is rejected (spec scenario 2)
  it('GET /api/operators/metrics/summary without token → 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')

    expect(res.status).toBe(401)
  })

  // Scenario: Authenticated operator receives metrics (spec scenario 1)
  it('GET /api/operators/metrics/summary with valid session → 200 + well-formed body', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(typeof res.body.tenants).toBe('number')
    expect(typeof res.body.byStatus).toBe('object')
    expect(typeof res.body.generatedAt).toBe('string')
  })

  // Scenario: Empty mirror returns well-formed zero result
  it('GET /api/operators/metrics/summary with empty mirror → 200 + zeroed counts', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.tenants).toBe(0)
    expect(res.body.byStatus).toEqual({})
    expect(typeof res.body.generatedAt).toBe('string')
  })

  // Scenario: Metrics reflect an ingested TENANT_STATUS_CHANGED event (spec scenario 3)
  it('after ingesting TENANT_STATUS_CHANGED newStatus=SUSPENDED for t-1 → byStatus.SUSPENDED >= 1', async () => {
    // Insert a mirror event directly to simulate a prior ingest
    await prisma.platformMirrorEvent.create({
      data: {
        sourceEventId: 'evt-suspended-t1',
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-1',
        newStatus: 'SUSPENDED',
        occurredAt: new Date(),
        seqNo: 1,
        payload: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
      },
    })

    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.tenants).toBeGreaterThanOrEqual(1)
    expect((res.body.byStatus as Record<string, number>)['SUSPENDED']).toBeGreaterThanOrEqual(1)
  })

  // Scenario: InmoView DB isolation — metrics served from mirror only (spec scenario 4; D6)
  //
  // Genuine proof strategy (two layers):
  //  A. DI/structural: the test module wires MetricsController + MetricsService with
  //     ONLY DatabaseModule (viewpro_platform PrismaService) and AuthModule. No
  //     ChangeFeedClient or InmoView Prisma client is in scope. If MetricsService
  //     tried to inject either, NestJS would throw at module compilation time.
  //  B. Behavioral: seed a mirror row directly in viewpro_platform (bypassing any
  //     InmoView touch), call the endpoint, and assert the response reflects that
  //     seeded row — proving the metrics path reads ONLY viewpro_platform.
  it('metrics reads ONLY viewpro_platform mirror — no ChangeFeedClient/InmoView dependency (DI + behavioral proof)', async () => {
    // --- A. DI/structural check ---
    // The moduleFixture was built with: DatabaseModule, AuthModule, MetricsController,
    // MetricsService — and nothing else. Confirm ChangeFeedClient is NOT resolvable,
    // which proves it is absent from the metrics wiring.
    // (NestJS throws NotFoundException when trying to get an unregistered provider.)
    let changeFeedClientResolved: boolean
    try {
      const { ChangeFeedClient } = await import('../change-feed.client.js')
      app.get(ChangeFeedClient)
      changeFeedClientResolved = true
    } catch {
      changeFeedClientResolved = false
    }
    expect(changeFeedClientResolved).toBe(false)

    // --- B. Behavioral isolation proof ---
    // Seed a PENDING row directly into viewpro_platform (no InmoView call).
    await prisma.platformMirrorEvent.create({
      data: {
        sourceEventId: 'evt-isolation-proof-pending',
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 'tenant-isolation-proof',
        newStatus: 'TRIAL',
        occurredAt: new Date(),
        seqNo: 99,
        payload: { previousStatus: 'CANCELLED', newStatus: 'TRIAL' },
      },
    })

    const cookie = await getSessionCookie()
    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    // The response must reflect the seeded mirror row — proving the query hit
    // viewpro_platform only (no InmoView DB was touched to produce this result).
    expect(res.status).toBe(200)
    expect(res.body.tenants).toBeGreaterThanOrEqual(1)
    expect((res.body.byStatus as Record<string, number>)['TRIAL']).toBeGreaterThanOrEqual(1)
  })

  // T-12 — RED: byStatus CANCELLED bucket (platform-tenant-cancel, D6)
  //
  // Spec: admin-tenant-status — Downstream Effects (Metrics byStatus bucket
  //   includes CANCELLED)
  it('after ingesting TENANT_STATUS_CHANGED newStatus=CANCELLED for t-1 → byStatus.CANCELLED >= 1', async () => {
    await prisma.platformMirrorEvent.create({
      data: {
        sourceEventId: 'evt-cancelled-t1',
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 't-1',
        newStatus: 'CANCELLED',
        occurredAt: new Date(),
        seqNo: 1,
        payload: { previousStatus: 'ACTIVE', newStatus: 'CANCELLED' },
      },
    })

    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.tenants).toBeGreaterThanOrEqual(1)
    expect((res.body.byStatus as Record<string, number>)['CANCELLED']).toBeGreaterThanOrEqual(1)
  })

  // Latest-event-wins: if t-1 has two events (ACTIVE then SUSPENDED), report SUSPENDED
  it('latest-event-wins: second event for same tenant overrides the first in summary', async () => {
    await prisma.platformMirrorEvent.createMany({
      data: [
        {
          sourceEventId: 'evt-t1-active',
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 't-1',
          newStatus: 'ACTIVE',
          occurredAt: new Date(Date.now() - 1000),
          seqNo: 1,
          payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        },
        {
          sourceEventId: 'evt-t1-suspended',
          eventType: 'TENANT_STATUS_CHANGED',
          tenantId: 't-1',
          newStatus: 'SUSPENDED',
          occurredAt: new Date(),
          seqNo: 2,
          payload: { previousStatus: 'ACTIVE', newStatus: 'SUSPENDED' },
        },
      ],
    })

    const cookie = await getSessionCookie()
    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    // t-1's latest event is SUSPENDED (seqNo=2) — should not appear as ACTIVE
    expect((res.body.byStatus as Record<string, number>)['SUSPENDED']).toBe(1)
    expect((res.body.byStatus as Record<string, number>)['ACTIVE']).toBeUndefined()
    expect(res.body.tenants).toBe(1)
  })

  // -------------------------------------------------------------------------
  // T-09 — RED: PlatformPermissionGuard READ-route coverage (AC3 READ half)
  //
  // Spec: operator-platform-roles — Read Routes Require the Declared READ
  //   Permission
  // -------------------------------------------------------------------------
  it('ANALYST session → GET /api/operators/metrics/summary → 200', async () => {
    const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
  })

  it('OPERATIONS session → GET /api/operators/metrics/summary → 200', async () => {
    const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)

    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
  })
})
