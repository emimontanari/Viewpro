import { Controller, Get, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { TenantRegistryService } from './tenant-registry.service'
import type { TenantRegistryList } from './tenant-registry.service'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 50

/**
 * TenantRegistryController — operator-facing tenant list (A10/A11).
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie).
 * Serves data EXCLUSIVELY from `platform_tenants` — never from InmoView.
 */
@Controller('operators/tenants')
@UseGuards(AuthGuard)
export class TenantRegistryController {
  constructor(private readonly tenantRegistryService: TenantRegistryService) {}

  /**
   * GET /operators/tenants?offset=<n>&limit=<n>
   *
   * Returns `{ total, items }` sorted by name ASC. Defaults: offset=0,
   * limit=50 (capped at 200 — A11).
   */
  @Get()
  async list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<TenantRegistryList> {
    const parsedOffset = offset !== undefined ? Number(offset) : DEFAULT_OFFSET
    const parsedLimit = limit !== undefined ? Number(limit) : DEFAULT_LIMIT

    return this.tenantRegistryService.listTenants(parsedOffset, parsedLimit)
  }
}
