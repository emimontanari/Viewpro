import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, TenantPayment } from '@prisma-platform/client'
import { PrismaService } from '../database/prisma.service'
import { ARGENTINA_TIME_ZONE, todayIn, type CalendarDate } from './billing-period'
import type {
  LedgerTransaction,
  PaymentMethodCode,
  PaymentRepositoryPort,
  RecordPaymentInput,
  RecordedPayment,
  ReversePaymentInput,
  RevenueByMonthRow,
} from './payment-repository.port'

/**
 * platform-payment-ledger — Prisma adapter over `tenant_payments`.
 *
 * Append-only by construction: this class exposes `record` and `reverse`, and
 * neither ever issues an update, delete, or upsert against a payment row. The
 * append-only-surface spec asserts that, including by reading this file, so a
 * future `update` cannot slip in behind an innocent method name.
 *
 * Isolation: uses only PrismaService (@prisma-platform/client). Money never
 * touches the InmoView client, the control lane, or platform-contract.
 *
 * Spec: The Ledger Is Append-Only, Reversal Corrects Without Erasing,
 *   Paid-Through Date Is Derived, Revenue Summary.
 */
@Injectable()
export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordPaymentInput, tx: LedgerTransaction = this.prisma): Promise<RecordedPayment> {
    const row = await tx.tenantPayment.create({
      data: {
        tenantId: input.tenantId,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        method: input.method,
        plan: input.plan,
        periodStart: toDateOnly(input.periodStart),
        periodEnd: toDateOnly(input.periodEnd),
        receiptReference: input.receiptReference ?? null,
        note: input.note ?? null,
        recordedByOperatorId: input.recordedByOperatorId,
      },
      include: { reversedBy: { select: { id: true } } },
    })

    return toRecordedPayment(row)
  }

  /**
   * Append a reversal row pointing at `paymentId`.
   *
   * The original is never touched. Double reversal is prevented by the unique
   * constraint on `reversalOfPaymentId` — a service-level "is it reversed?"
   * check would lose to two concurrent requests and leave the ledger unable to
   * balance, so the constraint is the guard and P2002 is translated here into
   * the 409 the spec requires.
   */
  async reverse(input: ReversePaymentInput, tx: LedgerTransaction = this.prisma): Promise<RecordedPayment> {
    const original = await tx.tenantPayment.findUnique({
      where: { id: input.paymentId },
    })

    if (original === null) {
      // JUDGMENT DAY FIX: this was a 409, the same status the already-reversed
      // conflict uses, so a caller could not tell a bad id from a real state
      // conflict on an existing row. 404 = no such payment; 409 = it exists and
      // is already reversed.
      throw new NotFoundException(`Payment ${input.paymentId} does not exist`)
    }

    if (original.reversalOfPaymentId !== null) {
      throw new ConflictException('A reversal cannot itself be reversed')
    }

    try {
      const row = await tx.tenantPayment.create({
        data: {
          tenantId: original.tenantId,
          amountMinorUnits: original.amountMinorUnits,
          currency: original.currency,
          method: original.method,
          plan: original.plan,
          periodStart: original.periodStart,
          periodEnd: original.periodEnd,
          receiptReference: original.receiptReference,
          recordedByOperatorId: input.recordedByOperatorId,
          reversalOfPaymentId: original.id,
          reversalReason: input.reason,
        },
        include: { reversedBy: { select: { id: true } } },
      })

      return toRecordedPayment(row)
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(`Payment ${input.paymentId} is already reversed`)
      }

      throw error
    }
  }

  async listByTenant(tenantId: string): Promise<RecordedPayment[]> {
    const rows = await this.prisma.tenantPayment.findMany({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
      include: { reversedBy: { select: { id: true } } },
    })

    return rows.map(toRecordedPayment)
  }

  /**
   * Furthest `periodEnd` among the tenant's non-reversed payments.
   *
   * "Non-reversed" means two things at once, and both are expressed here so no
   * caller has to remember them: the row is not itself a reversal, and no
   * reversal points at it.
   */
  async paidThroughByTenant(tenantId: string): Promise<CalendarDate | null> {
    const result = await this.prisma.tenantPayment.aggregate({
      where: { tenantId, ...NOT_REVERSED },
      _max: { periodEnd: true },
    })

    const furthest = result._max.periodEnd

    return furthest === null ? null : toCalendarDate(furthest)
  }

  async paidThroughByTenants(tenantIds: readonly string[]): Promise<Map<string, CalendarDate>> {
    const paidThrough = new Map<string, CalendarDate>()

    if (tenantIds.length === 0) {
      return paidThrough
    }

    const grouped = await this.prisma.tenantPayment.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: [...tenantIds] }, ...NOT_REVERSED },
      _max: { periodEnd: true },
    })

    for (const row of grouped) {
      if (row._max.periodEnd !== null) {
        paidThrough.set(row.tenantId, toCalendarDate(row._max.periodEnd))
      }
    }

    return paidThrough
  }

  async revenueByMonth(): Promise<RevenueByMonthRow[]> {
    const rows = await this.prisma.tenantPayment.findMany({
      where: NOT_REVERSED,
      select: {
        recordedAt: true,
        plan: true,
        currency: true,
        amountMinorUnits: true,
      },
    })

    // Grouped in application code rather than SQL: the month key must be
    // derived in the ledger's fixed timezone, and pushing that into the query
    // would make the figure depend on the database session's timezone.
    //
    // JUDGMENT DAY FIX: this used to call toCalendarDate(recordedAt), which is
    // toISOString() — UTC. A payment recorded at 22:00 ART on the last day of a
    // month landed in the NEXT month's total, so one month under-reported and
    // the next over-reported. toCalendarDate is only correct for @db.Date
    // columns (which come back as midnight UTC); recordedAt is a timestamp and
    // needs a real timezone conversion.
    const totals = new Map<string, RevenueByMonthRow>()

    for (const row of rows) {
      const month = todayIn(ARGENTINA_TIME_ZONE, row.recordedAt).slice(0, 7)
      const key = `${month}|${row.plan}|${row.currency}`
      const existing = totals.get(key)

      totals.set(key, {
        month,
        plan: row.plan,
        currency: row.currency,
        collectedMinorUnits: (existing?.collectedMinorUnits ?? 0n) + row.amountMinorUnits,
      })
    }

    return [...totals.values()].sort(
      (a, b) => a.month.localeCompare(b.month) || a.plan.localeCompare(b.plan),
    )
  }
}

