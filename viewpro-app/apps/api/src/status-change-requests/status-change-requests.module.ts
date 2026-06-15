import { Module } from '@nestjs/common'
import { AnalyticsCoreModule } from '../analytics/analytics-core.module'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { MovementsModule } from '../movements/movements.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { PropertyEngagementsModule } from '../property-engagements/property-engagements.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { PrismaStatusChangeRequestsRepository } from './prisma-status-change-requests.repository'
import { StatusChangeRequestsController } from './status-change-requests.controller'
import { STATUS_CHANGE_REQUESTS_REPOSITORY } from './status-change-requests.repository'
import { ApproveStatusChangeRequestUseCase } from './use-cases/approve-status-change-request.use-case'
import { CreateStatusChangeRequestUseCase } from './use-cases/create-status-change-request.use-case'
import { ListEngagementStatusChangeRequestsUseCase } from './use-cases/list-engagement-status-change-requests.use-case'
import { ListTenantPendingStatusChangeRequestsUseCase } from './use-cases/list-tenant-pending-status-change-requests.use-case'
import { RejectStatusChangeRequestUseCase } from './use-cases/reject-status-change-request.use-case'

const statusChangeRequestUseCases = [
  CreateStatusChangeRequestUseCase,
  ApproveStatusChangeRequestUseCase,
  RejectStatusChangeRequestUseCase,
  ListTenantPendingStatusChangeRequestsUseCase,
  ListEngagementStatusChangeRequestsUseCase,
]

@Module({
  imports: [
    AnalyticsCoreModule,
    AuthModule,
    MembershipsModule,
    MovementsModule,
    NotificationsModule,
    PermissionsModule,
    PropertyEngagementsModule,
    TenantContextModule,
  ],
  controllers: [StatusChangeRequestsController],
  providers: [
    {
      provide: STATUS_CHANGE_REQUESTS_REPOSITORY,
      useClass: PrismaStatusChangeRequestsRepository,
    },
    ...statusChangeRequestUseCases,
  ],
  exports: [STATUS_CHANGE_REQUESTS_REPOSITORY, ...statusChangeRequestUseCases],
})
export class StatusChangeRequestsModule {}
