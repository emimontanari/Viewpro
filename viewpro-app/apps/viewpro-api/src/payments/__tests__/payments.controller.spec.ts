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
import { PermissionsModule } from '../../permissions/permissions.module'
import { PrismaService } from '../../database/prisma.service'
import { PaymentsModule } from '../payments.module'

/**
 * platform-payment-ledger (PR 2) — RED: authorization and step-up over money.
 *
 * This is the highest-risk surface in the slice: it is where authorization,
 * re-authentication, and irreversible money writes meet. Every rejection below
 * asserts not just the status code but that NOTHING was written — a 403 that
 * still persists a row is worse than no guard at all, because the ledger would
 * then contain entries nobody was allowed to make.
 *
 * Spec: Permission Separation for Money Operations, Money Mutations Require
 *   Step-Up, Record a Payment, Money Never Crosses Into InmoView.
 */
const OWNER_EMAIL = 'payments-test-owner@viewpro.app'
const OWNER_PASSWORD = 'payments-test-owner-password'
const OPERATIONS_EMAIL = 'payments-test-operations@viewpro.app'
const OPERATIONS_PASSWORD = 'payments-test-operations-password'
const ANALYST_EMAIL = 'payments-test-analyst@viewpro.app'
const ANALYST_PASSWORD = 'payments-test-analyst-password'

const TENANT = 'payments-controller-tenant'

