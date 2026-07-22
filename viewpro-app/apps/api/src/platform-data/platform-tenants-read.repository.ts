import { Injectable } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaService } from '../database/prisma.service'
import type { PlatformTenantRegistryLimits, PlatformTenantStatus } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

export type TenantRegistryItem = {
  id: string
  name: string
  slug: string
  status: PlatformTenantStatus
  limits: PlatformTenantRegistryLimits
}

/**
 * PlatformTenantsReadRepository — read-only repository for the internal tenants endpoint.
 *
 * Returns all tenants with identity + limits for the one-time backfill seed that
 * viewpro-api calls via GET /internal/platform/tenants (A13).
 *
 * Read-only invariant: this repository NEVER mutates any row.
 *
 * // TODO: add paging if tenant count exceeds 1 000
 */
@Injectable()
export class PlatformTenantsReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TenantRegistryItem[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        maxActivePropertyEngagements: true,
        maxDocumentsStorageMb: true,
      },
    })

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status as PlatformTenantStatus,
      limits: {
        maxUsers: t.maxUsers,
        maxActivePropertyEngagements: t.maxActivePropertyEngagements,
        maxDocumentsStorageMb: t.maxDocumentsStorageMb,
      },
    }))
  }

  /**
   * Returns a single tenant by id, or `null` if it does not exist.
   *
   * Used by the internal tenant-summary route (platform-tenant-tracking, D4)
   * to produce a clean 404 for an unknown tenant id — aggregate count queries
   * on an unknown tenantId silently return 0, so they cannot detect "not found"
   * on their own.
   */
  async findById(tenantId: string): Promise<TenantRegistryItem | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        maxActivePropertyEngagements: true,
        maxDocumentsStorageMb: true,
      },
    })

    if (!tenant) {
      return null
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status as PlatformTenantStatus,
      limits: {
        maxUsers: tenant.maxUsers,
        maxActivePropertyEngagements: tenant.maxActivePropertyEngagements,
        maxDocumentsStorageMb: tenant.maxDocumentsStorageMb,
      },
    }
  }
}
