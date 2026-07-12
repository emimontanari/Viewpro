import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  toTeamInvitationLinkResponse,
  type TeamInvitationLinkResponse,
} from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { buildTeamInvitationUrl, ensureTeamManagePermission } from './team-invitation-use-case-helpers'

@Injectable()
export class ResendTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    invitationId: string,
  ): Promise<TeamInvitationLinkResponse> {
    ensureTeamManagePermission(tenant)

    const result = await this.teamInvitationsRepository.resendInvitation({
      tenantId: tenant.tenantId,
      invitationId,
      invitedByUserId: currentUser.id,
    })

    if (result.status === 'notFound') {
      throw new NotFoundException('Team invitation not found')
    }

    if (result.status === 'notAvailable') {
      throw new GoneException('Team invitation is no longer available')
    }

    return toTeamInvitationLinkResponse(
      result.invitation,
      buildTeamInvitationUrl(this.configService.getOrThrow<string>('app.publicUrl'), result.invitation.token),
    )
  }
}
