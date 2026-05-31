import { Controller, Get, Inject, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case'

@Controller('team')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TeamController {
  constructor(
    @Inject(ListTeamMembersUseCase)
    private readonly listTeamMembersUseCase: ListTeamMembersUseCase,
  ) {}

  @Get('members')
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  listMembers(@CurrentTenant() tenant: TenantContext) {
    return this.listTeamMembersUseCase.execute(tenant)
  }
}
