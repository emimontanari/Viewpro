import { GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CurrentUser } from '../../auth/types/current-user'
import { EMAIL_SENDER, type EmailSender } from '../../email/email-sender.port'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  toTeamInvitationLinkResponse,
  type TeamInvitationLinkResponse,
  type TeamInvitationRole,
} from '../responses/team-invitation.response'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type TeamInvitationsRepository,
} from '../team-invitations.repository'
import { buildTeamInvitationUrl, ensureTeamManagePermission } from './team-invitation-use-case-helpers'

@Injectable()
export class ResendTeamInvitationUseCase {
  private readonly logger = new Logger(ResendTeamInvitationUseCase.name)

  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
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

    const invitationUrl = buildTeamInvitationUrl(
      this.configService.getOrThrow<string>('app.publicUrl'),
      result.invitation.token,
    )

    // Best-effort: an email failure must never fail the resend request.
    try {
      await this.emailSender.sendTeamInvitation({
        to: result.invitation.email,
        role: result.invitation.role as TeamInvitationRole,
        invitationUrl,
        expiresAt: result.invitation.expiresAt,
      })
    } catch (error) {
      this.logger.error(
        `Failed to resend team invitation email to ${result.invitation.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    return toTeamInvitationLinkResponse(result.invitation, invitationUrl)
  }
}
