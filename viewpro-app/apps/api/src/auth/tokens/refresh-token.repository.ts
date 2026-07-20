import type { Prisma, RefreshToken } from '@prisma/client'

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY')

export type RefreshTokenRepository = {
  create(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshToken>
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>
  revoke(id: string, replacedByTokenId?: string): Promise<RefreshToken>
  revokeAllForUser(userId: string): Promise<void>
}
