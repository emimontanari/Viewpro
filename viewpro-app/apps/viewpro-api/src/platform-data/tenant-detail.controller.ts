import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantDetailService } from './tenant-detail.service'
import type { PlatformTenantSummaryResponse } from './change-feed.client'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 20

/**
 * Sanitize an offset query param: default 0; must be a finite integer >= 0.
 * Mirrors TenantRegistryController's sanitizeOffset — malformed input
 * degrades to the default rather than forwarding NaN/negative to InmoView.
 */
function sanitizeOffset(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_OFFSET
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_OFFSET
}

/**
 * Sanitize a limit query param: default 20 (matches
 * GetPlatformTenantActivityUseCase's own default on the InmoView side);
 * must be a finite integer >= 1.
 */
function sanitizeLimit(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_LIMIT
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_LIMIT
}

/**
 * TenantDetailController — operator-facing single-tenant summary (D8).
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie) and
 * PlatformPermissionGuard (D4 — operator-platform-roles), requiring
 * PLATFORM_TENANTS_READ — same permission as the tenant list.
 *
 * On-demand passthrough: calls InmoView on every request via
 * `TenantDetailService` -> `ChangeFeedClient.fetchTenantSummary`. Never
 * reads from or writes to any ViewPro table (no new DB projection).
 */
@Controller('operators/tenants')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class TenantDetailController {
  constructor(private readonly tenantDetailService: TenantDetailService) {}

  /**
   * GET /operators/tenants/:id/summary?offset=<n>&limit=<n>
   */
  @Get(':id/summary')
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANTS_READ)
  async summary(
    @Param('id') id: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<PlatformTenantSummaryResponse> {
    return this.tenantDetailService.getTenantSummary(id, sanitizeOffset(offset), sanitizeLimit(limit))
  }
}
