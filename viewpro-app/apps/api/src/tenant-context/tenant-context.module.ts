import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextDemoController } from './tenant-context-demo.controller'
import { TenantContextStore } from './tenant-context.store'
import { TenantMembershipGuard } from './tenant-membership.guard'

const testOnlyControllers = process.env.NODE_ENV === 'test' ? [TenantContextDemoController] : []

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule],
  controllers: testOnlyControllers,
  providers: [TenantMembershipGuard, TenantContextStore],
  exports: [TenantMembershipGuard, TenantContextStore],
})
export class TenantContextModule {}
