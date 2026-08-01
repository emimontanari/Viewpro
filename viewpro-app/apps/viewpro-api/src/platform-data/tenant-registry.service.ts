import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantBillingStatusService, type TenantBillingStatus } from '../payments/tenant-billing-status.service'
import type { PlatformTenantRegistryLimits } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

export type TenantRegistryItem = {
  id: string
  name: string
  slug: string
  status: string
  limits: PlatformTenantRegistryLimits
  trialEndsAt: string | null
  // platform-manual-plans (Slice 4, Part 2) — command-written label (D4).
  // Never a known-tier-only union here: the column is a raw string,
  // narrowed to PlanCode only at the FE edge (mirrors `status`'s pattern).
  plan: string | null
  /**
   * platform-payment-ledger — derived from the money ledger on every read.
   * Present on every row, including tenants nobody ever charged (both fields
   * null), so the console never has to distinguish "absent" from "unpaid".
   */
  billing: TenantBillingStatus
}

export type TenantRegistryList = {
  total: number
  items: TenantRegistryItem[]
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * TenantRegistryService — paginated read of the operator tenant list (A10/A11).
 *
 * Reads EXCLUSIVELY from `platform_tenants` via PrismaService
 * (@prisma-platform/client) — never touches InmoView's database.
 */
@Injectable()
export class TenantRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: TenantBillingStatusService,
  ) {}

  /**
   * List tenants sorted by name ASC, paginated by offset/limit.
   *
   * A11: `limit` is capped at 200 regardless of the requested value.
   */
  async listTenants(offset = 0, limit: number = DEFAULT_LIMIT): Promise<TenantRegistryList> {
    const cappedLimit = Math.min(limit, MAX_LIMIT)

    const [total, rows] = await Promise.all([
      this.prisma.platformTenant.count(),
      this.prisma.platformTenant.findMany({
        skip: offset,
        take: cappedLimit,
        orderBy: { name: 'asc' },
      }),
    ])

    // One batched read for the whole page — never per row.
    const billing = await this.billing.forTenants(rows.map((row) => row.id))

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.latestStatus,
        limits: {
          maxUsers: row.maxUsers,
          maxActivePropertyEngagements: row.maxActivePropertyEngagements,
          maxDocumentsStorageMb: row.maxDocumentsStorageMb,
        },
        trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
        plan: row.plan,
        billing: billing.get(row.id) ?? { paidThroughAt: null, overdueDays: null },
      })),
    }
  }
}