function extractCookie(headers: Record<string, unknown>, name: string): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes(`${name}=`)) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('PaymentsController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      amountMinorUnits: '4500000',
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      receiptReference: '8842-A',
      ...overrides,
    }
  }

  function seedOperator(email: string, password: string): void {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: { ...process.env, SEED_OPERATOR_EMAIL: email, SEED_OPERATOR_PASSWORD: password },
    })
  }

  async function sessionCookie(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password })
    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}: ${res.status}`)
    }
    return extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_access_token')
  }

  async function stepUpCookie(access: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .set('Cookie', access)
      .send({ password })
    if (res.status !== 200) {
      throw new Error(`Step-up failed: ${res.status}`)
    }
    return extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
  }

  async function paymentCount(): Promise<number> {
    return prisma.tenantPayment.count({ where: { tenantId: TENANT } })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
        PaymentsModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = moduleFixture.get(PrismaService)

    seedOperator(OWNER_EMAIL, OWNER_PASSWORD)
    await prisma.operator.update({ where: { email: OWNER_EMAIL }, data: { role: 'OWNER' } })
    seedOperator(OPERATIONS_EMAIL, OPERATIONS_PASSWORD)
    await prisma.operator.update({ where: { email: OPERATIONS_EMAIL }, data: { role: 'OPERATIONS' } })
    seedOperator(ANALYST_EMAIL, ANALYST_PASSWORD)
    await prisma.operator.update({ where: { email: ANALYST_EMAIL }, data: { role: 'ANALYST' } })

    await prisma.platformTenant.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Payments Test Agency', slug: 'payments-test', latestStatus: 'ACTIVE' },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformAuditLog.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformTenant.deleteMany({ where: { id: TENANT } })
    await app.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformAuditLog.deleteMany({ where: { tenantId: TENANT } })
  })

  describe('recording', () => {
    it('records a payment for an OWNER with a fresh step-up', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      expect(res.status).toBe(201)
      // The amount comes back as a string, never a JSON number.
      expect(res.body.amountMinorUnits).toBe('4500000')
      expect(typeof res.body.amountMinorUnits).toBe('string')
      expect(await paymentCount()).toBe(1)
    })

    it('rejects a payment for an unknown tenant with 404 and writes nothing', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post('/api/operators/tenants/tenant-that-does-not-exist/payments')
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      expect(res.status).toBe(404)
      expect(await paymentCount()).toBe(0)
    })

    it('rejects a fractional amount with 400 and writes nothing', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody({ amountMinorUnits: '4500.75' }))

      expect(res.status).toBe(400)
      expect(await paymentCount()).toBe(0)
    })

    it('rejects a zero amount with 400', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody({ amountMinorUnits: '0' }))

      expect(res.status).toBe(400)
      expect(await paymentCount()).toBe(0)
    })

    it('rejects an inverted period with 400 and writes nothing', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody({ periodStart: '2026-08-31', periodEnd: '2026-08-01' }))

      expect(res.status).toBe(400)
      expect(await paymentCount()).toBe(0)
    })
  })

  describe('step-up', () => {
    it('refuses to record without a step-up cookie and writes nothing', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', access)
        .send(validBody())

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(await paymentCount()).toBe(0)
    })

    it('refuses to reverse without a step-up cookie', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      const res = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', access)
        .send({ reason: 'no step-up' })

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('STEP_UP_REQUIRED')
      expect(await paymentCount()).toBe(1)
    })
  })

  describe('separation of duties', () => {
    it('refuses an ANALYST recording a payment, and writes nothing', async () => {
      const access = await sessionCookie(ANALYST_EMAIL, ANALYST_PASSWORD)
      const stepUp = await stepUpCookie(access, ANALYST_PASSWORD)

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('PERMISSION_DENIED')
      expect(await paymentCount()).toBe(0)
    })

    it('lets an ANALYST read the ledger — the auditor must be able to look', async () => {
      const ownerAccess = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const ownerStepUp = await stepUpCookie(ownerAccess, OWNER_PASSWORD)
      await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${ownerAccess}; ${ownerStepUp}`)
        .send(validBody())

      const analystAccess = await sessionCookie(ANALYST_EMAIL, ANALYST_PASSWORD)
      const res = await request(app.getHttpServer())
        .get(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', analystAccess)

      expect(res.status).toBe(200)
      expect(res.body.payments).toHaveLength(1)
      // History and billing state arrive together, so the page cannot render a
      // paid-through date from one moment beside a list from another.
      expect(res.body.paidThroughAt).toBe('2026-08-31')
    })

    it('lets OPERATIONS record but refuses OPERATIONS reversing', async () => {
      const access = await sessionCookie(OPERATIONS_EMAIL, OPERATIONS_PASSWORD)
      const stepUp = await stepUpCookie(access, OPERATIONS_PASSWORD)

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())
      expect(created.status).toBe(201)

      const reversal = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send({ reason: 'operations should not be able to do this' })

      expect(reversal.status).toBe(403)
      expect(reversal.body.code).toBe('PERMISSION_DENIED')
      // Only the original payment exists — no reversal row was written.
      expect(await paymentCount()).toBe(1)
    })

    it('lets an OWNER reverse, keeping both rows', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      const reversal = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send({ reason: 'wrong tenant' })

      expect(reversal.status).toBe(201)
      expect(await paymentCount()).toBe(2)
    })

    it('rejects a reversal with a blank reason', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      const res = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send({ reason: '' })

      expect(res.status).toBe(400)
      expect(await paymentCount()).toBe(1)
    })

    it('rejects a second reversal with 409', async () => {
      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send({ reason: 'first' })

      const second = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send({ reason: 'second' })

      expect(second.status).toBe(409)
      expect(await paymentCount()).toBe(2)
    })
  })

  describe('isolation', () => {
    it('leaves tenant limits untouched when a payment is recorded', async () => {
      const before = await prisma.platformTenant.findUniqueOrThrow({ where: { id: TENANT } })

      const access = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
      const stepUp = await stepUpCookie(access, OWNER_PASSWORD)
      await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', `${access}; ${stepUp}`)
        .send(validBody())

      const after = await prisma.platformTenant.findUniqueOrThrow({ where: { id: TENANT } })

      expect(after.maxUsers).toBe(before.maxUsers)
      expect(after.maxActivePropertyEngagements).toBe(before.maxActivePropertyEngagements)
      expect(after.maxDocumentsStorageMb).toBe(before.maxDocumentsStorageMb)
      expect(after.latestStatus).toBe(before.latestStatus)
      expect(after.plan).toBe(before.plan)
    })
  })
})
