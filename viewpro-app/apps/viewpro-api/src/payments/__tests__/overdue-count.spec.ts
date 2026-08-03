import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import { TenantBillingStatusService } from '../tenant-billing-status.service'
import { CLOCK } from '../clock'

/**
 * platform-payment-ledger (PR 4) — RED: the overdue count.
 *
 * This number is the compensating control for "warn, don't cut". Nothing
 * suspends a lapsed tenant, so if this count is wrong — or silently excludes
 * tenants nobody ever charged when it should not — the decision to never cut
 * access has no safety net at all.
 *
 * The deliberate exclusion: a tenant that was NEVER paid for is not counted as
 * overdue. It was never due. Counting it would put every trial signup in the
 * alert, and an alert that is always red is an alert nobody reads.
 *
 * Spec: Overdue Is Derived and Never Restricts Access.
 */
describe('overdue count (integration — test DB)', () => {
  let moduleRef: TestingModule
  let service: TenantBillingStatusService
  let payments: PrismaPaymentRepository
  let prisma: PrismaService

  const LAPSED_A = 'overdue-count-lapsed-a'
  const LAPSED_B = 'overdue-count-lapsed-b'
  const CURRENT = 'overdue-count-current'
  const NEVER_PAID = 'overdue-count-never'
  const ALL = [LAPSED_A, LAPSED_B, CURRENT, NEVER_PAID]

  const NOW = new Date('2026-09-03T15:00:00.000Z')

  async function record(tenantId: string, periodEnd: string) {
    return payments.record({
      tenantId,
      amountMinorUnits: 4_500_000n,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart: '2026-07-01',
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

  it('counts only tenants whose paid period has lapsed', async () => {
    await record(LAPSED_A, '2026-08-31')
    await record(LAPSED_B, '2026-08-15')
    await record(CURRENT, '2026-09-30')

    expect(await service.countOverdue(ALL)).toBe(2)
  })

  it('does not count a tenant that was never paid for', async () => {
    await record(CURRENT, '2026-09-30')

    // NEVER_PAID has no payments at all and must not appear: it was never due,
    // and counting every trial signup would make the alert permanently red.
    expect(await service.countOverdue(ALL)).toBe(0)
  })

  it('stops counting a tenant once a new payment covers the gap', async () => {
    await record(LAPSED_A, '2026-08-31')
    expect(await service.countOverdue(ALL)).toBe(1)

    await record(LAPSED_A, '2026-09-30')

    expect(await service.countOverdue(ALL)).toBe(0)
  })

  it('counts a tenant again when its only payment is reversed', async () => {
    const payment = await record(LAPSED_A, '2026-09-30')
    expect(await service.countOverdue(ALL)).toBe(0)

    await payments.reverse({
      paymentId: payment.id,
      reason: 'not received',
      recordedByOperatorId: 'operator-1',
    })

    // Back to "never paid for", which is NOT overdue — the reversal removed the
    // only evidence they ever paid, so there is no lapsed period to report.
    expect(await service.countOverdue(ALL)).toBe(0)
  })

  it('is zero for an empty tenant list', async () => {
    expect(await service.countOverdue([])).toBe(0)
  })
})
