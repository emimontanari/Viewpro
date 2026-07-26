import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import { TenantBillingStatusService } from '../tenant-billing-status.service'
import { CLOCK } from '../clock'

/**
 * platform-payment-ledger (PR 3) — RED: the billing status the console reads.
 *
 * Overdue is computed here, at read time, from the ledger. There is no
 * scheduled job and no stored state: nothing has to run at midnight for a
 * tenant to appear overdue, and nothing can be left stale by a job that
 * silently stopped.
 *
 * Crucially, going overdue changes NOTHING about the tenant. Its status,
 * limits and plan are untouched — the console shows a badge, and cutting
 * access stays a deliberate human action. That is asserted here rather than
 * assumed.
 *
 * Spec: Overdue Is Derived and Never Restricts Access, Paid-Through Date Is
 *   Derived, Period Boundaries Use a Fixed Timezone.
 */
describe('TenantBillingStatusService (integration — test DB)', () => {
  let moduleRef: TestingModule
  let service: TenantBillingStatusService
  let payments: PrismaPaymentRepository
  let prisma: PrismaService

  const PAID = 'billing-status-paid'
  const OVERDUE = 'billing-status-overdue'
  const NEVER_PAID = 'billing-status-never-paid'
  const ALL = [PAID, OVERDUE, NEVER_PAID]

  // Injected clock: 2026-09-03 in Buenos Aires (UTC-3).
  const NOW = new Date('2026-09-03T15:00:00.000Z')

  async function record(tenantId: string, periodStart: string, periodEnd: string) {
    return payments.record({
      tenantId,
      amountMinorUnits: 4_500_000n,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart,
      periodEnd,
      receiptReference: null,
      note: null,
      recordedByOperatorId: 'operator-1',
    })
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        TenantBillingStatusService,
        PrismaPaymentRepository,
        { provide: CLOCK, useValue: { now: () => NOW } },
      ],
    }).compile()

    service = moduleRef.get(TenantBillingStatusService)
    payments = moduleRef.get(PrismaPaymentRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: { in: ALL } } })
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: { in: ALL }, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: { in: ALL } } })
  })

  it('reports a tenant paid into the future as not overdue', async () => {
    await record(PAID, '2026-09-01', '2026-09-30')

    const status = await service.forTenants([PAID])

    expect(status.get(PAID)).toEqual({ paidThroughAt: '2026-09-30', overdueDays: null })
  })

  it('reports days elapsed for a tenant whose period has lapsed', async () => {
    await record(OVERDUE, '2026-08-01', '2026-08-31')

    const status = await service.forTenants([OVERDUE])

    expect(status.get(OVERDUE)).toEqual({ paidThroughAt: '2026-08-31', overdueDays: 3 })
  })

  it('reports a tenant that was never paid for as neither paid nor overdue', async () => {
    const status = await service.forTenants([NEVER_PAID])

    // Never due, so never overdue — the badge must not appear for a tenant
    // nobody ever charged.
    expect(status.get(NEVER_PAID)).toEqual({ paidThroughAt: null, overdueDays: null })
  })

  it('resolves many tenants in a single call, without querying per tenant', async () => {
    await record(PAID, '2026-09-01', '2026-09-30')
    await record(OVERDUE, '2026-08-01', '2026-08-31')

    const status = await service.forTenants(ALL)

    expect(status.size).toBe(3)
    expect(status.get(PAID)?.overdueDays).toBeNull()
    expect(status.get(OVERDUE)?.overdueDays).toBe(3)
    expect(status.get(NEVER_PAID)?.paidThroughAt).toBeNull()
  })

  it('stops treating a tenant as paid once its only payment is reversed', async () => {
    const payment = await record(PAID, '2026-09-01', '2026-09-30')
    await payments.reverse({ paymentId: payment.id, reason: 'not received', recordedByOperatorId: 'operator-1' })

    const status = await service.forTenants([PAID])

    expect(status.get(PAID)).toEqual({ paidThroughAt: null, overdueDays: null })
  })

  it('returns an empty map for an empty tenant list without hitting the database', async () => {
    const status = await service.forTenants([])

    expect(status.size).toBe(0)
  })

  it('is not overdue on the very last day of the paid period', async () => {
    // Period ends exactly on "today" in Buenos Aires.
    await record(PAID, '2026-08-01', '2026-09-03')

    const status = await service.forTenants([PAID])

    expect(status.get(PAID)).toEqual({ paidThroughAt: '2026-09-03', overdueDays: null })
  })
})
