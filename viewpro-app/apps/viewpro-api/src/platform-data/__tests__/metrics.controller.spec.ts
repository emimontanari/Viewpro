import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
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
import { MetricsController } from '../metrics.controller'
import { MetricsService } from '../metrics.service'

/**
 * T-22 — RED: MetricsController operator endpoint tests.
 *
 * Spec: platform-data-lane-ingest-metrics
 *   - Metrics Endpoint — Operator-Only Access (all 4 scenarios)
 *   - Empty-State Metrics
 */

const TEST_EMAIL = 'metrics-ctrl-test@viewpro.app'
const TEST_PASSWORD = 'metrics-ctrl-test-password'

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
    // Seed a test operator
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: TEST_EMAIL,
        SEED_OPERATOR_PASSWORD: TEST_PASSWORD,
      },
    })

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
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

  async function getSessionCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
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
  it('MetricsService does not import or use InmoView Prisma client', async () => {
    // Static assertion: MetricsService must only use PrismaService (@prisma-platform/client)
    // We verify this by checking the module resolves without any InmoView dependency.
    // The MetricsController + MetricsService are wired with only DatabaseModule (viewpro_platform).
    // If they inadvertently used the InmoView client, the module would fail to wire.
    const cookie = await getSessionCookie()

    // Metrics should work even with no InmoView connection — the test environment
    // already has no InmoView DB URL configured (setup-env.ts deletes INMV_DATABASE_URL).
    const res = await request(app.getHttpServer())
      .get('/api/operators/metrics/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200) // served from viewpro_platform mirror only
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
})
