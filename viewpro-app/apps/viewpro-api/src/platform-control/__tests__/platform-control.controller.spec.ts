import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { HttpException, ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../../auth/auth.module'
import { PlatformControlModule } from '../platform-control.module'
import { PlatformControlClient } from '../platform-control.client'

/**
 * T-18 → T-19: operator endpoint integration tests.
 *
 * Spec: platform-control-lane-outbound — Operator Endpoint Authentication,
 *   Operator Command Status, Operator Command Limits, Downstream failure.
 *
 * PlatformControlClient is overridden with a mock in NestJS testing module
 * so no real HTTP call is made to InmoView.
 */

const TEST_EMAIL = 'platform-ctrl-test@viewpro.app'
const TEST_PASSWORD = 'platform-ctrl-test-password'

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('PlatformControlController (viewpro-api) — operator endpoints', () => {
  let app: INestApplication
  let mockClient: {
    mintServiceToken: ReturnType<typeof vi.fn>
    postTenantStatus: ReturnType<typeof vi.fn>
    postTenantLimits: ReturnType<typeof vi.fn>
  }

  beforeAll(async () => {
    mockClient = {
      mintServiceToken: vi.fn().mockReturnValue('mocked-service-token'),
      postTenantStatus: vi.fn().mockResolvedValue({ status: 'updated' }),
      postTenantLimits: vi.fn().mockResolvedValue({ status: 'updated' }),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PlatformControlModule,
      ],
    })
      .overrideProvider(PlatformControlClient)
      .useValue(mockClient)
      .compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    // Seed a test operator (idempotent upsert)
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: TEST_EMAIL,
        SEED_OPERATOR_PASSWORD: TEST_PASSWORD,
      },
    })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.postTenantStatus.mockResolvedValue({ status: 'updated' })
    mockClient.postTenantLimits.mockResolvedValue({ status: 'updated' })
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

  it('PATCH /api/operators/tenants/:id/status without session → 401', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(401)
    expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
  })

  it('PATCH /api/operators/tenants/:id/limits without session → 401', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/limits')
      .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

    expect(res.status).toBe(401)
    expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
  })

  it('PATCH /api/operators/tenants/:id/status with valid session → 200, forwards to InmoView', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', cookie)
      .send({ status: 'SUSPENDED' })

    expect(res.status).toBe(200)
    expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
    const [tenantId, cmd, idempotencyKey, operatorId] =
      mockClient.postTenantStatus.mock.calls[0] as [string, { targetStatus: string }, string, string]
    expect(tenantId).toBe('tenant-1')
    expect(cmd.targetStatus).toBe('SUSPENDED')
    expect(typeof idempotencyKey).toBe('string')
    expect(typeof operatorId).toBe('string')
  })

  it('PATCH /api/operators/tenants/:id/limits with valid session → 200', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/limits')
      .set('Cookie', cookie)
      .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

    expect(res.status).toBe(200)
    expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()
    const [tenantId, limits, idempotencyKey, operatorId] =
      mockClient.postTenantLimits.mock.calls[0] as [
        string,
        { maxUsers: number | null; maxActivePropertyEngagements: number | null; maxDocumentsStorageMb: number | null },
        string,
        string,
      ]
    expect(tenantId).toBe('tenant-1')
    expect(limits.maxUsers).toBe(10)
    expect(typeof idempotencyKey).toBe('string')
    expect(typeof operatorId).toBe('string')
  })

  it('downstream non-2xx → surfaced as error to operator', async () => {
    mockClient.postTenantStatus.mockRejectedValue(new Error('InmoView control-lane returned 404'))
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-99/status')
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' })

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  // FIX 1: unsupported status rejected locally — no outbound call
  it('PATCH with targetStatus=TRIAL → 400 locally, no outbound call made', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', cookie)
      .send({ status: 'TRIAL' })

    expect(res.status).toBe(400)
    expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
  })

  it('PATCH with status=CANCELLED → 200, forwards targetStatus=CANCELLED to InmoView', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', cookie)
      .send({ status: 'CANCELLED' })

    expect(res.status).toBe(200)
    expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
    const [tenantId, cmd] = mockClient.postTenantStatus.mock.calls[0] as [string, { targetStatus: string }]
    expect(tenantId).toBe('tenant-1')
    expect(cmd.targetStatus).toBe('CANCELLED')
  })

  // -------------------------------------------------------------------------
  // T-10 — RED: terminality 400 relayed via existing generic failure path
  //
  // Spec: platform-control-lane-outbound — Terminality Rejection Is Relayed
  //   Unchanged
  // -------------------------------------------------------------------------
  it('InmoView terminality rejection (400) is relayed to the operator as an exact 400, via the generic failure path', async () => {
    mockClient.postTenantStatus.mockRejectedValueOnce(
      new HttpException({ statusCode: 400, message: 'Cancelled tenant cannot change status' }, 400),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' })

    // Exact 400 — not merely >= 400 — proves the real downstream status
    // code is preserved, not collapsed to a generic 500.
    expect(res.status).toBe(400)
    // No special-casing/retry: the client was invoked exactly once.
    expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
  })
})
