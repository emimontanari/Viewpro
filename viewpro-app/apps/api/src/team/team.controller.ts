import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
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
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto'
import { CreateTeamInvitationUseCase } from './use-cases/create-team-invitation.use-case'
import { DeactivateTeamMemberUseCase } from './use-cases/deactivate-team-member.use-case'
import { ListTeamInvitationsUseCase } from './use-cases/list-team-invitations.use-case'
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case'
import { ResendTeamInvitationUseCase } from './use-cases/resend-team-invitation.use-case'
import { RevokeTeamInvitationUseCase } from './use-cases/revoke-team-invitation.use-case'
import { UpdateTeamMemberRoleUseCase } from './use-cases/update-team-member-role.use-case'

@Controller('team')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TeamController {
  constructor(
    @Inject(ListTeamMembersUseCase)
    private readonly listTeamMembersUseCase: ListTeamMembersUseCase,
    @Inject(CreateTeamInvitationUseCase)
    private readonly createTeamInvitationUseCase: CreateTeamInvitationUseCase,
    @Inject(ListTeamInvitationsUseCase)
    private readonly listTeamInvitationsUseCase: ListTeamInvitationsUseCase,
    @Inject(UpdateTeamMemberRoleUseCase)
    private readonly updateTeamMemberRoleUseCase: UpdateTeamMemberRoleUseCase,
    @Inject(DeactivateTeamMemberUseCase)
    private readonly deactivateTeamMemberUseCase: DeactivateTeamMemberUseCase,
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

  @Get('invitations')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  listInvitations(@CurrentTenant() tenant: TenantContext) {
    return this.listTeamInvitationsUseCase.execute(tenant)
  }

  @Patch('members/:membershipId/role')
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  updateMemberRole(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateTeamMemberRoleDto,
  ) {
    return this.updateTeamMemberRoleUseCase.execute(tenant, currentUser, membershipId, body)
  }

  @Post('members/:membershipId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  deactivateMember(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('membershipId') membershipId: string,
  ) {
    return this.deactivateTeamMemberUseCase.execute(tenant, currentUser, membershipId)
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
