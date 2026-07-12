import { Inject, Injectable } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  toPendingTeamInvitationResponse,
  type PendingTeamInvitationsResponse,
} from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { ensureTeamManagePermission } from './team-invitation-use-case-helpers'

@Injectable()
export class ListTeamInvitationsUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
  ) {}

  async execute(tenant: TenantContext): Promise<PendingTeamInvitationsResponse> {
    ensureTeamManagePermission(tenant)

    const invitations = await this.teamInvitationsRepository.listPendingInvitations({
      tenantId: tenant.tenantId,
    })

    return { items: invitations.map(toPendingTeamInvitationResponse) }
  }
}
