import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { TokenService } from '../tokens/token.service'
import { GetCurrentUserUseCase } from './get-current-user.use-case'

export type RefreshedSessionResult = {
  accessToken: string
  refreshToken: string
  body: Awaited<ReturnType<GetCurrentUserUseCase['execute']>>
}

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  async execute(rawRefreshToken: string | undefined): Promise<RefreshedSessionResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({ errorCode: 'SESSION_EXPIRED', message: 'Authentication required' })
    }

    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken)
    const storedToken = await this.refreshTokenRepository.findByTokenHash(tokenHash)

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException({ errorCode: 'SESSION_EXPIRED', message: 'Authentication required' })
    }

    const body = await this.getCurrentUserUseCase.execute(storedToken.userId)
    const accessToken = await this.tokenService.signAccessToken({
      sub: body.user.id,
      email: body.user.email,
    })
    const refreshToken = this.tokenService.generateRefreshToken()
    const newStoredToken = await this.refreshTokenRepository.create({
      userId: storedToken.userId,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })

    await this.refreshTokenRepository.revoke(storedToken.id, newStoredToken.id)

    return { accessToken, refreshToken, body }
  }
}
