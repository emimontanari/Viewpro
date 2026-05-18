import { Inject, Injectable } from '@nestjs/common'
import type { TenantStatus } from '@prisma/client'
import {
  ADMIN_READ_MODELS_REPOSITORY,
  type AdminReadModelsRepository,
} from './admin-read-models.repository'
import {
  mapAdminActivityToResponse,
  mapAdminTenantToResponse,
  type AdminActivityListResponse,
  type AdminSummaryResponse,
  type AdminTenantsResponse,
} from './responses/admin-read-models.response'

const RECENT_ACTIVITY_WINDOW_DAYS = 7
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

@Injectable()
export class AdminReadModelsService {
  constructor(
    @Inject(ADMIN_READ_MODELS_REPOSITORY) private readonly adminReadModelsRepository: AdminReadModelsRepository,
  ) {}

  async getSummary(): Promise<AdminSummaryResponse> {
    const generatedAt = new Date()
    const recentActivityFrom = new Date(generatedAt.getTime() - RECENT_ACTIVITY_WINDOW_DAYS * MILLISECONDS_PER_DAY)
    const summary = await this.adminReadModelsRepository.getSummary({ recentActivityFrom })

    return {
      totals: summary.totals,
      recentActivityCount: summary.recentActivityCount,
      generatedAt: generatedAt.toISOString(),
    }
  }

  async listTenants(input: { page: number; pageSize: number; status?: TenantStatus }): Promise<AdminTenantsResponse> {
    const result = await this.adminReadModelsRepository.listTenants(input)

    return {
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
      items: result.items.map((tenant) =>
        mapAdminTenantToResponse({
          tenant,
          propertyAssetCount: result.propertyAssetCounts.get(tenant.id) ?? 0,
          analyticsEventCount: result.analyticsEventCounts.get(tenant.id) ?? 0,
          lastActivityAt: result.lastActivityAtByTenant.get(tenant.id) ?? null,
        }),
      ),
    }
  }

  async listActivity(input: { page: number; pageSize: number; tenantId?: string }): Promise<AdminActivityListResponse> {
    const result = await this.adminReadModelsRepository.listActivity(input)

    return {
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
      items: result.items.map(mapAdminActivityToResponse),
    }
  }
}
