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
      throw new NotFoundException({ errorCode: 'INVITATION_NOT_FOUND', message: 'Team invitation not found' })
    }

    if (result.status === 'expired') {
      throw new GoneException({ errorCode: 'INVITATION_EXPIRED', message: 'Team invitation has expired' })
    }

    if (result.status === 'revoked') {
      throw new GoneException({ errorCode: 'INVITATION_REVOKED', message: 'Team invitation is no longer available' })
    }

    if (result.status === 'alreadyAccepted') {
      throw new GoneException({ errorCode: 'INVITATION_ALREADY_ACCEPTED', message: 'Team invitation was already accepted' })
    }

    return toTeamInvitationPublicResponse(result.invitation, result.emailRegistered)
  }
}
