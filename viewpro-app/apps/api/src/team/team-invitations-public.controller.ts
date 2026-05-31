import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants'
import { AuthThrottlerGuard } from '../auth/guards/auth-throttler.guard'
import { TokenService } from '../auth/tokens/token.service'
import type { CurrentUser } from '../auth/types/current-user'
import { getAuthRateLimitConfig } from '../config/app.config'
// biome-ignore lint/style/useImportType: Nest validation pipe needs runtime DTO metadata.
import { AcceptTeamInvitationDto } from './dto/accept-team-invitation.dto'
import { AcceptTeamInvitationUseCase } from './use-cases/accept-team-invitation.use-case'
import { ValidateTeamInvitationUseCase } from './use-cases/validate-team-invitation.use-case'

const authRateLimit = getAuthRateLimitConfig()

type CookieRequest = Request & { cookies?: Record<string, string | undefined> }

function toThrottleOptions(config: { limit: number; ttlSeconds: number }) {
  return { default: { limit: config.limit, ttl: config.ttlSeconds * 1000 } }
}

@Controller('team-invitations')
export class TeamInvitationsPublicController {
  constructor(
    @Inject(ValidateTeamInvitationUseCase)
    private readonly validateTeamInvitationUseCase: ValidateTeamInvitationUseCase,
    @Inject(AcceptTeamInvitationUseCase)
    private readonly acceptTeamInvitationUseCase: AcceptTeamInvitationUseCase,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.validateTeamInvitationUseCase.execute(token)
  }

  @Post(':token/accept')
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.register))
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptTeamInvitationDto,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentUser = await this.getOptionalCurrentUser(request)
    const result = await this.acceptTeamInvitationUseCase.execute(token, dto, currentUser)
    this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
    return result.body
  }

  private async getOptionalCurrentUser(request: CookieRequest): Promise<CurrentUser | null> {
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE]
    if (!token) {
      return null
    }

    try {
      const payload = await this.tokenService.verifyAccessToken(token)
      return { id: payload.sub, email: payload.email }
    } catch {
      return null
    }
  }
}
