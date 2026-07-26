import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../../platform-data/audit-log.repository'
import { PrismaPaymentRepository } from '../prisma-payment.repository'
import { PaymentsService } from '../payments.service'
import type { RecordPaymentInput } from '../payment-repository.port'

/**
 * platform-payment-ledger (PR 2) — RED: a payment and its audit row commit or
 * roll back together.
 *
 * This is the guarantee the whole slice exists for. A payment row without its
 * audit row is an activation nobody can attribute — exactly the state that
 * makes internal fraud undetectable. So the two writes share one transaction,
 * and this suite proves the failure mode as well as the happy path.
 *
 * Spec: Every Money Mutation Is Audited.
 */
describe('PaymentsService (integration — test DB)', () => {
  let moduleRef: TestingModule
  let service: PaymentsService
  let prisma: PrismaService

  const TENANT = 'tenant-payments-service-spec'
  const ACTOR = { id: 'operator-9', email: 'ops@viewpro.local' }

  function input(overrides: Partial<RecordPaymentInput> = {}): RecordPaymentInput {
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
      recordedByOperatorId: ACTOR.id,
      ...overrides,
    }
  }

  async function auditRows(action: string) {
    return prisma.platformAuditLog.findMany({ where: { tenantId: TENANT, action } })
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [PaymentsService, PrismaPaymentRepository, AuditLogRepository],
    }).compile()

    service = moduleRef.get(PaymentsService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformAuditLog.deleteMany({ where: { tenantId: TENANT } })
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.tenantPayment.deleteMany({
      where: { tenantId: TENANT, NOT: { reversalOfPaymentId: null } },
    })
    await prisma.tenantPayment.deleteMany({ where: { tenantId: TENANT } })
    await prisma.platformAuditLog.deleteMany({ where: { tenantId: TENANT } })
  })

  it('records a payment and appends exactly one native audit row', async () => {
    await service.record(input(), ACTOR)

    const rows = await auditRows('PAYMENT_RECORDED')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.source).toBe('VIEWPRO_NATIVE')
    expect(rows[0]?.sourceEventId).toBeNull()
    expect(rows[0]?.actor).toMatchObject({ id: ACTOR.id, email: ACTOR.email })
  })

  it('carries amount, currency, method and period in the audit payload', async () => {
    await service.record(input(), ACTOR)

    const [row] = await auditRows('PAYMENT_RECORDED')

    expect(row?.newValue).toMatchObject({
      // Serialized as a string: the audit trail must survive a bigint that
      // JSON cannot represent.
      amountMinorUnits: '4500000',
      currency: 'ARS',
      method: 'BANK_TRANSFER',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
    })
  })

  it('appends its own audit row for a reversal, carrying the reason', async () => {
    const payment = await service.record(input(), ACTOR)

    await service.reverse({ paymentId: payment.id, reason: 'wrong tenant', recordedByOperatorId: ACTOR.id }, ACTOR)

    const rows = await auditRows('PAYMENT_REVERSED')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.newValue).toMatchObject({ reversalReason: 'wrong tenant' })
    expect(rows[0]?.target).toMatchObject({ paymentId: payment.id })
  })

  it('leaves neither a payment nor an audit row when the transaction fails', async () => {
    // Force the audit append to blow up mid-transaction. Without a shared
    // transaction the payment would survive on its own — unattributable, which
    // is the exact state this slice exists to prevent.
    const auditRepo = moduleRef.get(AuditLogRepository)
    const original = auditRepo.appendNative.bind(auditRepo)
    auditRepo.appendNative = async () => {
      throw new Error('audit db unavailable')
    }

    await expect(service.record(input(), ACTOR)).rejects.toThrow(/audit db unavailable/)

    auditRepo.appendNative = original

    expect(await prisma.tenantPayment.findMany({ where: { tenantId: TENANT } })).toHaveLength(0)
    expect(await auditRows('PAYMENT_RECORDED')).toHaveLength(0)
  })

  it('does not append an audit row when the payment itself is rejected', async () => {
    await expect(
      service.record(input({ periodStart: '2026-08-31', periodEnd: '2026-08-01' }), ACTOR),
    ).rejects.toThrow()

    expect(await auditRows('PAYMENT_RECORDED')).toHaveLength(0)
  })
})
