import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { AdminModule } from './admin/admin.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { DocumentsModule } from './documents/documents.module'
import { HealthModule } from './health/health.module'
import { MembershipsModule } from './memberships/memberships.module'
import { MovementsModule } from './movements/movements.module'
import { MovementOutcomeLabelsModule } from './movement-outcome-labels/movement-outcome-labels.module'
import { NotificationsModule } from './notifications/notifications.module'
import { ObservabilityModule } from './observability/observability.module'
import { OwnerInvitationsModule } from './owner-invitations/owner-invitations.module'
import { OwnerPortalModule } from './owner-portal/owner-portal.module'
import { PermissionsModule } from './permissions/permissions.module'
import { PropertyEngagementsModule } from './property-engagements/property-engagements.module'
import { TenantsModule } from './tenants/tenants.module'
import { TenantContextModule } from './tenant-context/tenant-context.module'
import { TeamModule } from './team/team.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('app.authRateLimit.login.ttlSeconds') * 1000,
          limit: configService.getOrThrow<number>('app.authRateLimit.login.limit'),
        },
      ],
    }),
    DatabaseModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    AuthModule,
    PermissionsModule,
    TenantContextModule,
    TeamModule,
    PropertyEngagementsModule,
    MovementsModule,
    MovementOutcomeLabelsModule,
    OwnerPortalModule,
    OwnerInvitationsModule,
    DocumentsModule,
    NotificationsModule,
    AnalyticsModule,
    AdminModule,
    HealthModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
