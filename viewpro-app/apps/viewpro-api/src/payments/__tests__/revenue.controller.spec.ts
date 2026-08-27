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
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import { seedOperatorFixture } from '../../test-support/operator.fixture'

/**
 * platform-payment-ledger (PR 4) — RED: the revenue summary.
 *
 * The figure has to be defensible, which means two things beyond "it adds up":
 * reversed payments must not inflate it, and the response must SAY which month
 * a payment belongs to. Revenue reported without stating its attribution rule
 * is the kind of number that quietly becomes a business decision.
 *
 * Spec: Revenue Summary, Permission Separation for Money Operations.
 */
const OWNER_EMAIL = 'revenue-test-owner@viewpro.app'
const OWNER_PASSWORD = 'revenue-test-owner-password'
const ANALYST_EMAIL = 'revenue-test-analyst@viewpro.app'
const ANALYST_PASSWORD = 'revenue-test-analyst-password'

const TENANT = 'revenue-controller-tenant'

function extractCookie(headers: Record<string, unknown>, name: string): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes(`${name}=`)) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('RevenueController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let payments: PrismaPaymentRepository

  async function sessionCookie(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password })
    return extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_access_token')
  }

  async function record(amountMinorUnits: bigint, plan: string) {
    return payments.record({
      tenantId: TENANT,
      amountMinorUnits,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan,
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      receiptReference: null,
      note: null,
      recordedByOperatorId: 'operator-1',
    })
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
    payments = moduleFixture.get(PrismaPaymentRepository)

    await seedOperatorFixture(app, { email: OWNER_EMAIL, password: OWNER_PASSWORD })
    await seedOperatorFixture(app, { email: ANALYST_EMAIL, password: ANALYST_PASSWORD, role: 'ANALYST' })

    await prisma.platformTenant.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Revenue Test Agency', slug: 'revenue-test', latestStatus: 'ACTIVE' },
      update: {},
    })
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformTenant.deleteMany({ where: { id: TENANT } })
    await app.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
  })

  async function summaryFor(cookie: string) {
    return request(app.getHttpServer()).get('/api/operators/revenue/summary').set('Cookie', cookie)
  }

  it('states the attribution rule in the response', async () => {
    const cookie = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)

    const res = await summaryFor(cookie)

    expect(res.status).toBe(200)
    // Without this, the figure could be read as accrual accounting — money for
    // the period covered rather than money actually collected that month.
    expect(res.body.attribution).toBe('RECORDED_AT')
  })

  it('sums non-reversed payments exactly, as strings', async () => {
    await record(1010n, 'PROFESIONAL')
    await record(2020n, 'PROFESIONAL')

    const cookie = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
    const res = await summaryFor(cookie)
    const mine = res.body.months.flatMap((month: { rows: unknown[] }) => month.rows)
      .filter((row: { plan: string }) => row.plan === 'PROFESIONAL')

    const total = mine.reduce(
      (sum: bigint, row: { collectedMinorUnits: string }) => sum + BigInt(row.collectedMinorUnits),
      0n,
    )

    expect(total).toBe(3030n)
    // Amounts leave as strings, exactly as they arrive.
    expect(typeof mine[0].collectedMinorUnits).toBe('string')
  })

  it('excludes reversed payments from the total', async () => {
    await record(1010n, 'PROFESIONAL')
    const dropped = await record(5000n, 'PROFESIONAL')
    await payments.reverse({
      paymentId: dropped.id,
      reason: 'refunded',
      recordedByOperatorId: 'operator-1',
    })

    const cookie = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
    const res = await summaryFor(cookie)
    const mine = res.body.months
      .flatMap((month: { rows: unknown[] }) => month.rows)
      .filter((row: { plan: string }) => row.plan === 'PROFESIONAL')
    const total = mine.reduce(
      (sum: bigint, row: { collectedMinorUnits: string }) => sum + BigInt(row.collectedMinorUnits),
      0n,
    )

    expect(total).toBe(1010n)
  })

  it('breaks revenue down by plan, and the parts sum to the month total', async () => {
    await record(1000n, 'BASICO')
    await record(2000n, 'PROFESIONAL')

    const cookie = await sessionCookie(OWNER_EMAIL, OWNER_PASSWORD)
    const res = await summaryFor(cookie)
    const month = res.body.months.find((entry: { rows: { plan: string }[] }) =>
      entry.rows.some((row) => row.plan === 'BASICO'),
    )

    const partsTotal = month.rows.reduce(
      (sum: bigint, row: { collectedMinorUnits: string }) => sum + BigInt(row.collectedMinorUnits),
      0n,
    )

    expect(BigInt(month.totalMinorUnits)).toBe(partsTotal)
  })

  it('lets an ANALYST read revenue — the auditor must see the money', async () => {
    const cookie = await sessionCookie(ANALYST_EMAIL, ANALYST_PASSWORD)

    const res = await summaryFor(cookie)

    expect(res.status).toBe(200)
  })

  it('rejects an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/operators/revenue/summary')

    expect(res.status).toBe(401)
  })
})
