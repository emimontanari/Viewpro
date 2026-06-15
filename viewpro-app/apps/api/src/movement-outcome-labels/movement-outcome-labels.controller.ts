import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
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
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { CreateLabelDto } from './dto/create-label.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { ListLabelsQuery } from './dto/list-labels.query'
import { mapMovementOutcomeLabel } from './responses/movement-outcome-label.response'
import { CreateLabelUseCase } from './use-cases/create-label.use-case'
import { DeleteLabelUseCase } from './use-cases/delete-label.use-case'
import { ListLabelsUseCase } from './use-cases/list-labels.use-case'

@Controller('tenants/me/movement-outcome-labels')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class MovementOutcomeLabelsController {
  constructor(
    private readonly createLabelUseCase: CreateLabelUseCase,
    private readonly listLabelsUseCase: ListLabelsUseCase,
    private readonly deleteLabelUseCase: DeleteLabelUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.MOVEMENTS_OUTCOME_LABELS_MANAGE)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateLabelDto,
  ) {
    const label = await this.createLabelUseCase.execute(tenant, currentUser, body)
    return mapMovementOutcomeLabel(label)
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  async list(@CurrentTenant() tenant: TenantContext, @Query() query: ListLabelsQuery) {
    const labels = await this.listLabelsUseCase.execute(tenant, query)
    return labels.map(mapMovementOutcomeLabel)
  }

  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.MOVEMENTS_OUTCOME_LABELS_MANAGE)
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('labelId') labelId: string,
  ) {
    await this.deleteLabelUseCase.execute(tenant, currentUser, labelId)
  }
}
