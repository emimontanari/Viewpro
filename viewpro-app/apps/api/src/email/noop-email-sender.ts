import { Injectable, Logger } from '@nestjs/common'
import type {
  EmailSender,
  SendOwnerInvitationInput,
  SendPasswordResetInput,
  SendTeamInvitationInput,
} from './email-sender.port'

/**
 * Fallback EmailSender used when RESEND_API_KEY is not configured.
 * Logs the intent and does nothing so invitation flows keep working in
 * dev/test/not-yet-activated production without sending real email.
 */
@Injectable()
export class NoopEmailSender implements EmailSender {
  private readonly logger = new Logger(NoopEmailSender.name)

  async sendTeamInvitation(input: SendTeamInvitationInput): Promise<void> {
    this.logger.warn(
      `Email sending disabled (RESEND_API_KEY unset): skipping team invitation email to ${input.to}`,
    )
  }

  async sendOwnerInvitation(input: SendOwnerInvitationInput): Promise<void> {
    this.logger.warn(
      `Email sending disabled (RESEND_API_KEY unset): skipping owner invitation email to ${input.to}`,
    )
  }

  async sendPasswordReset(input: SendPasswordResetInput): Promise<void> {
    this.logger.warn(
      `Email sending disabled (RESEND_API_KEY unset): skipping password reset email to ${input.to}`,
    )
  }
}
