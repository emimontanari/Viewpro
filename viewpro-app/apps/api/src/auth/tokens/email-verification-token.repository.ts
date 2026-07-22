import type { EmailVerificationToken, User } from '@prisma/client'

export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol('EMAIL_VERIFICATION_TOKEN_REPOSITORY')

export type CreateEmailVerificationTokenInput = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export type EmailVerificationTokenWithUser = EmailVerificationToken & { user: User }

export type EmailVerificationTokenRepository = {
  create(data: CreateEmailVerificationTokenInput): Promise<EmailVerificationToken>
  findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenWithUser | null>
  markUsed(id: string): Promise<EmailVerificationToken>
  deleteAllForUser(userId: string): Promise<void>
}
