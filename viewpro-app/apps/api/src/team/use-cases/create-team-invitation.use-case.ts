import { ConflictException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateTeamInvitationDto } from '../dto/create-team-invitation.dto'
import {
  toTeamInvitationLinkResponse,
  type TeamInvitationLinkResponse,
} from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import {
  buildTeamInvitationUrl,
  ensureSupportedInvitationRole,
  ensureTeamManagePermission,
} from './team-invitation-use-case-helpers'

@Injectable()
export class CreateTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    dto: CreateTeamInvitationDto,
  ): Promise<TeamInvitationLinkResponse> {
    ensureTeamManagePermission(tenant)
    ensureSupportedInvitationRole(dto.role)

    const result = await this.teamInvitationsRepository.createPendingInvitation({
      tenantId: tenant.tenantId,
      email: normalizeEmail(dto.email),
      role: dto.role,
      invitedByUserId: currentUser.id,
    })

    if (result.status === 'alreadyMember') {
      throw new ConflictException('User is already a member of this tenant')
    }

    return toTeamInvitationLinkResponse(
      result.invitation,
      buildTeamInvitationUrl(this.configService.getOrThrow<string>('app.publicUrl'), result.invitation.token),
    )
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
