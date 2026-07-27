import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'

/**
 * platform-payment-ledger — RED: revenue must be bucketed in the ledger's
 * fixed timezone, not UTC.
 *
 * Found by Judgment Day (both judges, independently). The original code keyed
 * the month with `toISOString()`, so a payment recorded at 22:00 on the last
 * day of a month in Buenos Aires (01:00 UTC the next day) was reported in the
 * FOLLOWING month. One month under-reports, the next over-reports, and the
 * panel meanwhile tells the operator the figure is "el mes en que se registró
 * el pago".
 *
 * The existing revenue tests never caught it because they use the real clock
 * and never land in the 21:00–23:59 window on a month boundary. These fixtures
 * set `recordedAt` explicitly to sit exactly there.
 *
 * Spec: Revenue Summary, Period Boundaries Use a Fixed Timezone.
 */
describe('revenue month bucketing (integration — test DB)', () => {
  let moduleRef: TestingModule
  let repository: PrismaPaymentRepository
  let prisma: PrismaService

  const TENANT = 'revenue-timezone-tenant'

  /**
   * Insert with an explicit `recordedAt`. Written through Prisma directly
   * because the ledger deliberately offers no way to set it — the repository
   * is append-only and the column is database-defaulted.
   */
  async function recordAt(recordedAt: string, amountMinorUnits: bigint) {
    return prisma.tenantPayment.create({
      data: {
        tenantId: TENANT,
        amountMinorUnits,
        currency: 'ARS',
        method: 'BANK_TRANSFER',
        plan: 'PROFESIONAL',
        periodStart: new Date('2026-03-01T00:00:00.000Z'),
        periodEnd: new Date('2026-03-31T00:00:00.000Z'),
        recordedByOperatorId: 'operator-1',
        recordedAt: new Date(recordedAt),
      },
    })
  }

  async function monthsForTenant() {
    const rows = await repository.revenueByMonth()

    return new Map(rows.filter((row) => row.plan === 'PROFESIONAL').map((row) => [row.month, row]))
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PrismaPaymentRepository],
    }).compile()

    repository = moduleRef.get(PrismaPaymentRepository)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
  })

  it('counts a 22:00 ART payment on the last day of March as March revenue', async () => {
    // 2026-03-31T22:00 in Buenos Aires (UTC-3) === 2026-04-01T01:00Z.
    await recordAt('2026-04-01T01:00:00.000Z', 4_500_000n)

    const months = await monthsForTenant()

    expect(months.get('2026-03')?.collectedMinorUnits).toBe(4_500_000n)
    expect(months.has('2026-04')).toBe(false)
  })

  it('counts a 23:59 ART payment on the last day of a month in that month', async () => {
    // 2026-08-31T23:59 ART === 2026-09-01T02:59Z.
    await recordAt('2026-09-01T02:59:00.000Z', 1_000_000n)

    const months = await monthsForTenant()

    expect(months.get('2026-08')?.collectedMinorUnits).toBe(1_000_000n)
    expect(months.has('2026-09')).toBe(false)
  })

  it('counts a 00:01 ART payment on the first day in the new month', async () => {
    // 2026-09-01T00:01 ART === 2026-09-01T03:01Z — genuinely September.
    await recordAt('2026-09-01T03:01:00.000Z', 2_000_000n)

    const months = await monthsForTenant()

    expect(months.get('2026-09')?.collectedMinorUnits).toBe(2_000_000n)
    expect(months.has('2026-08')).toBe(false)
  })

  it('keeps a mid-month payment in its own month', async () => {
    await recordAt('2026-08-15T18:00:00.000Z', 3_000_000n)

    const months = await monthsForTenant()

    expect(months.get('2026-08')?.collectedMinorUnits).toBe(3_000_000n)
  })

  it('sums two payments that straddle the UTC boundary into the same real month', async () => {
    // Both are August in Buenos Aires; naive UTC bucketing would split them.
    await recordAt('2026-08-15T18:00:00.000Z', 1_000_000n)
    await recordAt('2026-09-01T02:30:00.000Z', 500_000n)

    const months = await monthsForTenant()

    expect(months.get('2026-08')?.collectedMinorUnits).toBe(1_500_000n)
    expect(months.has('2026-09')).toBe(false)
  })
})
