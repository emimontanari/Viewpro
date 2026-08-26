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
import { PermissionsModule } from '../../permissions/permissions.module'
import { PrismaService } from '../../database/prisma.service'
import { PaymentsModule } from '../payments.module'
import { seedOperatorFixture } from '../../test-support/operator.fixture'

/**
 * platform-payment-ledger — RED: defects confirmed by both Judgment Day judges.
 *
 * Two API-surface findings:
 *
 * 1. `currency` accepted any 0-3 character string. `@IsOptional()` only skips
 *    null/undefined, so `""` passed validation, and the controller's `?? 'ARS'`
 *    is nullish-only so it did not fill it either. The row then keyed its own
 *    revenue bucket that never joined the ARS total, and rendered with a blank
 *    currency prefix.
 *
 * 2. Reversing a nonexistent payment answered 409, the same status reserved for
 *    the genuine "already reversed" conflict — so a caller could not tell a bad
 *    id from a real state conflict.
 *
 * Spec: Record a Payment, Reversal Corrects Without Erasing.
 */
const OWNER_EMAIL = 'judgment-fix-owner@viewpro.app'
const OWNER_PASSWORD = 'judgment-fix-owner-password'

const TENANT = 'judgment-fixes-tenant'

function extractCookie(headers: Record<string, unknown>, name: string): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes(`${name}=`)) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('Judgment Day confirmed fixes (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService

  function validBody(overrides: Record<string, unknown> = {}) {
    return {
      amountMinorUnits: '4500000',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      ...overrides,
    }
  }

  async function auth(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
    const access = extractCookie(login.headers as Record<string, unknown>, 'viewpro_platform_access_token')

    const stepUp = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .set('Cookie', access)
      .send({ password: OWNER_PASSWORD })

    return `${access}; ${extractCookie(stepUp.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')}`
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
    await app.listen(0)

    prisma = moduleFixture.get(PrismaService)

    await seedOperatorFixture(app, { email: OWNER_EMAIL, password: OWNER_PASSWORD })

    await prisma.platformTenant.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Judgment Fixes Agency', slug: 'judgment-fixes', latestStatus: 'ACTIVE' },
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
  })

  describe('currency validation', () => {
    it('rejects an empty currency instead of storing it', async () => {
      const cookie = await auth()

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', cookie)
        .send(validBody({ currency: '' }))

      expect(res.status).toBe(400)
      expect(await prisma.tenantPayment.count({ where: { tenantId: TENANT } })).toBe(0)
    })

    it('rejects an unsupported currency code', async () => {
      const cookie = await auth()

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', cookie)
        .send(validBody({ currency: 'XX' }))

      expect(res.status).toBe(400)
      expect(await prisma.tenantPayment.count({ where: { tenantId: TENANT } })).toBe(0)
    })

    it('rejects a lowercase currency rather than creating a second bucket', async () => {
      const cookie = await auth()

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', cookie)
        .send(validBody({ currency: 'ars' }))

      expect(res.status).toBe(400)
    })

    it('defaults to ARS when currency is omitted entirely', async () => {
      const cookie = await auth()

      const res = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', cookie)
        .send(validBody())

      expect(res.status).toBe(201)
      expect(res.body.currency).toBe('ARS')
    })
  })

  describe('reversal of an unknown payment', () => {
    it('answers 404, not the 409 reserved for an already-reversed payment', async () => {
      const cookie = await auth()

      const res = await request(app.getHttpServer())
        .post('/api/operators/payments/00000000-0000-0000-0000-000000000000/reversal')
        .set('Cookie', cookie)
        .send({ reason: 'no such payment' })

      expect(res.status).toBe(404)
    })

    it('still answers 409 for a genuinely already-reversed payment', async () => {
      const cookie = await auth()

      const created = await request(app.getHttpServer())
        .post(`/api/operators/tenants/${TENANT}/payments`)
        .set('Cookie', cookie)
        .send(validBody())

      await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', cookie)
        .send({ reason: 'first' })

      const second = await request(app.getHttpServer())
        .post(`/api/operators/payments/${created.body.id}/reversal`)
        .set('Cookie', cookie)
        .send({ reason: 'second' })

      // The two states stay distinguishable: 404 = no such payment,
      // 409 = it exists and is already reversed.
      expect(second.status).toBe(409)
    })
  })
})
