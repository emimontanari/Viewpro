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
import { PermissionsModule } from '../../permissions/permissions.module'
import { OperatorsModule } from '../operators.module'

/**
 * T1.3.11 — RED: `OperatorsController` at `operators/manage` — mirrors
 * `platform-control.controller.spec.ts` style. 401 (AuthGuard), 403
 * PERMISSION_DENIED (PlatformPermissionGuard(OPERATORS_MANAGE)) on all 4
 * routes incl. GET, 403 STEP_UP_REQUIRED on the 3 mutating routes only, 201
 * create success, 200 list/patch success, 409 duplicate-email, 422
 * self-target and last-OWNER on both PATCH routes.
 */
const TEST_EMAIL = 'operators-mgmt-test-owner@viewpro.app'
const TEST_PASSWORD = 'operators-mgmt-test-owner-password'
const TEST_EMAIL_ANALYST = 'operators-mgmt-test-analyst@viewpro.app'
const TEST_PASSWORD_ANALYST = 'operators-mgmt-test-analyst-password'
const TEST_EMAIL_OPERATIONS = 'operators-mgmt-test-operations@viewpro.app'
const TEST_PASSWORD_OPERATIONS = 'operators-mgmt-test-operations-password'

function extractCookie(headers: Record<string, unknown>, name: string): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes(`${name}=`)) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

function extractPlatformCookie(headers: Record<string, unknown>): string {
  return extractCookie(headers, 'viewpro_platform_access_token')
}

