import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { AssignPropertyAgentDto } from './dto/assign-property-agent.dto'
import { CreatePropertyEngagementDto } from './dto/create-property-engagement.dto'
import { ListPropertyEngagementsQuery } from './dto/list-property-engagements.query'
import { AssignPropertyAgentUseCase } from './use-cases/assign-property-agent.use-case'
import { CreatePropertyEngagementUseCase } from './use-cases/create-property-engagement.use-case'
import { GetPropertyEngagementUseCase } from './use-cases/get-property-engagement.use-case'
import { ListPropertyEngagementsUseCase } from './use-cases/list-property-engagements.use-case'

@Controller('property-engagements')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class PropertyEngagementsController {
  constructor(
    private readonly createPropertyEngagementUseCase: CreatePropertyEngagementUseCase,
    private readonly listPropertyEngagementsUseCase: ListPropertyEngagementsUseCase,
    private readonly getPropertyEngagementUseCase: GetPropertyEngagementUseCase,
    private readonly assignPropertyAgentUseCase: AssignPropertyAgentUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreatePropertyEngagementDto,
  ) {
    return this.createPropertyEngagementUseCase.execute(tenant, currentUser, body)
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListPropertyEngagementsQuery,
  ) {
    return this.listPropertyEngagementsUseCase.execute(tenant, currentUser, query)
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.getPropertyEngagementUseCase.execute(tenant, currentUser, id)
  }

  @Post(':id/agents')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  assignAgent(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: AssignPropertyAgentDto,
  ) {
    return this.assignPropertyAgentUseCase.execute(tenant, currentUser, id, body)
  }
}
