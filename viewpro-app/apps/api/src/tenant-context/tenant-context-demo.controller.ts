import { Controller, Get, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from './current-tenant.decorator'
import { ApiTenantContext } from './tenant-context-api-docs.decorator'
import { TenantContext } from './tenant-context.types'
import { TenantMembershipGuard } from './tenant-membership.guard'

@Controller('tenant-context/demo')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TenantContextDemoController {
  @Get('view')
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  view(@CurrentTenant() tenant: TenantContext) {
    return { tenant }
  }

  @Get('manage-settings')
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)
  manageSettings(@CurrentTenant() tenant: TenantContext) {
    return { tenant }
  }
}
