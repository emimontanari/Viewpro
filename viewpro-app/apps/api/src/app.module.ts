import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { MembershipsModule } from './memberships/memberships.module'
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
    HealthModule,
  ],
})
export class AppModule {}
