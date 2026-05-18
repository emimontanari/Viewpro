import { Module } from '@nestjs/common'
import { AdminModule } from './admin/admin.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { DocumentsModule } from './documents/documents.module'
import { HealthModule } from './health/health.module'
import { MembershipsModule } from './memberships/memberships.module'
import { MovementsModule } from './movements/movements.module'
import { OwnerPortalModule } from './owner-portal/owner-portal.module'
import { PermissionsModule } from './permissions/permissions.module'
import { PropertyEngagementsModule } from './property-engagements/property-engagements.module'
import { TenantsModule } from './tenants/tenants.module'
import { TenantContextModule } from './tenant-context/tenant-context.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    AuthModule,
    PermissionsModule,
    TenantContextModule,
    PropertyEngagementsModule,
    MovementsModule,
    OwnerPortalModule,
    DocumentsModule,
    AnalyticsModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
