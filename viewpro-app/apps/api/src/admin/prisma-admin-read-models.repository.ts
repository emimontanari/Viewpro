import { Inject, Injectable } from '@nestjs/common'
import { PropertyEngagementStatus, TenantStatus } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  AdminActivityRecord,
  AdminReadModelsRepository,
  AdminSummaryRecord,
  ListAdminActivityInput,
  ListAdminActivityResult,
  ListAdminTenantsInput,
  ListAdminTenantsResult,
} from './admin-read-models.repository'

const INACTIVE_ENGAGEMENT_STATUSES = [PropertyEngagementStatus.CLOSED, PropertyEngagementStatus.CANCELLED]

@Injectable()
export class PrismaAdminReadModelsRepository implements AdminReadModelsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(input: { recentActivityFrom: Date }): Promise<AdminSummaryRecord> {
    const [tenants, activeTenants, users, activeEngagements, documentRequests, analyticsEvents, recentActivityCount] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
        this.prisma.user.count(),
        this.prisma.propertyEngagement.count({ where: { status: { notIn: INACTIVE_ENGAGEMENT_STATUSES } } }),
        this.prisma.documentRequest.count(),
        this.prisma.analyticsEvent.count(),
        this.prisma.analyticsEvent.count({ where: { occurredAt: { gte: input.recentActivityFrom } } }),
      ])

    return {
      totals: {
        tenants,
        activeTenants,
        users,
        activeEngagements,
        documentRequests,
        analyticsEvents,
      },
      recentActivityCount,
    }
  }

  async listTenants(input: ListAdminTenantsInput): Promise<ListAdminTenantsResult> {
    const where = input.status ? { status: input.status } : undefined
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          maxUsers: true,
          maxActivePropertyEngagements: true,
          maxDocumentsStorageMb: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              memberships: true,
              propertyEngagements: true,
              documentRequests: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ])
    const tenantIds = items.map((item) => item.id)

    if (tenantIds.length === 0) {
      return {
        total,
        items,
        propertyAssetCounts: new Map(),
        analyticsEventCounts: new Map(),
        lastActivityAtByTenant: new Map(),
      }
    }

    const [propertyAssetRows, analyticsEventRows, lastActivityRows] = await Promise.all([
      this.prisma.propertyEngagement.groupBy({
        by: ['tenantId', 'propertyAssetId'],
        where: { tenantId: { in: tenantIds } },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds } },
        _max: { occurredAt: true },
      }),
    ])

    const propertyAssetSets = new Map<string, Set<string>>()
    for (const row of propertyAssetRows) {
      const set = propertyAssetSets.get(row.tenantId) ?? new Set<string>()
      set.add(row.propertyAssetId)
      propertyAssetSets.set(row.tenantId, set)
    }

    return {
      total,
      items,
      propertyAssetCounts: new Map(Array.from(propertyAssetSets).map(([tenantId, assetIds]) => [tenantId, assetIds.size])),
      analyticsEventCounts: new Map(
        analyticsEventRows.flatMap((row) => (row.tenantId ? [[row.tenantId, row._count._all]] : [])),
      ),
      lastActivityAtByTenant: new Map(
        lastActivityRows.flatMap((row) => (row.tenantId && row._max.occurredAt ? [[row.tenantId, row._max.occurredAt]] : [])),
      ),
    }
  }

  async listActivity(input: ListAdminActivityInput): Promise<ListAdminActivityResult> {
    const where = input.tenantId ? { tenantId: input.tenantId } : undefined
    const [items, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          actorType: true,
          eventName: true,
          propertyEngagementId: true,
          propertyAssetId: true,
          documentRequestId: true,
          movementId: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.analyticsEvent.count({ where }),
    ])

    return { total, items: items satisfies AdminActivityRecord[] }
  }
}
