import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { VerifyEmailDto } from '../dto/verify-email.dto'
import type { EmailVerificationTokenRepository } from '../tokens/email-verification-token.repository'
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../tokens/email-verification-token.repository'
import { TokenService } from '../tokens/token.service'

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<void> {
    const tokenHash = this.tokenService.hashEmailVerificationToken(dto.token)
    const verificationToken = await this.emailVerificationTokenRepository.findByTokenHash(tokenHash)

    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired verification token')
    }

    await this.usersRepository.markEmailVerified(verificationToken.userId)
    await this.emailVerificationTokenRepository.markUsed(verificationToken.id)
  }
}
