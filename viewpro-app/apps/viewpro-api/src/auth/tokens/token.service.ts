import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import { ACCESS_TOKEN_COOKIE, STEP_UP_TOKEN_COOKIE } from '../auth.constants'

export type AccessTokenPayload = {
  sub: string
  email: string
}

export type StepUpTokenPayload = {
  sub: string
  stepUp: true
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload)
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token)
  }

  setAccessCookie(response: Response, token: string): void {
    const ttlSeconds =
      this.configService.get<number>('app.auth.accessTokenTtlSeconds') ?? 900
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...this.baseCookieOptions(),
      maxAge: ttlSeconds * 1000,
    })
  }

  clearAccessCookie(response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.baseCookieOptions())
  }

  signStepUpToken({ sub }: { sub: string }): Promise<string> {
    return this.jwtService.signAsync(
      { sub, stepUp: true },
      {
        secret: this.configService.get<string>('app.auth.stepUpTokenSecret'),
        expiresIn: this.configService.get<number>('app.auth.stepUpTtlSeconds'),
      },
    )
  }

  verifyStepUpToken(token: string): Promise<StepUpTokenPayload> {
    return this.jwtService.verifyAsync<StepUpTokenPayload>(token, {
      secret: this.configService.get<string>('app.auth.stepUpTokenSecret'),
    })
  }

  setStepUpCookie(response: Response, token: string): void {
    const ttlSeconds =
      this.configService.get<number>('app.auth.stepUpTtlSeconds') ?? 300
    response.cookie(STEP_UP_TOKEN_COOKIE, token, {
      ...this.baseCookieOptions(),
      maxAge: ttlSeconds * 1000,
    })
  }

  clearStepUpCookie(response: Response): void {
    response.clearCookie(STEP_UP_TOKEN_COOKIE, this.baseCookieOptions())
  }

  private baseCookieOptions() {
    const configuredDomain = this.configService.get<string>('app.cookies.domain')
    const domain =
      configuredDomain && configuredDomain !== 'localhost' ? configuredDomain : undefined

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<boolean>('app.cookies.secure') ?? false,
      path: '/',
      ...(domain ? { domain } : {}),
    }
  }
}
