import { Body, Controller, HttpCode, Param, Patch, Req, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard, type AuthenticatedRequest } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { StepUpGuard, StepUpStatusTargets } from '../auth/guards/step-up.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformTenantRepository } from '../platform-data/platform-tenant.repository'
import { PLAN_CATALOG } from '../platform-plans/plan-catalog'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformControlClient } from './platform-control.client'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantStatusDto } from './dto/set-tenant-status.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantLimitsDto } from './dto/set-tenant-limits.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { SetTenantPlanDto } from './dto/set-tenant-plan.dto'

/**
 * PlatformControlController (viewpro-api) — operator-facing control-lane endpoints.
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie) and
 * PlatformPermissionGuard (D4 — operator-platform-roles). Class-level guard
 * order is AuthGuard(401) → PlatformPermissionGuard(403 PERMISSION_DENIED) →
 * method-level StepUpGuard(403 STEP_UP_REQUIRED) on both destructive PATCHes.
 * Generates a fresh idempotencyKey per request and delegates to PlatformControlClient,
 * which mints a short-lived HS256 service token and forwards to InmoView's internal
 * control-lane endpoints.
 */
@Controller('operators/tenants')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class PlatformControlController {
  constructor(
    private readonly client: PlatformControlClient,
    private readonly tenantRepo: PlatformTenantRepository,
  ) {}

  /**
   * PATCH /operators/tenants/:tenantId/status
   * Sets the tenant status via the platform control lane.
   */
  @Patch(':tenantId/status')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_STATUS_WRITE)
  @UseGuards(StepUpGuard)
  @StepUpStatusTargets(['SUSPENDED', 'CANCELLED'])
  async updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    const operatorId = request.user!.id
    const idempotencyKey = crypto.randomUUID()
    return this.client.postTenantStatus(tenantId, { targetStatus: body.status }, idempotencyKey, operatorId)
  }

  /**
   * PATCH /operators/tenants/:tenantId/limits
   * Sets the tenant limits via the platform control lane.
   */
  @Patch(':tenantId/limits')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE)
  @UseGuards(StepUpGuard)
  async updateTenantLimits(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantLimitsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    const operatorId = request.user!.id
    const idempotencyKey = crypto.randomUUID()
    return this.client.postTenantLimits(
      tenantId,
      {
        maxUsers: body.maxUsers,
        maxActivePropertyEngagements: body.maxActivePropertyEngagements,
        maxDocumentsStorageMb: body.maxDocumentsStorageMb,
      },
      idempotencyKey,
      operatorId,
    )
  }

  /**
   * PATCH /operators/tenants/:tenantId/plan
   *
   * platform-manual-plans (Slice 4, Part 2) — assign-plan (D6/D7/D8): resolves
   * the tier's preset limits from PLAN_CATALOG, pushes them through the
   * EXISTING limits control lane (idempotent via platform_command_log — no
   * parallel path), and ONLY on success writes the `plan` label ViewPro-side.
   * Reuses TENANT_LIMITS_WRITE (D8, no new permission) and the same guard
   * stack as .../limits.
   *
   * Ordering (D7): limits-push first, plan-write second. A lane failure
   * propagates as an HttpException with no plan write (enforced limits
   * unaffected, fully retryable). A successful lane result — including
   * `unchanged: true` — always writes the plan.
   */
  @Patch(':tenantId/plan')
  @HttpCode(200)
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.TENANT_LIMITS_WRITE)
  @UseGuards(StepUpGuard)
  async updateTenantPlan(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantPlanDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<unknown> {
    const operatorId = request.user!.id
    const idempotencyKey = crypto.randomUUID()
    const limits = PLAN_CATALOG[body.plan]

    const result = await this.client.postTenantLimits(tenantId, limits, idempotencyKey, operatorId)
    await this.tenantRepo.setPlan(tenantId, body.plan)
    return result
  }
}