/**
 * A payment counts only when it is neither a reversal itself nor the target of
 * one. Declared once; every query that needs it spreads this constant.
 */
const NOT_REVERSED = {
  reversalOfPaymentId: null,
  reversedBy: { is: null },
} satisfies Prisma.TenantPaymentWhereInput

type TenantPaymentRow = TenantPayment & { reversedBy?: { id: string } | null }

function toRecordedPayment(row: TenantPaymentRow): RecordedPayment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    amountMinorUnits: row.amountMinorUnits,
    currency: row.currency,
    method: row.method as PaymentMethodCode,
    plan: row.plan,
    periodStart: toCalendarDate(row.periodStart),
    periodEnd: toCalendarDate(row.periodEnd),
    receiptReference: row.receiptReference,
    note: row.note,
    recordedByOperatorId: row.recordedByOperatorId,
    recordedAt: row.recordedAt,
    reversalOfPaymentId: row.reversalOfPaymentId,
    reversalReason: row.reversalReason,
    reversedByPaymentId: row.reversedBy?.id ?? null,
  }
}

/**
 * `@db.Date` columns come back as midnight UTC, so the date part is already
 * correct and needs no conversion.
 *
 * Do NOT use this on a timestamp column — `recordedAt` is a TIMESTAMP(3), and
 * reading it this way silently reports Argentine evening activity as the next
 * UTC day. Use `todayIn(ARGENTINA_TIME_ZONE, value)` for timestamps.
 */
function toCalendarDate(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10)
}

function toDateOnly(value: CalendarDate): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}
