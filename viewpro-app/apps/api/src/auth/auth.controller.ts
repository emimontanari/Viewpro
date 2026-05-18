import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { getAuthRateLimitConfig } from '../config/app.config'
import { REFRESH_TOKEN_COOKIE } from './auth.constants'
import { CurrentUser } from './decorators/current-user.decorator'
import { LoginDto } from './dto/login.dto'
import { RegisterTenantDto } from './dto/register-tenant.dto'
import { AuthGuard, type AuthenticatedRequest } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { TokenService } from './tokens/token.service'
import type { CurrentUser as CurrentUserPayload } from './types/current-user'
import { GetCurrentUserUseCase } from './use-cases/get-current-user.use-case'
import { LoginUseCase } from './use-cases/login.use-case'
import { LogoutUseCase } from './use-cases/logout.use-case'
import { RefreshSessionUseCase } from './use-cases/refresh-session.use-case'
import { RegisterTenantUseCase } from './use-cases/register-tenant.use-case'

type CookieRequest = Request & { cookies?: Record<string, string | undefined> }
const authRateLimit = getAuthRateLimitConfig()

function toThrottleOptions(config: { limit: number; ttlSeconds: number }) {
  return { default: { limit: config.limit, ttl: config.ttlSeconds * 1000 } }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerTenantUseCase: RegisterTenantUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register-tenant')
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.register))
  async registerTenant(@Body() dto: RegisterTenantDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.registerTenantUseCase.execute(dto)
    this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
    return result.body
  }

  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.login))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.loginUseCase.execute(dto)
    this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
    return result.body
  }

  @Post('refresh')
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.refresh))
  async refresh(@Req() request: CookieRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.refreshSessionUseCase.execute(request.cookies?.[REFRESH_TOKEN_COOKIE])
    this.tokenService.setAuthCookies(response, result.accessToken, result.refreshToken)
    return result.body
  }

  @Post('logout')
  async logout(@Req() request: CookieRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.logoutUseCase.execute(request.cookies?.[REFRESH_TOKEN_COOKIE])
    this.tokenService.clearAuthCookies(response)
    return result
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return this.getCurrentUserUseCase.execute(user.id)
  }
}
