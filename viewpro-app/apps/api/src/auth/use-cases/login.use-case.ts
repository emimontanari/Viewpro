import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, UserStatus } from '@prisma/client'
import { AnalyticsService, type TrackAnalyticsEventInput } from '../../analytics/analytics.service'
import type { MembershipsRepository } from '../../memberships/memberships.repository'
import { MEMBERSHIPS_REPOSITORY } from '../../memberships/memberships.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { LoginDto } from '../dto/login.dto'
import { mapAuthUser } from '../responses/auth-user.response'
import { mapMembership } from '../responses/me.response'
import type { PasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { TokenService } from '../tokens/token.service'
import { normalizeEmail } from '../utils/slugify'
import type { AuthSessionResult } from './register-tenant.use-case'

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(MEMBERSHIPS_REPOSITORY) private readonly membershipsRepository: MembershipsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthSessionResult> {
    const user = await this.usersRepository.findByEmail(normalizeEmail(dto.email))
    const validPassword = user ? await this.passwordHasher.verify(user.passwordHash, dto.password) : false

    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password')
    }

    const accessToken = await this.tokenService.signAccessToken({ sub: user.id, email: user.email })
    const refreshToken = this.tokenService.generateRefreshToken()

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })

    const memberships = await this.membershipsRepository.findManyByUserId(user.id)

    const unambiguousMembership = memberships.length === 1 ? memberships[0] : null
    if (unambiguousMembership) {
      await this.trackAnalytics({
        eventName: AnalyticsEventName.SELLER_LOGGED_IN,
        actorType: AnalyticsActorType.INTERNAL_USER,
        tenantId: unambiguousMembership.tenant.id,
        actorUserId: user.id,
      })
    }

    return {
      accessToken,
      refreshToken,
      body: { user: mapAuthUser(user), memberships: memberships.map(mapMembership) },
    }
  }

  private async trackAnalytics(input: TrackAnalyticsEventInput): Promise<void> {
    try {
      await this.analyticsService.track(input)
    } catch {
      // Analytics must not break login.
    }
  }
}
