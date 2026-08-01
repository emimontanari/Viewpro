import { Injectable } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaService } from '../database/prisma.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuditLogRepository } from '../platform-data/audit-log.repository'
import { createBillingPeriod } from './billing-period'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaPaymentRepository } from './prisma-payment.repository'
import type { RecordPaymentInput, RecordedPayment, ReversePaymentInput } from './payment-repository.port'

export interface PaymentActor {
  readonly id: string
  readonly email: string
}

/**
 * PaymentsService — money mutations and the audit rows that attribute them.
 *
 * Both operations run inside a single `$transaction` that spans the ledger
 * write and the native audit append. That pairing is the point of the slice:
 * a payment row without its audit row is an activation nobody can attribute,
 * which is exactly the state that makes internal fraud undetectable. If the
 * audit append fails, the money write goes with it.
 *
 * Spec: Every Money Mutation Is Audited, Record a Payment, Reversal Corrects
 *   Without Erasing.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PrismaPaymentRepository,
    private readonly auditLog: AuditLogRepository,
  ) {}

  async record(input: RecordPaymentInput, actor: PaymentActor): Promise<RecordedPayment> {
    // Validate the period before opening a transaction: an inverted period is
    // a client error, and it must never reach the audit trail as a failed
    // attempt that looks like a database problem.
    createBillingPeriod(input.periodStart, input.periodEnd)

    return this.prisma.$transaction(async (tx) => {
      const payment = await this.payments.record(input, tx)

      await this.auditLog.appendNative(
        {
          action: 'PAYMENT_RECORDED',
          actor,
          tenantId: input.tenantId,
          target: { paymentId: payment.id },
          newValue: serializePayment(payment),
        },
        tx,
      )

      return payment
    })
  }

  async reverse(input: ReversePaymentInput, actor: PaymentActor): Promise<RecordedPayment> {
    return this.prisma.$transaction(async (tx) => {
      const reversal = await this.payments.reverse(input, tx)

      await this.auditLog.appendNative(
        {
          action: 'PAYMENT_REVERSED',
          actor,
          tenantId: reversal.tenantId,
          target: { paymentId: input.paymentId, reversalId: reversal.id },
          newValue: {
            ...serializePayment(reversal),
            reversalReason: input.reason,
          },
        },
        tx,
      )

      return reversal
    })
  }

  listByTenant(tenantId: string): Promise<RecordedPayment[]> {
    return this.payments.listByTenant(tenantId)
  }
}

/**
 * Audit payloads are JSON columns, and JSON cannot represent a bigint. The
 * amount is serialized as a string so the trail keeps the exact value rather
 * than a rounded one — the same reason it crosses the HTTP boundary as a
 * string.
 */
function serializePayment(payment: RecordedPayment): Record<string, unknown> {
  return {
    paymentId: payment.id,
    amountMinorUnits: payment.amountMinorUnits.toString(),
    currency: payment.currency,
    method: payment.method,
    plan: payment.plan,
    periodStart: payment.periodStart,
    periodEnd: payment.periodEnd,
    receiptReference: payment.receiptReference,
  }
}
