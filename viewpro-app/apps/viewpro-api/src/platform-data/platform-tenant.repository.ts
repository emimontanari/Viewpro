import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type {
  TenantRegisteredPayload,
  TenantStatusChangedPayload,
} from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * PlatformTenantRepository — persists the `platform_tenants` registry
 * projection (Phase 7 slice 2A).
 *
 * Every write is an idempotent upsert keyed on `id` (spec invariant).
 *
 * Isolation: uses only PrismaService (@prisma-platform/client) — never the
 * InmoView client.
 */
@Injectable()
export class PlatformTenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A8: TENANT_REGISTERED → upsert full identity + limits.
   * Re-delivery of the same event is idempotent (upsert on id).
   */
  async upsertFromRegistered(payload: TenantRegisteredPayload): Promise<void> {
    const { id, name, slug, newStatus, limits } = payload

    await this.prisma.platformTenant.upsert({
      where: { id },
      create: {
        id,
        name,
        slug,
        latestStatus: newStatus,
        maxUsers: limits.maxUsers,
        maxActivePropertyEngagements: limits.maxActivePropertyEngagements,
        maxDocumentsStorageMb: limits.maxDocumentsStorageMb,
      },
      update: {
        name,
        slug,
        latestStatus: newStatus,
        maxUsers: limits.maxUsers,
        maxActivePropertyEngagements: limits.maxActivePropertyEngagements,
        maxDocumentsStorageMb: limits.maxDocumentsStorageMb,
      },
    })
  }

  /**
   * A9: TENANT_STATUS_CHANGED → update latestStatus (+ name/slug when present).
   * Create-if-missing: a status change may arrive before the tenant's
   * TENANT_REGISTERED row exists (deploy/backfill window) — the row is
   * created with id + latestStatus so no tenant is lost.
   */
  async upsertFromStatusChange(
    tenantId: string,
    payload: TenantStatusChangedPayload,
  ): Promise<void> {
    await this.prisma.platformTenant.upsert({
      where: { id: tenantId },
      create: {
        id: tenantId,
        name: payload.name ?? '',
        slug: payload.slug ?? '',
        latestStatus: payload.newStatus,
      },
      update: {
        latestStatus: payload.newStatus,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      },
    })
  }
}
