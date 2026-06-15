import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CreateStatusChangeRequestDto } from './dto/create-status-change-request.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { RejectStatusChangeRequestDto } from './dto/reject-status-change-request.dto'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { ListStatusChangeRequestsQuery } from './dto/list-status-change-requests.query'
import { ApproveStatusChangeRequestUseCase } from './use-cases/approve-status-change-request.use-case'
import { CreateStatusChangeRequestUseCase } from './use-cases/create-status-change-request.use-case'
import { ListEngagementStatusChangeRequestsUseCase } from './use-cases/list-engagement-status-change-requests.use-case'
import { ListTenantPendingStatusChangeRequestsUseCase } from './use-cases/list-tenant-pending-status-change-requests.use-case'
import { RejectStatusChangeRequestUseCase } from './use-cases/reject-status-change-request.use-case'

@Controller()
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class StatusChangeRequestsController {
  constructor(
    private readonly createUseCase: CreateStatusChangeRequestUseCase,
    private readonly approveUseCase: ApproveStatusChangeRequestUseCase,
    private readonly rejectUseCase: RejectStatusChangeRequestUseCase,
    private readonly listTenantPendingUseCase: ListTenantPendingStatusChangeRequestsUseCase,
    private readonly listEngagementUseCase: ListEngagementStatusChangeRequestsUseCase,
  ) {}

  /**
   * POST /property-engagements/:engagementId/status-change-requests
   * Seller (assigned) creates a status change request (FR-1, FR-3, FR-4).
   * Auth: MOVEMENTS_CREATE — sellers have this; managers do NOT hit this path (FR-4).
   * The use case further enforces PropertyAgent assignment.
   */
  @Post('property-engagements/:engagementId/status-change-requests')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.MOVEMENTS_CREATE)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('engagementId') engagementId: string,
    @Body() body: CreateStatusChangeRequestDto,
  ) {
    return this.createUseCase.execute(tenant, currentUser, engagementId, body)
  }

  /**
   * GET /property-engagements/:engagementId/status-change-requests
   * Returns all requests for the engagement (FR-8). Accessible to managers or assigned seller.
   */
  @Get('property-engagements/:engagementId/status-change-requests')
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  async listByEngagement(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('engagementId') engagementId: string,
  ) {
    return this.listEngagementUseCase.execute(tenant, currentUser, engagementId)
  }

  /**
   * GET /tenants/me/status-change-requests
   * Manager bandeja — returns all PENDING requests for the tenant (FR-9, A5).
   * Auth: ENGAGEMENTS_VIEW_ALL — sellers do not have this → 403.
   */
  @Get('tenants/me/status-change-requests')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
  async listTenantPending(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListStatusChangeRequestsQuery,
  ) {
    return this.listTenantPendingUseCase.execute(tenant, query)
  }

  /**
   * PATCH /status-change-requests/:requestId/approve
   * Manager approves a pending request (FR-11, FR-12). Atomic transaction.
   * Auth: ENGAGEMENTS_CREATE — sellers do not have this → 403.
   */
  @Patch('status-change-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.approveUseCase.execute(tenant, currentUser, requestId)
  }

  /**
   * PATCH /status-change-requests/:requestId/reject
   * Manager rejects a pending request with a required comment (FR-18).
   * Auth: ENGAGEMENTS_CREATE — sellers do not have this → 403.
   */
  @Patch('status-change-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId') requestId: string,
    @Body() body: RejectStatusChangeRequestDto,
  ) {
    return this.rejectUseCase.execute(tenant, currentUser, requestId, body)
  }
}
