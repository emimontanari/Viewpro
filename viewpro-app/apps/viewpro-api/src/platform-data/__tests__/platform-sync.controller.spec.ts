import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { type INestApplication, ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../../auth/auth.module'
import { PrismaService } from '../../database/prisma.service'
import { PermissionsModule } from '../../permissions/permissions.module'
import { PlatformSyncController, raceDemand, DEMAND_RACE_TIMEOUT_MS } from '../platform-sync.controller'
import { PlatformSyncCoordinator } from '../platform-sync-coordinator'
import type { PlatformSyncStatus } from '../platform-sync-coordinator'
import { seedPlatformSyncOperatorFixture } from './platform-sync.fixture'

// B.1/B.3 — PlatformSyncController demand endpoint and raceDemand helper.
// Spec: platform-data-lane-ingest-metrics — Bounded Feed and Truthful
//   Process Status; operator-console — Authenticated Visible Demand.

function makeStatus(overrides: Partial<PlatformSyncStatus> = {}): PlatformSyncStatus {
  return { state: 'stale', inFlight: false, attemptCount: 0, consecutiveFailureCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null, lastObservedCursor: null, lastBatchCount: null, failureCode: null, ...overrides }
}

describe('raceDemand', () => {
  it.each([
    ['a non-empty batch still updating', makeStatus({ state: 'updating', lastBatchCount: 3, lastObservedCursor: 9 })],
    ['a mapped failure', makeStatus({ state: 'failed', failureCode: 'FEED_TIMEOUT', consecutiveFailureCount: 1 })],
  ])('passes through %s untouched when the run settles before the timeout', async (_label, status) => {
    const snapshot = vi.fn()
    const result = await raceDemand(Promise.resolve(status), snapshot, 4000)
    expect(result).toBe(status); expect(snapshot).not.toHaveBeenCalled()
  })

  it('falls back to the coordinator snapshot without cancelling admitted work when the race exceeds the budget', async () => {
    vi.useFakeTimers()
    let releaseRun!: (value: PlatformSyncStatus) => void
    const run = new Promise<PlatformSyncStatus>((resolve) => { releaseRun = resolve })
    const inFlightSnapshot = makeStatus({ state: 'updating', inFlight: true })
    const snapshot = vi.fn(() => inFlightSnapshot)
    const pending = raceDemand(run, snapshot, DEMAND_RACE_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(DEMAND_RACE_TIMEOUT_MS)
    await expect(pending).resolves.toBe(inFlightSnapshot); expect(snapshot).toHaveBeenCalledOnce()
    // Admitted work is never cancelled — resolving it later must not throw.
    releaseRun(makeStatus({ state: 'current' })); await Promise.resolve(); vi.useRealTimers()
  })
})

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('PlatformSyncController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let coordinator: { runOneBatch: ReturnType<typeof vi.fn>; getStatus: ReturnType<typeof vi.fn> }
  const TEST_EMAIL = 'platform-sync-ctrl-test@viewpro.app'
  const TEST_PASSWORD = 'platform-sync-ctrl-test-password'
  const DENIED_EMAIL = 'platform-sync-ctrl-denied@viewpro.app'
  const DENIED_PASSWORD = 'platform-sync-ctrl-denied-password'

  beforeAll(async () => {
    coordinator = { runOneBatch: vi.fn(), getStatus: vi.fn(() => makeStatus()) }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), DatabaseModule, AuthModule, PermissionsModule],
      controllers: [PlatformSyncController],
      providers: [{ provide: PlatformSyncCoordinator, useValue: coordinator }],
    }).compile()
    app = moduleFixture.createNestApplication()
    app.use(cookieParser()); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.listen(0)
    prisma = moduleFixture.get(PrismaService)
    await seedPlatformSyncOperatorFixture(app, { email: TEST_EMAIL, password: TEST_PASSWORD })
    await seedPlatformSyncOperatorFixture(app, { email: DENIED_EMAIL, password: DENIED_PASSWORD })
  })

  afterAll(async () => { await app?.close() })
  beforeEach(() => { coordinator.runOneBatch.mockReset(); coordinator.getStatus.mockReset().mockReturnValue(makeStatus()) })

  async function getSessionCookieFor(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password })
    if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    return extractPlatformCookie(res.headers as Record<string, unknown>)
  }

  // Scenario: unauthorized request is rejected and starts no demand (AC2, AC9)
  it('POST without a session → 401, starts no demand', async () => {
    const res = await request(app.getHttpServer()).post('/api/operators/platform-sync/demand').send({})
    expect(res.status).toBe(401); expect(coordinator.runOneBatch).not.toHaveBeenCalled()
  })

  // Scenario: authenticated operator lacking effective access is denied and starts no demand
  it('POST with a session revoked after login → 403 PERMISSION_DENIED, starts no demand', async () => {
    const cookie = await getSessionCookieFor(DENIED_EMAIL, DENIED_PASSWORD)
    await prisma.operator.update({ where: { email: DENIED_EMAIL }, data: { status: 'SUSPENDED' } })
    const res = await request(app.getHttpServer()).post('/api/operators/platform-sync/demand').set('Cookie', cookie).send({})
    expect(res.status).toBe(403); expect(res.body.code).toBe('PERMISSION_DENIED'); expect(coordinator.runOneBatch).not.toHaveBeenCalled()
  })

  // Scenario: valid demand starts/joins the coordinator and returns its status,
  // possibly updating with successful non-empty batch metadata (AC2–AC4, AC6)
  it('POST with a valid session starts demand and returns updating status with batch metadata', async () => {
    coordinator.runOneBatch.mockResolvedValue(makeStatus({ state: 'updating', lastBatchCount: 2, lastObservedCursor: 8, consecutiveFailureCount: 0 }))
    const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
    const res = await request(app.getHttpServer()).post('/api/operators/platform-sync/demand').set('Cookie', cookie).send({})
    expect(res.status).toBe(200); expect(coordinator.runOneBatch).toHaveBeenCalledOnce()
    expect(res.body).toMatchObject({ state: 'updating', lastBatchCount: 2, lastObservedCursor: 8 })
  })

  // B.3 — REFACTOR: a later demand call retries after a mapped failure
  // (design.md — later demand may retry; AC5/AC7 retryable failure stages).
  it('a later demand call retries and can succeed after a prior failed demand', async () => {
    coordinator.runOneBatch
      .mockResolvedValueOnce(makeStatus({ state: 'failed', failureCode: 'FEED_TIMEOUT', consecutiveFailureCount: 1 }))
      .mockResolvedValueOnce(makeStatus({ state: 'current', lastBatchCount: 0, consecutiveFailureCount: 0 }))
    const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
    const first = await request(app.getHttpServer()).post('/api/operators/platform-sync/demand').set('Cookie', cookie).send({})
    const second = await request(app.getHttpServer()).post('/api/operators/platform-sync/demand').set('Cookie', cookie).send({})
    expect(first.body).toMatchObject({ state: 'failed', failureCode: 'FEED_TIMEOUT' })
    expect(second.body).toMatchObject({ state: 'current', consecutiveFailureCount: 0 })
    expect(coordinator.runOneBatch).toHaveBeenCalledTimes(2)
  })
})
