import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { PrismaPaymentRepository } from '../prisma-payment.repository'

/**
 * platform-payment-ledger — RED: deleting a reversed payment must be refused
 * by the database, not silently absorbed.
 *
 * Raised by one Judgment Day judge. The migration emitted Prisma's default
 * `ON DELETE SET NULL` for the optional self-relation, so deleting an original
 * payment would null its reversal's `reversalOfPaymentId` — and a reversal row
 * with a null link satisfies BOTH halves of NOT_REVERSED. The cancelled money
 * would quietly re-enter paid-through and revenue while the ledger still looked
 * intact. That is precisely the tamper the append-only design exists to prevent,
 * and the column's own docstring claims the DB constraint is what prevents it.
 *
 * Fixed now rather than later because the table does not yet exist in
 * production: today this is an edit to a migration that never ran. Once real
 * payments are stored it becomes a migration over live data.
 *
 * Spec: The Ledger Is Append-Only, Reversal Corrects Without Erasing.
 */
describe('reversal foreign key (integration — test DB)', () => {
  let moduleRef: TestingModule
  let repository: PrismaPaymentRepository
  let prisma: PrismaService

  const TENANT = 'reversal-fk-tenant'

  async function record(amountMinorUnits: bigint) {
    return repository.record({
      tenantId: TENANT,
      amountMinorUnits,
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      plan: 'PROFESIONAL',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      receiptReference: null,
      note: null,
      recordedByOperatorId: 'operator-1',
    })
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
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
  })

  it('refuses to delete a payment that has been reversed', async () => {
    const original = await record(4_500_000n)
    await repository.reverse({
      paymentId: original.id,
      reason: 'not received',
      recordedByOperatorId: 'operator-1',
    })

    // No application code deletes payments — this simulates a direct database
    // touch, which is exactly the scenario the constraint has to survive.
    await expect(prisma.tenantPayment.delete({ where: { id: original.id } })).rejects.toThrow()

    expect(await prisma.tenantPayment.count({ where: { tenantId: TENANT } })).toBe(2)
  })

  it('keeps the reversal linked after a refused delete, so the money stays cancelled', async () => {
    const original = await record(4_500_000n)
    await repository.reverse({
      paymentId: original.id,
      reason: 'not received',
      recordedByOperatorId: 'operator-1',
    })

    await expect(prisma.tenantPayment.delete({ where: { id: original.id } })).rejects.toThrow()

    // The defect this guards: with ON DELETE SET NULL the link would be nulled,
    // the reversal row would satisfy NOT_REVERSED, and the cancelled amount
    // would silently count again.
    const reversal = await prisma.tenantPayment.findFirstOrThrow({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })

    expect(reversal.reversalOfPaymentId).toBe(original.id)
    expect(await repository.paidThroughByTenant(TENANT)).toBeNull()
  })

  it('still allows deleting a payment that was never reversed', async () => {
    // The constraint must protect the ledger without freezing rows that carry
    // no reversal — test fixtures and teardown depend on this.
    const orphan = await record(1_000_000n)

    await prisma.tenantPayment.delete({ where: { id: orphan.id } })

    expect(await prisma.tenantPayment.count({ where: { tenantId: TENANT } })).toBe(0)
  })
})
