import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { toTeamInvitationResponse, type TeamInvitationResponse } from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { ensureTeamManagePermission } from './team-invitation-use-case-helpers'

@Injectable()
export class RevokeTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
  ) {}

  async execute(tenant: TenantContext, invitationId: string): Promise<TeamInvitationResponse> {
    ensureTeamManagePermission(tenant)

    const result = await this.teamInvitationsRepository.revokeInvitation({
      tenantId: tenant.tenantId,
      invitationId,
    })

    if (result.status === 'notFound') {
      throw new NotFoundException('Team invitation not found')
    }

    if (result.status === 'notAvailable') {
      throw new GoneException('Team invitation is no longer available')
    }

    return toTeamInvitationResponse(result.invitation)
  }
}
