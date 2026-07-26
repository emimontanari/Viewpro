import { Inject, Injectable } from '@nestjs/common'
import { ARGENTINA_TIME_ZONE, overdueDaysElapsed, todayIn, type CalendarDate } from './billing-period'
import { CLOCK, type Clock } from './clock'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaPaymentRepository } from './prisma-payment.repository'

export interface TenantBillingStatus {
  /** Furthest covered date, or null when the tenant was never paid for. */
  readonly paidThroughAt: CalendarDate | null
  /** Days since the paid-through date, or null when not overdue. */
  readonly overdueDays: number | null
}

/**
 * TenantBillingStatusService — the billing state the console renders.
 *
 * Computed at read time from the ledger. There is no scheduled job and no
 * stored state, which means nothing has to run at midnight for a tenant to
 * appear overdue, and no stale row can survive a job that quietly stopped.
 *
 * Being overdue changes NOTHING about the tenant: not its status, not its
 * limits, not its plan. It is a badge for operators. Cutting access remains a
 * deliberate human action behind step-up — a payment entered two days late
 * must never lock out a customer who actually paid.
 *
 * Spec: Overdue Is Derived and Never Restricts Access.
 */
@Injectable()
export class TenantBillingStatusService {
  constructor(
    private readonly payments: PrismaPaymentRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Resolve billing status for many tenants in one query.
   *
   * Batched deliberately: the tenant list renders up to 200 rows, and a
   * per-row lookup would turn one page into 200 round trips.
   */
  async forTenants(tenantIds: readonly string[]): Promise<Map<string, TenantBillingStatus>> {
    const status = new Map<string, TenantBillingStatus>()

    if (tenantIds.length === 0) {
      return status
    }

    const paidThrough = await this.payments.paidThroughByTenants(tenantIds)
    const today = todayIn(ARGENTINA_TIME_ZONE, this.clock.now())

    for (const tenantId of tenantIds) {
      const paidThroughAt = paidThrough.get(tenantId) ?? null

      status.set(tenantId, {
        paidThroughAt,
        overdueDays: overdueDaysElapsed(paidThroughAt, today),
      })
    }

    return status
  }

  async forTenant(tenantId: string): Promise<TenantBillingStatus> {
    const status = await this.forTenants([tenantId])

    return status.get(tenantId) ?? { paidThroughAt: null, overdueDays: null }
  }
}
