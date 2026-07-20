import type { PasswordResetToken, User } from '@prisma/client'

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY')

export type CreatePasswordResetTokenInput = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export type PasswordResetTokenWithUser = PasswordResetToken & { user: User }

export type PasswordResetTokenRepository = {
  create(data: CreatePasswordResetTokenInput): Promise<PasswordResetToken>
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenWithUser | null>
  markUsed(id: string): Promise<PasswordResetToken>
  deleteAllForUser(userId: string): Promise<void>
}
