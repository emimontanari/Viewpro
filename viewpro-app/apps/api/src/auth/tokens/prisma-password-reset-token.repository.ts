import { Injectable } from '@nestjs/common'
import type { PasswordResetToken } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import type {
  CreatePasswordResetTokenInput,
  PasswordResetTokenRepository,
  PasswordResetTokenWithUser,
} from './password-reset-token.repository'

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePasswordResetTokenInput): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data })
  }

  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenWithUser | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
  }

  markUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } })
  }
}