describe('OperatorsController (viewpro-api) — operators/manage (T1.3.11)', () => {
  let app: INestApplication
  let prisma: PrismaService

  function seedOperator(email: string, password: string): void {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: { ...process.env, SEED_OPERATOR_EMAIL: email, SEED_OPERATOR_PASSWORD: password },
    })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
        OperatorsModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = moduleFixture.get(PrismaService)

    // OWNER by default (seed script sets role: OWNER).
    seedOperator(TEST_EMAIL, TEST_PASSWORD)

    seedOperator(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
    await prisma.operator.update({ where: { email: TEST_EMAIL_ANALYST }, data: { role: 'ANALYST' } })

    seedOperator(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
    await prisma.operator.update({ where: { email: TEST_EMAIL_OPERATIONS }, data: { role: 'OPERATIONS' } })

    // Ensure TEST_EMAIL stays ACTIVE OWNER across runs (upsert's update:{} never resets it).
    await prisma.operator.update({ where: { email: TEST_EMAIL }, data: { status: 'ACTIVE', role: 'OWNER' } })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.operator.deleteMany({ where: { email: { contains: 'operators-mgmt-test-created' } } })
  })

  async function getSessionCookieFor(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
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

  async function ownerSession() {
    const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
    const stepUpCookie = await getStepUpCookieFor(cookie, TEST_PASSWORD)
    return { cookie, stepUpCookie, combined: `${cookie}; ${stepUpCookie}` }
  }

  // ---------------------------------------------------------------------
  // 401 — AuthGuard
  // ---------------------------------------------------------------------
  describe('401 AUTH_REQUIRED — no session on any route', () => {
    it('GET /api/operators/manage without session → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/operators/manage')
      expect(res.status).toBe(401)
    })

    it('POST /api/operators/manage without session → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .send({ email: 'x@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })
      expect(res.status).toBe(401)
    })

    it('PATCH /api/operators/manage/:id/role without session → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/role')
        .send({ role: 'ANALYST' })
      expect(res.status).toBe(401)
    })

    it('PATCH /api/operators/manage/:id/status without session → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/status')
        .send({ status: 'SUSPENDED' })
      expect(res.status).toBe(401)
    })
  })

  // ---------------------------------------------------------------------
  // 403 PERMISSION_DENIED — non-OWNER on all 4 routes, including GET
  // ---------------------------------------------------------------------
  describe('403 PERMISSION_DENIED — non-OWNER blocked on all 4 routes', () => {
    it('ANALYST: GET /api/operators/manage → 403 PERMISSION_DENIED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
      const res = await request(app.getHttpServer()).get('/api/operators/manage').set('Cookie', cookie)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
    })

    it('OPERATIONS: GET /api/operators/manage → 403 PERMISSION_DENIED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
      const res = await request(app.getHttpServer()).get('/api/operators/manage').set('Cookie', cookie)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
    })

    it('ANALYST: POST /api/operators/manage → 403 PERMISSION_DENIED, no creation', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', cookie)
        .send({ email: 'operators-mgmt-test-created-blocked@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
    })

    it('ANALYST: PATCH .../role → 403 PERMISSION_DENIED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/role')
        .set('Cookie', cookie)
        .send({ role: 'ANALYST' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
    })

    it('ANALYST: PATCH .../status → 403 PERMISSION_DENIED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
    })
  })

  // ---------------------------------------------------------------------
  // 403 STEP_UP_REQUIRED — only the 3 mutating routes, list is exempt
  // ---------------------------------------------------------------------
  describe('403 STEP_UP_REQUIRED — mutating routes only, list exempt', () => {
    it('OWNER, no step-up: GET /api/operators/manage → 200 (list is exempt from step-up)', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
      const res = await request(app.getHttpServer()).get('/api/operators/manage').set('Cookie', cookie)
      expect(res.status).toBe(200)
    })

    it('OWNER, no step-up: POST /api/operators/manage → 403 STEP_UP_REQUIRED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', cookie)
        .send({ email: 'operators-mgmt-test-created-nostepup@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
    })

    it('OWNER, no step-up: PATCH .../role → 403 STEP_UP_REQUIRED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/role')
        .set('Cookie', cookie)
        .send({ role: 'ANALYST' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
    })

    it('OWNER, no step-up: PATCH .../status → 403 STEP_UP_REQUIRED', async () => {
      const cookie = await getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/some-id/status')
        .set('Cookie', cookie)
        .send({ status: 'SUSPENDED' })
      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
    })
  })

  // ---------------------------------------------------------------------
  // Success paths + validation
  // ---------------------------------------------------------------------
  describe('success paths', () => {
    it('POST /api/operators/manage with valid step-up → 201, operator created, no passwordHash in response', async () => {
      const { combined } = await ownerSession()
      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-1@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      expect(res.status).toBe(201)
      expect(res.body.role).toBe('ANALYST')
      expect(res.body).not.toHaveProperty('passwordHash')
    })

    it('GET /api/operators/manage → 200, list includes created operator, never passwordHash', async () => {
      const { combined } = await ownerSession()
      await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-2@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      const res = await request(app.getHttpServer()).get('/api/operators/manage').set('Cookie', combined)
      expect(res.status).toBe(200)
      const created = (res.body as Array<{ email: string; passwordHash?: string }>).find(
        (op) => op.email === 'operators-mgmt-test-created-2@viewpro.app',
      )
      expect(created).toBeDefined()
      expect(created).not.toHaveProperty('passwordHash')
    })

    it('PATCH .../role with valid step-up → 200, role updated', async () => {
      const { combined } = await ownerSession()
      const createRes = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-3@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      const res = await request(app.getHttpServer())
        .patch(`/api/operators/manage/${createRes.body.id}/role`)
        .set('Cookie', combined)
        .send({ role: 'OPERATIONS' })

      expect(res.status).toBe(200)
      expect(res.body.role).toBe('OPERATIONS')
    })

    it('PATCH .../status with valid step-up → 200, status updated', async () => {
      const { combined } = await ownerSession()
      const createRes = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-4@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      const res = await request(app.getHttpServer())
        .patch(`/api/operators/manage/${createRes.body.id}/status`)
        .set('Cookie', combined)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('SUSPENDED')
    })

    it('POST duplicate email → 409, no second row created', async () => {
      const { combined } = await ownerSession()
      await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-dup@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-dup@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })

      expect(res.status).toBe(409)

      const count = await prisma.operator.count({ where: { email: 'operators-mgmt-test-created-dup@viewpro.app' } })
      expect(count).toBe(1)
    })

    it('invalid body (email malformed) → 400 from DTO validation, never reaches the handler', async () => {
      const { combined } = await ownerSession()
      const res = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'not-an-email', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })
      expect(res.status).toBe(400)
    })
  })

  // ---------------------------------------------------------------------
  // 404 — well-formed but nonexistent target (JD FIX 2: not a 500)
  // ---------------------------------------------------------------------
  describe('404 on nonexistent target (JD FIX 2)', () => {
    it('PATCH .../:id/role with a well-formed but nonexistent id → 404 (not 500)', async () => {
      const { combined } = await ownerSession()
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/op-nonexistent-jd-404/role')
        .set('Cookie', combined)
        .send({ role: 'ANALYST' })

      expect(res.status).toBe(404)
    })

    it('PATCH .../:id/status with a well-formed but nonexistent id → 404 (not 500)', async () => {
      const { combined } = await ownerSession()
      const res = await request(app.getHttpServer())
        .patch('/api/operators/manage/op-nonexistent-jd-404/status')
        .set('Cookie', combined)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------
  // 422 self-target and last-OWNER on both PATCH routes
  // ---------------------------------------------------------------------
  describe('422 guardrails on PATCH routes', () => {
    it('OWNER attempts to change their OWN role → 422, role unchanged', async () => {
      const ownerBefore = await prisma.operator.findUnique({ where: { email: TEST_EMAIL } })
      const { combined } = await ownerSession()

      const res = await request(app.getHttpServer())
        .patch(`/api/operators/manage/${ownerBefore!.id}/role`)
        .set('Cookie', combined)
        .send({ role: 'ANALYST' })

      expect(res.status).toBe(422)
      const ownerAfter = await prisma.operator.findUnique({ where: { email: TEST_EMAIL } })
      expect(ownerAfter?.role).toBe('OWNER')
    })

    it('OWNER attempts to suspend THEMSELVES → 422, status unchanged', async () => {
      const ownerBefore = await prisma.operator.findUnique({ where: { email: TEST_EMAIL } })
      const { combined } = await ownerSession()

      const res = await request(app.getHttpServer())
        .patch(`/api/operators/manage/${ownerBefore!.id}/status`)
        .set('Cookie', combined)
        .send({ status: 'SUSPENDED' })

      expect(res.status).toBe(422)
      const ownerAfter = await prisma.operator.findUnique({ where: { email: TEST_EMAIL } })
      expect(ownerAfter?.status).toBe('ACTIVE')
    })

    // NOTE on architecture: with actor !== target, a SINGLE synchronous HTTP
    // request can never trigger the last-OWNER 422, because the acting
    // operator must itself be an ACTIVE OWNER to hold OPERATORS_MANAGE
    // permission — so the actor is always part of the locked ACTIVE-OWNER
    // set and is never excluded (only the target is excluded), guaranteeing
    // at least 1 remaining owner (the actor) whenever actor !== target. The
    // last-OWNER guard is therefore only reachable via: (a) actor === target
    // (self-suspend/self-demote, tested above — the self-check fires first
    // and already returns 422), or (b) a genuine concurrent race between two
    // DIFFERENT actors' requests, which is exactly what T1.2.5's real-Postgres
    // concurrency integration test proves against the guard directly. This
    // e2e suite therefore verifies the ROUTE WIRING surfaces a 422 from the
    // guard path (via the self-target case); the race-safety guarantee
    // itself is proven at the T1.2.3/T1.2.5 layers, per design notes.
    it('a second OWNER CAN demote/suspend another OWNER when at least one other active OWNER remains (not the last one — guard does not false-positive)', async () => {
      const { combined } = await ownerSession()
      const createRes = await request(app.getHttpServer())
        .post('/api/operators/manage')
        .set('Cookie', combined)
        .send({ email: 'operators-mgmt-test-created-second-owner@viewpro.app', role: 'OWNER', tempPassword: 'a-strong-temp-pw12' })
      expect(createRes.status).toBe(201)

      const res = await request(app.getHttpServer())
        .patch(`/api/operators/manage/${createRes.body.id}/role`)
        .set('Cookie', combined)
        .send({ role: 'ANALYST' })

      // TEST_EMAIL (actor) remains an active OWNER, so demoting the second
      // OWNER (target) does NOT trip the last-OWNER guard.
      expect(res.status).toBe(200)
      expect(res.body.role).toBe('ANALYST')
    })
  })
})
