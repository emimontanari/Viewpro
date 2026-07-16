import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { HttpException, ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../../auth/auth.module'
import { PrismaService } from '../../database/prisma.service'
import { PermissionsModule } from '../../permissions/permissions.module'
import { PlatformControlModule } from '../platform-control.module'
import { PlatformControlClient } from '../platform-control.client'

// T-11 — must match STEP_UP_TOKEN_SECRET set in test/setup-env.ts
const STEP_UP_TOKEN_SECRET =
  process.env.STEP_UP_TOKEN_SECRET ?? 'test-step-up-token-secret-min16'

async function buildExpiredStepUpToken(sub: string): Promise<string> {
  const jwtService = new JwtService({ secret: STEP_UP_TOKEN_SECRET })
  return jwtService.signAsync({ sub, stepUp: true }, { expiresIn: -1 })
}

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
const TEST_EMAIL_B = 'platform-ctrl-test-operator-b@viewpro.app'
const TEST_PASSWORD_B = 'platform-ctrl-test-operator-b-password'

// T-07 — role fixtures for PlatformPermissionGuard integration coverage.
const TEST_EMAIL_ANALYST = 'platform-ctrl-test-analyst@viewpro.app'
const TEST_PASSWORD_ANALYST = 'platform-ctrl-test-analyst-password'
const TEST_EMAIL_OPERATIONS = 'platform-ctrl-test-operations@viewpro.app'
const TEST_PASSWORD_OPERATIONS = 'platform-ctrl-test-operations-password'
const TEST_EMAIL_ROLE_CHANGE = 'platform-ctrl-test-role-change@viewpro.app'
const TEST_PASSWORD_ROLE_CHANGE = 'platform-ctrl-test-role-change-password'
const TEST_EMAIL_SUSPEND = 'platform-ctrl-test-suspend@viewpro.app'
const TEST_PASSWORD_SUSPEND = 'platform-ctrl-test-suspend-password'

function extractCookie(headers: Record<string, unknown>, name: string): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes(`${name}=`)) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

function extractPlatformCookie(headers: Record<string, unknown>): string {
  return extractCookie(headers, 'viewpro_platform_access_token')
}

