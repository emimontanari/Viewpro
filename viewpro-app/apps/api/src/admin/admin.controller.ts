import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { AdminReadModelsService } from './admin-read-models.service'
import { ListAdminActivityQuery } from './dto/list-admin-activity.query'
import { ListAdminTenantsQuery } from './dto/list-admin-tenants.query'
import { GlobalAdminGuard } from './guards/global-admin.guard'
import { createAdminAccessCheckResponse, type AdminAccessCheckResponse } from './responses/admin-access-check.response'
import type {
  AdminActivityListResponse,
  AdminSummaryResponse,
  AdminTenantsResponse,
} from './responses/admin-read-models.response'

@Controller('admin')
@UseGuards(AuthGuard, GlobalAdminGuard)
export class AdminController {
  constructor(private readonly adminReadModelsService: AdminReadModelsService) {}

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

  @Get('activity')
  activity(@Query() query: ListAdminActivityQuery): Promise<AdminActivityListResponse> {
    return this.adminReadModelsService.listActivity({ page: query.page, pageSize: query.pageSize, tenantId: query.tenantId })
  }
}
