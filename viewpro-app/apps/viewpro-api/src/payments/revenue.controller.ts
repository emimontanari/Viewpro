import { Controller, Get, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaPaymentRepository } from './prisma-payment.repository'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantBillingStatusService } from './tenant-billing-status.service'

/**
 * Attribution rule, stated in the response rather than left to the reader.
 *
 * A payment counts toward the month it was RECORDED in, not the month its
 * period covers. Those differ constantly under manual billing — an annual
 * prepayment, or August's transfer entered on September 2nd. A revenue figure
 * whose basis is unstated is the kind of number that quietly turns into a
 * business decision, so the API says which one it is.
 */
const ATTRIBUTION = 'RECORDED_AT' as const

export interface RevenueRow {
  plan: string
  currency: string
  /** String, not number — the ledger's amounts are bigint. */
  collectedMinorUnits: string
}

export interface RevenueMonth {
  /** `YYYY-MM`. */
  month: string
  currency: string
  totalMinorUnits: string
  rows: RevenueRow[]
}

export interface RevenueSummary {
  attribution: typeof ATTRIBUTION
  months: RevenueMonth[]
  /**
   * Tenants whose paid period has lapsed. Travels with revenue because it is
   * the compensating control for "warn, don't cut": nothing suspends a lapsed
   * tenant, so this number is the only thing that surfaces one.
   */
  overdueTenants: number
}

/**
 * RevenueController — what the product actually collected.
 *
 * Readable by every operator role including ANALYST: the people who cannot
 * write money are exactly the ones who need to see it to reconcile against a
 * bank statement.
 *
 * Spec: Revenue Summary.
 */
@Controller('operators/revenue')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class RevenueController {
  constructor(
    private readonly payments: PrismaPaymentRepository,
    private readonly billing: TenantBillingStatusService,
  ) {}

  @Get('summary')
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.PAYMENTS_READ)
  async summary(): Promise<RevenueSummary> {
    const [rows, overdueTenants] = await Promise.all([
      this.payments.revenueByMonth(),
      this.billing.countAllOverdue(),
    ])

    // Group by month AND currency: totalling across currencies would produce a
    // number that means nothing, so each currency keeps its own total.
    const months = new Map<string, RevenueMonth>()

    for (const row of rows) {
      const key = `${row.month}|${row.currency}`
      const existing = months.get(key)

      if (existing === undefined) {
        months.set(key, {
          month: row.month,
          currency: row.currency,
          totalMinorUnits: row.collectedMinorUnits.toString(),
          rows: [
            {
              plan: row.plan,
              currency: row.currency,
              collectedMinorUnits: row.collectedMinorUnits.toString(),
            },
          ],
        })
        continue
      }

      existing.rows.push({
        plan: row.plan,
        currency: row.currency,
        collectedMinorUnits: row.collectedMinorUnits.toString(),
      })
      existing.totalMinorUnits = (
        BigInt(existing.totalMinorUnits) + row.collectedMinorUnits
      ).toString()
    }

    return {
      attribution: ATTRIBUTION,
      overdueTenants,
      // Newest month first — the current month is the one anyone opens this for.
      months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    }
  }
}
