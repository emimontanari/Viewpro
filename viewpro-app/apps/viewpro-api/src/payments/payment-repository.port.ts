import type { Prisma } from '@prisma-platform/client'
import type { CalendarDate } from './billing-period'

/**
 * platform-payment-ledger — the ledger's write and read surface.
 *
 * There is deliberately NO update and NO delete operation here, and there
 * never should be. Correction happens through `reverse`, which appends a row
 * linked to the original and leaves it untouched. This is not ceremony: a
 * ledger whose rows can be quietly edited is worthless as evidence when the
 * question is whether an operator activated a tenant that never paid.
 *
 * Reversal filtering is expressed once, inside the implementation. Callers
 * never restate "and not reversed" — that is exactly how such a rule ends up
 * applied in three places and forgotten in a fourth.
 *
 * Spec: The Ledger Is Append-Only, Paid-Through Date Is Derived.
 */

export type PaymentMethodCode = 'BANK_TRANSFER' | 'CASH' | 'MERCADOPAGO_LINK' | 'OTHER'

export interface RecordPaymentInput {
  readonly tenantId: string
  readonly amountMinorUnits: bigint
  readonly currency: string
  readonly method: PaymentMethodCode
  readonly plan: string
  readonly periodStart: CalendarDate
  readonly periodEnd: CalendarDate
  readonly receiptReference?: string | null
  readonly note?: string | null
  readonly recordedByOperatorId: string
}

export interface ReversePaymentInput {
  readonly paymentId: string
  readonly reason: string
  readonly recordedByOperatorId: string
}

export interface RecordedPayment {
  readonly id: string
  readonly tenantId: string
  readonly amountMinorUnits: bigint
  readonly currency: string
  readonly method: PaymentMethodCode
  readonly plan: string
  readonly periodStart: CalendarDate
  readonly periodEnd: CalendarDate
  readonly receiptReference: string | null
  readonly note: string | null
  readonly recordedByOperatorId: string
  readonly recordedAt: Date
  /** Present when this row cancels another payment. */
  readonly reversalOfPaymentId: string | null
  readonly reversalReason: string | null
  /** Resolved for display: a reversed payment is marked, never hidden. */
  readonly reversedByPaymentId: string | null
}

export interface RevenueByMonthRow {
  /** `YYYY-MM` in the ledger's fixed timezone. */
  readonly month: string
  readonly plan: string
  readonly currency: string
  readonly collectedMinorUnits: bigint
}

/**
 * Prisma transaction client, accepted by the write operations so a money
 * write and the audit row that attributes it commit or roll back together.
 * Mirrors the tx-threading `AuditLogRepository.appendNative` already uses.
 */
export type LedgerTransaction = Prisma.TransactionClient

export interface PaymentRepositoryPort {
  /** Append a payment. Never overwrites an existing row. */
  record(input: RecordPaymentInput, tx?: LedgerTransaction): Promise<RecordedPayment>

  /**
   * Append a reversal for `paymentId`. The original row is left byte-identical.
   * Rejects when the payment is already reversed — the database's unique
   * constraint is the real guard; this only surfaces it as a friendly error.
   */
  reverse(input: ReversePaymentInput, tx?: LedgerTransaction): Promise<RecordedPayment>

  /** A tenant's payments, newest first, reversed rows marked rather than hidden. */
  listByTenant(tenantId: string): Promise<RecordedPayment[]>

  /**
   * Furthest `periodEnd` among the tenant's non-reversed payments, or null.
   * Derived on every read — never stored, never allowed to drift.
   */
  paidThroughByTenant(tenantId: string): Promise<CalendarDate | null>

  /** Collected totals per month, plan and currency. Reversed payments excluded. */
  revenueByMonth(): Promise<RevenueByMonthRow[]>
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY')
