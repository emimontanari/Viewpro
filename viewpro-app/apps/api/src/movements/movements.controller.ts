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
import { CreateMovementDto } from './dto/create-movement.dto'
import { ListMovementsQuery } from './dto/list-movements.query'
import { CreateMovementUseCase } from './use-cases/create-movement.use-case'
import { ListMovementsUseCase } from './use-cases/list-movements.use-case'

@Controller('property-engagements/:propertyEngagementId/movements')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class MovementsController {
  constructor(
    private readonly createMovementUseCase: CreateMovementUseCase,
    private readonly listMovementsUseCase: ListMovementsUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MOVEMENTS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('propertyEngagementId') propertyEngagementId: string,
    @Body() body: CreateMovementDto,
  ) {
    return this.createMovementUseCase.execute(tenant, currentUser, propertyEngagementId, body)
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('propertyEngagementId') propertyEngagementId: string,
    @Query() query: ListMovementsQuery,
  ) {
    return this.listMovementsUseCase.execute(tenant, currentUser, propertyEngagementId, query)
  }
}
