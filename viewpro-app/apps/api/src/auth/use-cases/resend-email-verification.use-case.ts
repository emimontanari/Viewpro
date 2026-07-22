import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EMAIL_SENDER, type EmailSender } from '../../email/email-sender.port'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { CurrentUser } from '../types/current-user'
import type { EmailVerificationTokenRepository } from '../tokens/email-verification-token.repository'
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../tokens/email-verification-token.repository'
import { TokenService } from '../tokens/token.service'

@Injectable()
export class ResendEmailVerificationUseCase {
  private readonly logger = new Logger(ResendEmailVerificationUseCase.name)

  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(currentUser: CurrentUser): Promise<void> {
    const user = await this.usersRepository.findById(currentUser.id)

    // Already verified (or user gone): nothing to do.
    if (!user || user.emailVerifiedAt) {
      return
    }

    // Invalidate any previously issued verification tokens for this user.
    await this.emailVerificationTokenRepository.deleteAllForUser(user.id)

    const rawToken = this.tokenService.generateEmailVerificationToken()
    await this.emailVerificationTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashEmailVerificationToken(rawToken),
      expiresAt: this.tokenService.getEmailVerificationExpiresAt(),
    })

    const publicUrl = this.configService.getOrThrow<string>('app.publicUrl')
    const verificationUrl = `${publicUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(rawToken)}`

    // Best-effort: an email failure must never fail the request.
    try {
      await this.emailSender.sendEmailVerification({
        to: user.email,
        verificationUrl,
      })
    } catch (error) {
      this.logger.error(
        `Failed to send email verification to ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
