import type { NotificationType } from '@prisma/client'
import type { TeamInvitationRole } from '../team/responses/team-invitation.response'

export const EMAIL_SENDER = Symbol('EMAIL_SENDER')

export type SendTeamInvitationInput = {
  to: string
  role: TeamInvitationRole
  invitationUrl: string
  expiresAt: Date | string
  tenantName?: string
}

export type SendOwnerInvitationInput = {
  to: string
  invitationUrl: string
  expiresAt: Date | string
}

export type SendPasswordResetInput = {
  to: string
  resetUrl: string
  expiresAt: Date | string
}

export type SendEmailVerificationInput = {
  to: string
  verificationUrl: string
}

export type SendOwnerNotificationInput = {
  to: string
  notificationType: NotificationType
  body: string
  url: string
}

/**
 * Outbound port for transactional invitation emails.
 * Implementations are best-effort: callers must treat a rejected promise as
 * non-fatal (the invitation itself must still succeed).
 */
export interface EmailSender {
  sendTeamInvitation(input: SendTeamInvitationInput): Promise<void>
  sendOwnerInvitation(input: SendOwnerInvitationInput): Promise<void>
  sendPasswordReset(input: SendPasswordResetInput): Promise<void>
  sendEmailVerification(input: SendEmailVerificationInput): Promise<void>
  sendOwnerNotification(input: SendOwnerNotificationInput): Promise<void>
}
