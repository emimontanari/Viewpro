import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { ResetPasswordDto } from '../dto/reset-password.dto'
import type { PasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import type { PasswordResetTokenRepository } from '../tokens/password-reset-token.repository'
import { PASSWORD_RESET_TOKEN_REPOSITORY } from '../tokens/password-reset-token.repository'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { TokenService } from '../tokens/token.service'

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.tokenService.hashPasswordResetToken(dto.token)
    const resetToken = await this.passwordResetTokenRepository.findByTokenHash(tokenHash)

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new BadRequestException('Invalid or expired reset token')
    }

    const passwordHash = await this.passwordHasher.hash(dto.password)
    await this.usersRepository.updatePassword(resetToken.userId, passwordHash)
    await this.passwordResetTokenRepository.markUsed(resetToken.id)
    await this.refreshTokenRepository.revokeAllForUser(resetToken.userId)
  }
}
