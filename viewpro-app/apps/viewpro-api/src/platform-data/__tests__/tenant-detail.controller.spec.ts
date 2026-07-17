import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
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
import { PermissionsModule } from '../../permissions/permissions.module'
import { TenantDetailController } from '../tenant-detail.controller'
import { TenantDetailService } from '../tenant-detail.service'
import { ChangeFeedClient, TenantSummaryFetchError } from '../change-feed.client'

/**
 * platform-tenant-tracking (PR1) — RED: `TenantDetailController`/
 * `TenantDetailService` tests — permission gating + InmoView passthrough +
 * error mapping.
 *
 * Spec: platform-tenant-tracking — "ViewPro tenant summary passthrough"
 * Design D8: gated by AuthGuard + PlatformPermissionGuard(TENANTS_READ),
 *   InmoView 404 -> 404, everything else (non-2xx or unreachable) -> 502.
 *
 * ChangeFeedClient is mocked — no live InmoView HTTP call in this test
 * harness (mirrors backfill.spec.ts's `makeMockChangeFeedClient` pattern).
 */

const TEST_EMAIL = 'tenant-detail-test@viewpro.app'
const TEST_PASSWORD = 'tenant-detail-test-password'

const mockSummary = {
  window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
  activeEngagements: 2,
  activeEngagementsWithOwnerVisibleUpdate: 1,
  activeEngagementUpdatePercentage: 50,
  documentEvents: { requested: 1, uploaded: 0, approved: 0, rejected: 0 },
  ownerViewedPropertyCount: 3,
  activity: {
    total: 1,
    items: [{ kind: 'movement' as const, id: 'movement-1', createdAt: '2026-05-22T10:00:00.000Z' }],
  },
}

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('TenantDetailController (integration — test DB, mocked InmoView client)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockFetchTenantSummary: ReturnType<typeof vi.fn<ChangeFeedClient['fetchTenantSummary']>>

  function seedOperator(email: string, password: string): void {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: email,
        SEED_OPERATOR_PASSWORD: password,
      },
    })
  }

  beforeAll(async () => {
    seedOperator(TEST_EMAIL, TEST_PASSWORD)

    mockFetchTenantSummary = vi.fn()
    const mockChangeFeedClient: Pick<ChangeFeedClient, 'fetchTenantSummary'> = {
      fetchTenantSummary: mockFetchTenantSummary,
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
      ],
      controllers: [TenantDetailController],
      providers: [
        TenantDetailService,
        { provide: ChangeFeedClient, useValue: mockChangeFeedClient },
      ],
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

  beforeEach(() => {
    mockFetchTenantSummary.mockClear()
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

  // Scenario: Authorized operator gets the summary
  it('operator with TENANTS_READ → 200 passthrough of the mocked InmoView summary', async () => {
    mockFetchTenantSummary.mockResolvedValueOnce(mockSummary)
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(mockSummary)
    expect(mockFetchTenantSummary).toHaveBeenCalledWith('tenant-1', 0, 20)
  })

  it('forwards offset/limit query params to the InmoView client', async () => {
    mockFetchTenantSummary.mockResolvedValueOnce(mockSummary)
    const cookie = await getSessionCookie()

    await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary?offset=10&limit=5')
      .set('Cookie', cookie)
      .expect(200)

    expect(mockFetchTenantSummary).toHaveBeenCalledWith('tenant-1', 10, 5)
  })

  // Scenario: Unauthenticated request is rejected
  it('GET /api/operators/tenants/:id/summary without a session → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/operators/tenants/tenant-1/summary')

    expect(res.status).toBe(401)
    expect(mockFetchTenantSummary).not.toHaveBeenCalled()
  })

  // Scenario: InmoView 404 → ViewPro 404
  it('InmoView returns 404 for the tenant → ViewPro returns 404', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary endpoint returned non-2xx status: 404', 404),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/does-not-exist/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })

  // Scenario: InmoView unreachable or erroring → ViewPro 502
  it('InmoView is unreachable (network failure) → ViewPro returns 502', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary request to InmoView failed: fetch failed'),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(502)
  })

  it('InmoView returns a non-404 error status (e.g. 500) → ViewPro returns 502', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary endpoint returned non-2xx status: 500', 500),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(502)
  })

  // Read-only passthrough invariant: no ViewPro table is ever written by this route.
  it('does not persist the InmoView response in any ViewPro table (structural: no prisma writes in TenantDetailService)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(__dirname, '..', 'tenant-detail.service.ts'), 'utf8')

    expect(source).not.toMatch(/prisma\.\w+\.(create|update|upsert|delete)/)
  })
})
