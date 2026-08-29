import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { getAuthRateLimitConfig } from '../config/app.config'
import { REFRESH_TOKEN_COOKIE } from './auth.constants'
import { CurrentUser } from './decorators/current-user.decorator'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { LoginDto } from './dto/login.dto'
import { RegisterTenantDto } from './dto/register-tenant.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { VerifyEmailDto } from './dto/verify-email.dto'
import { AuthGuard } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { TokenService } from './tokens/token.service'
import type { CurrentUser as CurrentUserPayload } from './types/current-user'
import { GetCurrentUserUseCase } from './use-cases/get-current-user.use-case'
import { LoginUseCase } from './use-cases/login.use-case'
import { LogoutUseCase } from './use-cases/logout.use-case'
import { RefreshSessionUseCase } from './use-cases/refresh-session.use-case'
import { RegisterTenantUseCase } from './use-cases/register-tenant.use-case'
import { RequestPasswordResetUseCase } from './use-cases/request-password-reset.use-case'
import { ResendEmailVerificationUseCase } from './use-cases/resend-email-verification.use-case'
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case'
import { VerifyEmailUseCase } from './use-cases/verify-email.use-case'

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
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendEmailVerificationUseCase: ResendEmailVerificationUseCase,
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

  @Post('forgot-password')
  @HttpCode(202)
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.login))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.requestPasswordResetUseCase.execute(dto)
    return { ok: true }
  }

  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.login))
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto)
    return { ok: true }
  }

  @Post('verify-email')
  @HttpCode(200)
  @UseGuards(AuthThrottlerGuard)
  @Throttle(toThrottleOptions(authRateLimit.login))
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verifyEmailUseCase.execute(dto)
    return { ok: true }
  }

  @Post('resend-verification')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  async resendVerification(@CurrentUser() user: CurrentUserPayload) {
    await this.resendEmailVerificationUseCase.execute(user)
    return { ok: true }
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
