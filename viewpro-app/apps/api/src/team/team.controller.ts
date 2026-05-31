import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto'
import { CreateTeamInvitationUseCase } from './use-cases/create-team-invitation.use-case'
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case'
import { ResendTeamInvitationUseCase } from './use-cases/resend-team-invitation.use-case'
import { RevokeTeamInvitationUseCase } from './use-cases/revoke-team-invitation.use-case'

@Controller('team')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TeamController {
  constructor(
    @Inject(ListTeamMembersUseCase)
    private readonly listTeamMembersUseCase: ListTeamMembersUseCase,
    @Inject(CreateTeamInvitationUseCase)
    private readonly createTeamInvitationUseCase: CreateTeamInvitationUseCase,
    @Inject(ResendTeamInvitationUseCase)
    private readonly resendTeamInvitationUseCase: ResendTeamInvitationUseCase,
    @Inject(RevokeTeamInvitationUseCase)
    private readonly revokeTeamInvitationUseCase: RevokeTeamInvitationUseCase,
  ) {}

  @Get('members')
  @RequirePermissions(PERMISSIONS.TEAM_VIEW)
  listMembers(@CurrentTenant() tenant: TenantContext) {
    return this.listTeamMembersUseCase.execute(tenant)
  }

  @Post('invitations')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  createInvitation(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateTeamInvitationDto,
  ) {
    return this.createTeamInvitationUseCase.execute(tenant, currentUser, body)
  }

  @Post('invitations/:id/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  resendInvitation(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.resendTeamInvitationUseCase.execute(tenant, currentUser, id)
  }

  @Post('invitations/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  revokeInvitation(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.revokeTeamInvitationUseCase.execute(tenant, id)
  }
}
