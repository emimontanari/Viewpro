import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
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
  constructor(private readonly prisma: PrismaService) {}

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
      })),
    }
  }
}
