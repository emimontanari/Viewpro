import { Injectable } from '@nestjs/common'
import { Resend } from 'resend'
import type {
  EmailSender,
  SendEmailVerificationInput,
  SendOwnerInvitationInput,
  SendOwnerNotificationInput,
  SendPasswordResetInput,
  SendTeamInvitationInput,
} from './email-sender.port'
import { renderEmailVerificationEmail } from './templates/email-verification-email'
import { renderOwnerNotificationEmail } from './templates/owner-notification-email'
import { renderOwnerInvitationEmail, renderTeamInvitationEmail } from './templates/invitation-emails'
import { renderPasswordResetEmail } from './templates/password-reset-email'

/** Minimal surface of the resend client that this adapter depends on. */
export type ResendClient = {
  emails: {
    send(payload: {
      from: string
      to: string
      subject: string
      html: string
      text: string
    }): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

/**
 * Resend-backed EmailSender adapter. Renders the Spanish invitation templates
 * and delivers them through the Resend API.
 */
@Injectable()
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly fromAddress: string,
    private readonly client: ResendClient,
  ) {}

  async sendTeamInvitation(input: SendTeamInvitationInput): Promise<void> {
    const email = renderTeamInvitationEmail({
      role: input.role,
      invitationUrl: input.invitationUrl,
      tenantName: input.tenantName,
    })
    await this.send(input.to, email)
  }

  async sendOwnerInvitation(input: SendOwnerInvitationInput): Promise<void> {
    const email = renderOwnerInvitationEmail({ invitationUrl: input.invitationUrl })
    await this.send(input.to, email)
  }

  async sendPasswordReset(input: SendPasswordResetInput): Promise<void> {
    const email = renderPasswordResetEmail({ resetUrl: input.resetUrl })
    await this.send(input.to, email)
  }

  async sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
    const email = renderEmailVerificationEmail({ verificationUrl: input.verificationUrl })
    await this.send(input.to, email)
  }

  async sendOwnerNotification(input: SendOwnerNotificationInput): Promise<void> {
    const email = renderOwnerNotificationEmail({
      notificationType: input.notificationType,
      body: input.body,
      url: input.url,
    })
    await this.send(input.to, email)
  }

  private async send(
    to: string,
    email: { subject: string; html: string; text: string },
  ): Promise<void> {
    const result = await this.client.emails.send({
      from: this.fromAddress,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    if (result.error) {
      throw new Error(result.error.message)
    }
  }
}

export function createResendClient(apiKey: string): ResendClient {
  return new Resend(apiKey) as unknown as ResendClient
}
