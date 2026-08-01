import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import type { RecordPaymentInput } from '../payment-repository.port'

/**
 * platform-payment-ledger (PR 1) — RED: ledger persistence and the derived
 * paid-through date.
 *
 * The domain specs already prove the *arithmetic* of paid-through. What this
 * suite proves is the part that lives in SQL and cannot be unit-tested: that
 * "non-reversed" really excludes both a reversal row and the row it cancels,
 * and that the unique constraint — not a service check — is what stops a
 * double reversal.
 *
 * Spec: Reversal Corrects Without Erasing, Paid-Through Date Is Derived,
 *   The Ledger Is Append-Only, Revenue Summary.
 */
describe('PrismaPaymentRepository (integration — test DB)', () => {
  let moduleRef: TestingModule
  let repository: PrismaPaymentRepository
  let prisma: PrismaService

  const TENANT = 'tenant-payments-spec'
  const OPERATOR = 'operator-1'

  function payment(overrides: Partial<RecordPaymentInput> = {}): RecordPaymentInput {
    return {
      tenantId: TENANT,
      amountMinorUnits: 4_500_000n,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      receiptReference: '8842-A',
      note: null,
      recordedByOperatorId: OPERATOR,
      ...overrides,
    }
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
    // Reversals reference their original, so clear them first.
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
  })

  it('records a payment and reads it back with its amount intact', async () => {
    const recorded = await repository.record(payment())

    expect(recorded.amountMinorUnits).toBe(4_500_000n)
    expect(recorded.periodStart).toBe('2026-08-01')
    expect(recorded.periodEnd).toBe('2026-08-31')
    expect(recorded.recordedByOperatorId).toBe(OPERATOR)
    expect(recorded.reversalOfPaymentId).toBeNull()
  })

  it('preserves an amount beyond Number.MAX_SAFE_INTEGER through the database', async () => {
    // bigint columns must survive the round-trip; a number column would not.
    const huge = 9_007_199_254_740_993n
    const recorded = await repository.record(payment({ amountMinorUnits: huge }))
    const [readBack] = await repository.listByTenant(TENANT)

    expect(recorded.amountMinorUnits).toBe(huge)
    expect(readBack?.amountMinorUnits).toBe(huge)
  })

  it('derives paid-through as the furthest period end', async () => {
    await repository.record(payment())
    await repository.record(payment({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }))

    expect(await repository.paidThroughByTenant(TENANT)).toBe('2026-09-30')
  })

  it('derives the furthest period end regardless of recording order', async () => {
    await repository.record(payment({ periodStart: '2026-09-01', periodEnd: '2026-09-30' }))
    await repository.record(payment())

    expect(await repository.paidThroughByTenant(TENANT)).toBe('2026-09-30')
  })

  it('has no paid-through date when the tenant was never paid for', async () => {
    expect(await repository.paidThroughByTenant(TENANT)).toBeNull()
  })

  it('leaves the original row byte-identical when reversed', async () => {
    const original = await repository.record(payment())

    await repository.reverse({ paymentId: original.id, reason: 'wrong tenant', recordedByOperatorId: OPERATOR })

    const stored = await prisma.tenantPayment.findUniqueOrThrow({ where: { id: original.id } })

    expect(stored.amountMinorUnits).toBe(original.amountMinorUnits)
    expect(stored.currency).toBe(original.currency)
    expect(stored.method).toBe(original.method)
    expect(stored.plan).toBe(original.plan)
    expect(stored.receiptReference).toBe(original.receiptReference)
    expect(stored.recordedByOperatorId).toBe(original.recordedByOperatorId)
    expect(stored.recordedAt.toISOString()).toBe(original.recordedAt.toISOString())
  })

  it('keeps both rows after a reversal, with the reason recorded', async () => {
    const original = await repository.record(payment())
    const reversal = await repository.reverse({
      paymentId: original.id,
      reason: 'wrong tenant',
      recordedByOperatorId: OPERATOR,
    })

    const history = await repository.listByTenant(TENANT)

    expect(history).toHaveLength(2)
    expect(reversal.reversalOfPaymentId).toBe(original.id)
    expect(reversal.reversalReason).toBe('wrong tenant')
  })

  it('marks a reversed payment in history rather than hiding it', async () => {
    const original = await repository.record(payment())
    await repository.reverse({ paymentId: original.id, reason: 'duplicate', recordedByOperatorId: OPERATOR })

    const history = await repository.listByTenant(TENANT)
    const stored = history.find((row) => row.id === original.id)

    expect(stored).toBeDefined()
    expect(stored?.reversedByPaymentId).not.toBeNull()
  })

  it('stops counting a reversed payment toward paid-through', async () => {
    const original = await repository.record(payment())
    expect(await repository.paidThroughByTenant(TENANT)).toBe('2026-08-31')

    await repository.reverse({ paymentId: original.id, reason: 'not received', recordedByOperatorId: OPERATOR })

    expect(await repository.paidThroughByTenant(TENANT)).toBeNull()
  })

  it('rejects a second reversal of the same payment', async () => {
    const original = await repository.record(payment())
    await repository.reverse({ paymentId: original.id, reason: 'first', recordedByOperatorId: OPERATOR })

    await expect(
      repository.reverse({ paymentId: original.id, reason: 'second', recordedByOperatorId: OPERATOR }),
    ).rejects.toThrow(/already reversed/i)

    expect(await repository.listByTenant(TENANT)).toHaveLength(2)
  })

  it('rejects reversing a reversal', async () => {
    const original = await repository.record(payment())
    const reversal = await repository.reverse({
      paymentId: original.id,
      reason: 'first',
      recordedByOperatorId: OPERATOR,
    })

    await expect(
      repository.reverse({ paymentId: reversal.id, reason: 'nested', recordedByOperatorId: OPERATOR }),
    ).rejects.toThrow(/cannot itself be reversed/i)
  })

  it('excludes reversed payments from revenue and sums the rest exactly', async () => {
    const kept = await repository.record(payment({ amountMinorUnits: 1010n }))
    const alsoKept = await repository.record(payment({ amountMinorUnits: 2020n }))
    const dropped = await repository.record(payment({ amountMinorUnits: 3030n }))

    await repository.reverse({ paymentId: dropped.id, reason: 'refunded', recordedByOperatorId: OPERATOR })

    const revenue = await repository.revenueByMonth()
    const mine = revenue.filter((row) => row.plan === 'PROFESIONAL' && row.currency === 'ARS')
    const total = mine.reduce((sum, row) => sum + row.collectedMinorUnits, 0n)

    expect(kept.amountMinorUnits + alsoKept.amountMinorUnits).toBe(3030n)
    expect(total).toBe(3030n)
  })
})
