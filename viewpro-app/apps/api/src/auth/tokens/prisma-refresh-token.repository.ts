import { Injectable } from '@nestjs/common'
import type { Prisma, RefreshToken } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import type { RefreshTokenRepository } from './refresh-token.repository'

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data })
  }

  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } })
  }

  revoke(id: string, replacedByTokenId?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedByTokenId },
    })
  }
}
