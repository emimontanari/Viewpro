import { Injectable } from '@nestjs/common'
import type { EmailVerificationToken } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import type {
  CreateEmailVerificationTokenInput,
  EmailVerificationTokenRepository,
  EmailVerificationTokenWithUser,
} from './email-verification-token.repository'

@Injectable()
export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateEmailVerificationTokenInput): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.create({ data })
  }

  findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenWithUser | null> {
    return this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
  }

  markUsed(id: string): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    })
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } })
  }
}
