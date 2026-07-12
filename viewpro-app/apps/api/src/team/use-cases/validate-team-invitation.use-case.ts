import { GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { hashTeamInvitationToken } from '../team-invitation-token'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { toTeamInvitationPublicResponse } from '../responses/team-invitation.response'

@Injectable()
export class ValidateTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
  ) {}

  async execute(rawToken: string) {
    const result = await this.teamInvitationsRepository.validateByTokenHash({
      tokenHash: hashTeamInvitationToken(rawToken),
      now: new Date(),
    })

    if (result.status === 'notFound') {
      throw new NotFoundException('Team invitation not found')
    }

    if (result.status === 'expired') {
      throw new GoneException('Team invitation has expired')
    }

    if (result.status === 'revoked') {
      throw new GoneException('Team invitation is no longer available')
    }

    if (result.status === 'alreadyAccepted') {
      throw new GoneException('Team invitation was already accepted')
    }

    return toTeamInvitationPublicResponse(result.invitation, result.emailRegistered)
  }
}
