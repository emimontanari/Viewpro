import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CurrentUser } from '../../auth/types/current-user'
import { EMAIL_SENDER, type EmailSender } from '../../email/email-sender.port'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateTeamInvitationDto } from '../dto/create-team-invitation.dto'
import {
  toTeamInvitationLinkResponse,
  type TeamInvitationLinkResponse,
  type TeamInvitationRole,
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
  private readonly logger = new Logger(CreateTeamInvitationUseCase.name)

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

    const invitationUrl = buildTeamInvitationUrl(
      this.configService.getOrThrow<string>('app.publicUrl'),
      result.invitation.token,
    )

    // Best-effort: an email failure must never fail the invitation request.
    try {
      await this.emailSender.sendTeamInvitation({
        to: result.invitation.email,
        role: result.invitation.role as TeamInvitationRole,
        invitationUrl,
        expiresAt: result.invitation.expiresAt,
      })
    } catch (error) {
      this.logger.error(
        `Failed to send team invitation email to ${result.invitation.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    return toTeamInvitationLinkResponse(result.invitation, invitationUrl)
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
