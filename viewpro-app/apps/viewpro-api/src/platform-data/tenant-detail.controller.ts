import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard, type AuthenticatedRequest } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantDetailService } from './tenant-detail.service'
import type { PlatformDocumentReadUrlResponse, PlatformTenantSummaryResponse } from './change-feed.client'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 20
// Hard ceiling on the forwarded activity page size — mirrors the InmoView
// route's MAX_SUMMARY_ACTIVITY_LIMIT so the DoS cap holds on this passthrough
// too (defense in depth), even if the InmoView route were bypassed.
const MAX_LIMIT = 100

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
 * clamped to [1, MAX_LIMIT]. Malformed input degrades to the default; an
 * over-max value degrades to the cap.
 */
function sanitizeLimit(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_LIMIT
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(parsed), MAX_LIMIT)
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

  /**
   * GET /operators/tenants/:tenantId/document-versions/:versionId/read-url
   *
   * operator-activity-media (Slice 2a, D4/D5/D6/D7). Gated by a DISTINCT
   * permission (`TENANT_DOCUMENTS_READ`, not `TENANTS_READ`) — declared in
   * `platform-permissions.constants.ts` but NOT YET seeded into any role
   * (Slice 2b seeds it: OWNER inherits, ANALYST excluded). Until then this
   * route is unreachable by any real operator role; 2a's tests mock/override
   * `PlatformPermissionGuard` to exercise the handler logic in isolation.
   */
  @Get(':tenantId/document-versions/:versionId/read-url')
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_DOCUMENTS_READ)
  async documentReadUrl(
    @Param('tenantId') tenantId: string,
    @Param('versionId') versionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PlatformDocumentReadUrlResponse> {
    return this.tenantDetailService.getDocumentReadUrl(tenantId, versionId, request.user!)
  }
}
