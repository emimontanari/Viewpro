import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard, type AuthenticatedRequest } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminReadModelsService } from './admin-read-models.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantLimitsService } from './admin-tenant-limits.service'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AdminTenantStatusService } from './admin-tenant-status.service'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { ListAdminActivityQuery } from './dto/list-admin-activity.query'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { ListAdminTenantsQuery } from './dto/list-admin-tenants.query'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateAdminTenantLimitsDto } from './dto/update-admin-tenant-limits.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateAdminTenantStatusDto } from './dto/update-admin-tenant-status.dto'
import { GlobalAdminGuard } from './guards/global-admin.guard'
import { createAdminAccessCheckResponse, type AdminAccessCheckResponse } from './responses/admin-access-check.response'
import type {
  AdminActivityListResponse,
  AdminSummaryResponse,
  AdminTenantsResponse,
} from './responses/admin-read-models.response'
import type { AdminTenantLimitsUpdateResponse } from './responses/admin-tenant-limits.response'
import type { AdminTenantStatusUpdateResponse } from './responses/admin-tenant-status.response'

@Controller('admin')
@UseGuards(AuthGuard, GlobalAdminGuard)
export class AdminController {
  constructor(
    private readonly adminReadModelsService: AdminReadModelsService,
    private readonly adminTenantStatusService: AdminTenantStatusService,
    private readonly adminTenantLimitsService: AdminTenantLimitsService,
  ) {}

  @Get('access-check')
  accessCheck(): AdminAccessCheckResponse {
    return createAdminAccessCheckResponse()
  }

  @Get('summary')
  summary(): Promise<AdminSummaryResponse> {
    return this.adminReadModelsService.getSummary()
  }

  @Get('tenants')
  tenants(@Query() query: ListAdminTenantsQuery): Promise<AdminTenantsResponse> {
    return this.adminReadModelsService.listTenants({ page: query.page, pageSize: query.pageSize, status: query.status })
  }

  @Patch('tenants/:tenantId/status')
  updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateAdminTenantStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminTenantStatusUpdateResponse> {
    return this.adminTenantStatusService.updateTenantStatus({
      tenantId,
      targetStatus: body.status,
      actor: { type: 'user', userId: request.user!.id },
    })
  }

  @Patch('tenants/:tenantId/limits')
  updateTenantLimits(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateAdminTenantLimitsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminTenantLimitsUpdateResponse> {
    return this.adminTenantLimitsService.updateTenantLimits({
      tenantId,
      limits: body,
      actor: { type: 'user', userId: request.user!.id },
    })
  }

  @Get('activity')
  activity(@Query() query: ListAdminActivityQuery): Promise<AdminActivityListResponse> {
    return this.adminReadModelsService.listActivity({ page: query.page, pageSize: query.pageSize, tenantId: query.tenantId })
  }
}
