import { Inject, Injectable } from '@nestjs/common'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { TokenService } from '../tokens/token.service'

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) {
      return { ok: true }
    }

    const storedToken = await this.refreshTokenRepository.findByTokenHash(
      this.tokenService.hashRefreshToken(rawRefreshToken),
    )

    if (storedToken && !storedToken.revokedAt) {
      await this.refreshTokenRepository.revoke(storedToken.id)
    }

    return { ok: true }
  }
}
