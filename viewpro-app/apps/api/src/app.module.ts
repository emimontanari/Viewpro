import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { MembershipsModule } from './memberships/memberships.module'
import { PermissionsModule } from './permissions/permissions.module'
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
    HealthModule,
  ],
})
export class AppModule {}