describe('PlatformControlController (viewpro-api) — operator endpoints', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockClient: {
    mintServiceToken: ReturnType<typeof vi.fn>
    postTenantStatus: ReturnType<typeof vi.fn>
    postTenantLimits: ReturnType<typeof vi.fn>
  }

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
        PermissionsModule,
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

    prisma = moduleFixture.get(PrismaService)

    // Seed test operators (idempotent upsert) — production seed stays OWNER-only.
    seedOperator(TEST_EMAIL, TEST_PASSWORD)
    seedOperator(TEST_EMAIL_B, TEST_PASSWORD_B)

    // T-07 — role fixtures seeded directly via Prisma (no real signup exists).
    seedOperator(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
    await prisma.operator.update({ where: { email: TEST_EMAIL_ANALYST }, data: { role: 'ANALYST' } })

    seedOperator(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
    await prisma.operator.update({ where: { email: TEST_EMAIL_OPERATIONS }, data: { role: 'OPERATIONS' } })

    seedOperator(TEST_EMAIL_ROLE_CHANGE, TEST_PASSWORD_ROLE_CHANGE)
    await prisma.operator.update({ where: { email: TEST_EMAIL_ROLE_CHANGE }, data: { role: 'OPERATIONS' } })

    seedOperator(TEST_EMAIL_SUSPEND, TEST_PASSWORD_SUSPEND)
    // OWNER by default — has every permission until suspended mid-test. Reset
    // explicitly on every run: a prior run's SUSPENDED mutation persists
    // across test executions (upsert's `update: {}` never resets it).
    await prisma.operator.update({
      where: { email: TEST_EMAIL_SUSPEND },
      data: { status: 'ACTIVE', role: 'OWNER' },
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

  async function getStepUpCookieFor(accessCookie: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .set('Cookie', accessCookie)
      .send({ password })
    if (res.status !== 200) {
      throw new Error(`Step-up failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
  }

  async function getStepUpCookie(accessCookie: string): Promise<string> {
    return getStepUpCookieFor(accessCookie, TEST_PASSWORD)
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
    const stepUpCookie = await getStepUpCookie(cookie)

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', `${cookie}; ${stepUpCookie}`)
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
    const stepUpCookie = await getStepUpCookie(cookie)

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/limits')
      .set('Cookie', `${cookie}; ${stepUpCookie}`)
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
    const stepUpCookie = await getStepUpCookie(cookie)

    const res = await request(app.getHttpServer())
      .patch('/api/operators/tenants/tenant-1/status')
      .set('Cookie', `${cookie}; ${stepUpCookie}`)
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

  // -------------------------------------------------------------------------
  // T-11 — RED: destructive routes gated by StepUpGuard (AC2-AC6, threat matrix)
  //
  // Spec: operator-step-up-auth — StepUpGuard Gates Destructive Tenant Routes
  //   (all 5 scenarios); Reactivate Is Exempt; Step-up Freshness (both
  //   scenarios); Cross-Operator Step-up Rejection
  // -------------------------------------------------------------------------
  describe('StepUpGuard on destructive routes', () => {
    it('PATCH .../status {status:SUSPENDED} without step-up cookie → 403 STEP_UP_REQUIRED, no downstream call (AC2)', async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it('PATCH .../status {status:CANCELLED} without step-up cookie → 403 STEP_UP_REQUIRED, no downstream call', async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'CANCELLED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it('PATCH .../limits without step-up cookie → 403 STEP_UP_REQUIRED, no downstream call', async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', cookie)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })

    it('PATCH .../status {status:SUSPENDED} WITH a fresh step-up cookie → 200, downstream called once (AC3)', async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
    })

    it('PATCH .../limits WITH a fresh step-up cookie → 200, downstream called once', async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()
    })

    it('PATCH .../status {status:ACTIVE} with NO step-up cookie → 200 (reactivate exempt, AC6)', async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
    })

    // platform-manual-plans (Slice 4, Part 2) — Task 37 verification:
    // "Activar" (TRIAL→ACTIVE) stays fully decoupled from plan assignment —
    // regression only, no new production code. Confirms the non-goal
    // explicitly called out in the spec: activation never assigns/requires a
    // plan and never triggers step-up (same AC6 exemption as above).
    it('activating a TRIAL tenant (status:ACTIVE) does not assign a plan and requires no step-up (decoupled, spec non-goal)', async () => {
      await prisma.platformTenant.upsert({
        where: { id: 'tenant-1' },
        create: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-1', latestStatus: 'TRIAL' },
        update: { plan: null, latestStatus: 'TRIAL' },
      })
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()

      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-1' } })
      expect(row?.plan).toBeNull()
    })

    it('a step-up cookie is reusable: limits then status(SUSPENDED) succeed with a single POST /auth/step-up (AC4 reusable)', async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const limitsRes = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })
      expect(limitsRes.status).toBe(200)

      const statusRes = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ status: 'SUSPENDED' })
      expect(statusRes.status).toBe(200)

      expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()
      expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
    })

    it('an expired step-up cookie is rejected → 403 STEP_UP_REQUIRED (AC4 expiry)', async () => {
      const cookie = await getSessionCookie()
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      const operatorId = loginRes.body.operator.id as string
      const expiredStepUpToken = await buildExpiredStepUpToken(operatorId)
      const expiredStepUpCookie = `viewpro_platform_stepup_token=${expiredStepUpToken}`

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookie}; ${expiredStepUpCookie}`)
        .send({ status: 'CANCELLED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it("operator B's request carrying operator A's step-up cookie is rejected → 403 STEP_UP_REQUIRED, no mutation (AC5)", async () => {
      const cookieA = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
      const stepUpCookieA = await getStepUpCookieFor(cookieA, TEST_PASSWORD)
      const cookieB = await getSessionCookieFor(TEST_EMAIL_B, TEST_PASSWORD_B)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookieB}; ${stepUpCookieA}`)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it("PATCH .../status {status:'GARBAGE'} → 400 from DTO validation, never reaches the handler (threat matrix — body-manipulation bypass)", async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'GARBAGE' })

      expect(res.status).toBe(400)
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    // -----------------------------------------------------------------------
    // T-13 — RED: StepUpGuard never bypasses AuthGuard — 401 wins over 403
    //
    // Spec: operator-step-up-auth — StepUpGuard Never Bypasses AuthGuard
    // -----------------------------------------------------------------------
    it('no access cookie but a valid, fresh step-up cookie present → 401 (NOT the STEP_UP_REQUIRED 403 shape)', async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', stepUpCookie)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(401)
      expect(res.body.code).not.toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // T-07 — RED: write routes gated by PlatformPermissionGuard
  //
  // Spec: operator-platform-roles — Write Routes Require the Declared WRITE
  //   Permission; ANALYST Is Denied and Nothing Mutates; Guard Order Keeps
  //   401, Permission-403, and Step-up-403 Distinct; A Role Change Takes
  //   Effect on the Operator's Very Next Request
  // Design: D1, D6, D7
  // -------------------------------------------------------------------------
  describe('PlatformPermissionGuard on write routes', () => {
    it('ANALYST, no step-up cookie: PATCH .../status → 403 PERMISSION_DENIED, no mutation (b — WRITE half)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it('ANALYST: PATCH .../limits → 403 PERMISSION_DENIED, no mutation', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', cookie)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })

    it('OPERATIONS, WITH a fresh step-up cookie: PATCH .../status → 200, downstream called once (c)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
      const stepUpCookie = await getStepUpCookieFor(cookie, TEST_PASSWORD_OPERATIONS)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantStatus).toHaveBeenCalledOnce()
    })

    it('OPERATIONS, WITH a fresh step-up cookie: PATCH .../limits → 200, downstream called once', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
      const stepUpCookie = await getStepUpCookieFor(cookie, TEST_PASSWORD_OPERATIONS)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()
    })

    it('OPERATIONS, WITHOUT a step-up cookie: PATCH .../limits → 403 STEP_UP_REQUIRED (permission passed, step-up still gates)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', cookie)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })

    it('guard order: ANALYST, no step-up cookie: PATCH .../status → 403 with code !== STEP_UP_REQUIRED (permission guard stops the request before step-up ever evaluates, e)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(res.body.code).not.toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it('guard order: OWNER (default role), no step-up cookie: PATCH .../status → still 403 STEP_UP_REQUIRED (permission passes, step-up still gates, e)', async () => {
      const cookie = await getSessionCookie()

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantStatus).not.toHaveBeenCalled()
    })

    it('role change mid-session: OPERATIONS→ANALYST denies the very next request on the same still-valid cookies, no re-login (f, D1)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ROLE_CHANGE, TEST_PASSWORD_ROLE_CHANGE)
      const stepUpCookie = await getStepUpCookieFor(cookie, TEST_PASSWORD_ROLE_CHANGE)

      const firstRes = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })
      expect(firstRes.status).toBe(200)

      await prisma.operator.update({
        where: { email: TEST_EMAIL_ROLE_CHANGE },
        data: { role: 'ANALYST' },
      })

      const secondRes = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/status')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ status: 'SUSPENDED' })

      expect(secondRes.status).toBe(403)
      expect(secondRes.body.code).toBe('PERMISSION_DENIED')
    })

    it('SUSPENDED lockout: an OWNER operator loses access mid-session on the same still-valid access cookie (g, D6)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_SUSPEND, TEST_PASSWORD_SUSPEND)
      const stepUpCookie = await getStepUpCookieFor(cookie, TEST_PASSWORD_SUSPEND)

      await prisma.operator.update({
        where: { email: TEST_EMAIL_SUSPEND },
        data: { status: 'SUSPENDED' },
      })

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/limits')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ maxUsers: 10, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // platform-manual-plans (Slice 4, Part 2) — RED: PATCH .../plan
  //
  // Spec: Assign-plan action drives the existing limits control lane;
  //   Assign-plan authorization matches limits-write authorization.
  // Design: D6 (reuses PlatformPermissionGuard(TENANT_LIMITS_WRITE) +
  //   StepUpGuard, same guard stack as .../limits), D7 (limits-push-first
  //   ordering, failure semantics, 'unchanged' still writes plan).
  // -------------------------------------------------------------------------
  describe('PATCH /operators/tenants/:id/plan', () => {
    beforeEach(async () => {
      // setPlan targets an existing platform_tenants row (command-written
      // seam, D4) — seed/reset it directly, independent of the mocked
      // control-lane client.
      await prisma.platformTenant.upsert({
        where: { id: 'tenant-1' },
        create: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-1', latestStatus: 'ACTIVE' },
        update: { plan: null },
      })
    })

    it('assign-plan when the projection row is absent → limits push still happens and the endpoint does NOT 500 (setPlan tolerates the missing row)', async () => {
      // Backfill/deploy window: the tenant has no platform_tenants row yet. The
      // control-lane limits push runs first (enforced) and setPlan must not
      // 500 on the missing row — the endpoint returns its normal success shape.
      await prisma.platformTenant.deleteMany({ where: { id: 'tenant-unprojected' } })
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-unprojected/plan')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ plan: 'BASICO' })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()

      // No partial row fabricated by the label write.
      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-unprojected' } })
      expect(row).toBeNull()
    })

    it('ANALYST (no TENANT_LIMITS_WRITE) → 403 PERMISSION_DENIED, no outbound call, no plan write', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', cookie)
        .send({ plan: 'BASICO' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()

      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-1' } })
      expect(row?.plan).toBeNull()
    })

    it('OPERATIONS without step-up cookie → 403 STEP_UP_REQUIRED, no outbound call', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', cookie)
        .send({ plan: 'BASICO' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })

    it("unknown plan value → 400 from DTO validation, never reaches the handler (no outbound call)", async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ plan: 'GARBAGE' })

      expect(res.status).toBe(400)
      expect(mockClient.postTenantLimits).not.toHaveBeenCalled()
    })

    it('lane failure (postTenantLimits throws) → surfaced as error, NO plan write (limits-push-first ordering, D7)', async () => {
      mockClient.postTenantLimits.mockRejectedValueOnce(
        new HttpException({ statusCode: 502, message: 'Control-lane request to InmoView failed' }, 502),
      )
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ plan: 'BASICO' })

      expect(res.status).toBe(502)

      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-1' } })
      expect(row?.plan).toBeNull()
    })

    it('success path → resolves BASICO preset limits, pushes via the existing limits lane, then writes plan', async () => {
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ plan: 'BASICO' })

      expect(res.status).toBe(200)
      expect(mockClient.postTenantLimits).toHaveBeenCalledOnce()
      const [tenantId, limits] = mockClient.postTenantLimits.mock.calls[0] as [
        string,
        { maxUsers: number | null; maxActivePropertyEngagements: number | null; maxDocumentsStorageMb: number | null },
      ]
      expect(tenantId).toBe('tenant-1')
      expect(limits).toEqual({ maxUsers: 3, maxActivePropertyEngagements: 25, maxDocumentsStorageMb: 500 })

      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-1' } })
      expect(row?.plan).toBe('BASICO')
    })

    it("lane result 'unchanged: true' still writes the plan column (D7)", async () => {
      mockClient.postTenantLimits.mockResolvedValueOnce({ unchanged: true })
      const cookie = await getSessionCookie()
      const stepUpCookie = await getStepUpCookie(cookie)

      const res = await request(app.getHttpServer())
        .patch('/api/operators/tenants/tenant-1/plan')
        .set('Cookie', `${cookie}; ${stepUpCookie}`)
        .send({ plan: 'PROFESIONAL' })

      expect(res.status).toBe(200)

      const row = await prisma.platformTenant.findUnique({ where: { id: 'tenant-1' } })
      expect(row?.plan).toBe('PROFESIONAL')
    })
  })
})
