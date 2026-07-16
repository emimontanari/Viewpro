import { Controller, Get, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantRegistryService } from './tenant-registry.service'
import type { TenantRegistryList } from './tenant-registry.service'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 50

/**
 * Sanitize an offset query param: default 0; must be a finite integer >= 0.
 * Malformed input (`abc` → NaN, `-1` → negative, `1.5` → non-integer) degrades
 * to the default rather than reaching Prisma `skip` and throwing a 500.
 */
function sanitizeOffset(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_OFFSET
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_OFFSET
}

/**
 * Sanitize a limit query param: default 50; must be a finite integer >= 1.
 * Malformed input degrades to the default. The 200 cap (A11) stays enforced by
 * TenantRegistryService.
 */
function sanitizeLimit(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_LIMIT
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_LIMIT
}

/**
 * TenantRegistryController — operator-facing tenant list (A10/A11).
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie) and
 * PlatformPermissionGuard (D4 — operator-platform-roles).
 * Serves data EXCLUSIVELY from `platform_tenants` — never from InmoView.
 */
@Controller('operators/tenants')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class TenantRegistryController {
  constructor(private readonly tenantRegistryService: TenantRegistryService) {}

  /**
   * GET /operators/tenants?offset=<n>&limit=<n>
   *
   * Returns `{ total, items }` sorted by name ASC. Defaults: offset=0,
   * limit=50 (capped at 200 — A11).
   */
  @Get()
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANTS_READ)
  async list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<TenantRegistryList> {
    return this.tenantRegistryService.listTenants(sanitizeOffset(offset), sanitizeLimit(limit))
  }
}
