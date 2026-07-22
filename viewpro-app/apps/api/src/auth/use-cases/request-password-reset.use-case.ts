import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UserStatus } from '@prisma/client'
import { EMAIL_SENDER, type EmailSender } from '../../email/email-sender.port'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { ForgotPasswordDto } from '../dto/forgot-password.dto'
import type { PasswordResetTokenRepository } from '../tokens/password-reset-token.repository'
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../tokens/password-reset-token.repository'
import { TokenService } from '../tokens/token.service'
import { normalizeEmail } from '../utils/slugify'

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name)

  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email)
    const user = await this.usersRepository.findByEmail(email)

    // Never reveal whether the account exists or is active (no email enumeration).
    if (!user || user.status !== UserStatus.ACTIVE) {
      return
    }

    // Invalidate any previously issued reset tokens for this user.
    await this.passwordResetTokenRepository.deleteAllForUser(user.id)

    const rawToken = this.tokenService.generatePasswordResetToken()
    await this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashPasswordResetToken(rawToken),
      expiresAt: this.tokenService.getPasswordResetExpiresAt(),
    })

    const publicUrl = this.configService.getOrThrow<string>('app.publicUrl')
    const resetUrl = `${publicUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(rawToken)}`

    // Best-effort: an email failure must never fail the request.
    try {
      await this.emailSender.sendPasswordReset({
        to: user.email,
        resetUrl,
        expiresAt: this.tokenService.getPasswordResetExpiresAt(),
      })
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
