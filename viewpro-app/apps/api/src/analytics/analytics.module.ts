import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsCoreModule } from './analytics-core.module'
import { GetPilotSummaryUseCase } from './use-cases/get-pilot-summary.use-case'
import { ListAnalyticsEventsUseCase } from './use-cases/list-analytics-events.use-case'
import { ListInactiveEngagementsUseCase } from './use-cases/list-inactive-engagements.use-case'

@Module({
  imports: [AnalyticsCoreModule, AuthModule, MembershipsModule, PermissionsModule, TenantContextModule],
  controllers: [AnalyticsController],
  providers: [
    GetPilotSummaryUseCase,
    ListAnalyticsEventsUseCase,
    ListInactiveEngagementsUseCase,
  ],
  exports: [AnalyticsCoreModule],
})
export class AnalyticsModule {}
