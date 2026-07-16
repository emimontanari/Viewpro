import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard, type AuthenticatedRequest } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { StepUpGuard } from '../auth/guards/step-up.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { CreateOperatorDto } from './dto/create-operator.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateRoleOperatorDto } from './dto/update-role-operator.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateStatusOperatorDto } from './dto/update-status-operator.dto'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { CreateOperatorUseCase } from './use-cases/create-operator.use-case'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ListOperatorsUseCase } from './use-cases/list-operators.use-case'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ChangeRoleOperatorUseCase } from './use-cases/change-role-operator.use-case'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ChangeStatusOperatorUseCase } from './use-cases/change-status-operator.use-case'

/**
 * OperatorsController (viewpro-api) — OWNER-only operator-roster management
 * (platform-operator-management, A4).
 *
 * Route prefix `operators/manage` — collision-free sibling of the existing
 * `operators/{tenants,metrics,audit}` controllers (Decision 4). Class-level
 * guard order: AuthGuard(401) → PlatformPermissionGuard(403 PERMISSION_DENIED,
 * OPERATORS_MANAGE — required on ALL 4 routes, including GET). Method-level
 * StepUpGuard(403 STEP_UP_REQUIRED) on POST/PATCH ONLY — unconditional (no
 * `@StepUpStatusTargets`), since step-up is required on every mutation
 * including reactivate (an intentional divergence from the tenant-status
 * pattern, per design).
 */
@Controller('operators/manage')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class OperatorsController {
  constructor(
    private readonly createOperatorUseCase: CreateOperatorUseCase,
    private readonly listOperatorsUseCase: ListOperatorsUseCase,
    private readonly changeRoleOperatorUseCase: ChangeRoleOperatorUseCase,
    private readonly changeStatusOperatorUseCase: ChangeStatusOperatorUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  @UseGuards(StepUpGuard)
  async create(@Body() dto: CreateOperatorDto, @Req() request: AuthenticatedRequest) {
    return this.createOperatorUseCase.execute(dto, request.user!)
  }

  @Get()
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  async list() {
    return this.listOperatorsUseCase.execute()
  }

  @Patch(':id/role')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  @UseGuards(StepUpGuard)
  async changeRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleOperatorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.changeRoleOperatorUseCase.execute(id, dto.role, request.user!)
  }

  @Patch(':id/status')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_MANAGE)
  @UseGuards(StepUpGuard)
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusOperatorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.changeStatusOperatorUseCase.execute(id, dto.status, request.user!)
  }
}
