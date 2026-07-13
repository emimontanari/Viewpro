import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import { ACCESS_TOKEN_COOKIE } from '../auth.constants'

export type AccessTokenPayload = {
  sub: string
  email: string
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
