import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthGuard } from '../auth/guards/auth.guard'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequireAnyPermission, RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { ListActivityFeedQuery } from './dto/list-activity-feed.query'
import { ListAnalyticsEventsQuery } from './dto/list-analytics-events.query'
import { ListInactiveEngagementsQuery } from './dto/list-inactive-engagements.query'
import { GetPilotSummaryUseCase } from './use-cases/get-pilot-summary.use-case'
import { ListActivityFeedUseCase } from './use-cases/list-activity-feed.use-case'
import { ListAnalyticsEventsUseCase } from './use-cases/list-analytics-events.use-case'
import { ListInactiveEngagementsUseCase } from './use-cases/list-inactive-engagements.use-case'

// Keep query classes as runtime values for Nest ValidationPipe metadata.
const nestQueryRuntimeTypes = [ListActivityFeedQuery, ListAnalyticsEventsQuery, ListInactiveEngagementsQuery]
void nestQueryRuntimeTypes

@Controller('analytics')
@ApiTags('Analytics')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class AnalyticsController {
  constructor(
    @Inject(GetPilotSummaryUseCase)
    private readonly getPilotSummaryUseCase: GetPilotSummaryUseCase,
    @Inject(ListInactiveEngagementsUseCase)
    private readonly listInactiveEngagementsUseCase: ListInactiveEngagementsUseCase,
    @Inject(ListAnalyticsEventsUseCase)
    private readonly listAnalyticsEventsUseCase: ListAnalyticsEventsUseCase,
    @Inject(ListActivityFeedUseCase)
    private readonly listActivityFeedUseCase: ListActivityFeedUseCase,
  ) {}

  @Get('pilot-summary')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'Get weekly pilot analytics summary for the current tenant' })
  pilotSummary(@CurrentTenant() tenant: TenantContext) {
    return this.getPilotSummaryUseCase.execute({ tenantId: tenant.tenantId })
  }

  @Get('inactive-engagements')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'List active tenant engagements without a recent owner-visible update' })
  inactiveEngagements(@CurrentTenant() tenant: TenantContext, @Query() query: ListInactiveEngagementsQuery) {
    return this.listInactiveEngagementsUseCase.execute({
      tenantId: tenant.tenantId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    })
  }

  @Get('activity-feed')
  @RequireAnyPermission(PERMISSIONS.ENGAGEMENTS_VIEW_ALL, PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)
  @ApiOperation({ summary: 'List cross-property movement activity for the current tenant' })
  activityFeed(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListActivityFeedQuery,
  ) {
    return this.listActivityFeedUseCase.execute(tenant, currentUser, query)
  }

  @Get('events')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
  @ApiOperation({ summary: 'List paginated tenant analytics events for audit and pilot review' })
  events(@CurrentTenant() tenant: TenantContext, @Query() query: ListAnalyticsEventsQuery) {
    return this.listAnalyticsEventsUseCase.execute({
      tenantId: tenant.tenantId,
      page: query.page,
      pageSize: query.pageSize,
      eventName: query.eventName,
    })
  }
}
