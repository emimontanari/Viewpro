import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes } from 'node:crypto'
import type { Response } from 'express'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth.constants'

const REFRESH_TOKEN_COOKIE_PATH = '/'
const LEGACY_REFRESH_TOKEN_COOKIE_PATH = '/api/auth'

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

  generateRefreshToken(): string {
    return randomBytes(64).toString('base64url')
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  getRefreshTokenExpiresAt(): Date {
    const ttlSeconds = this.configService.get<number>('app.auth.refreshTokenTtlSeconds') ?? 2592000
    return new Date(Date.now() + ttlSeconds * 1000)
  }

  generatePasswordResetToken(): string {
    return randomBytes(32).toString('base64url')
  }

  hashPasswordResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  getPasswordResetExpiresAt(): Date {
    const ttlSeconds = this.configService.get<number>('app.auth.resetTokenTtlSeconds') ?? 3600
    return new Date(Date.now() + ttlSeconds * 1000)
  }

  generateEmailVerificationToken(): string {
    return randomBytes(32).toString('base64url')
  }

  hashEmailVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  getEmailVerificationExpiresAt(): Date {
    const ttlSeconds =
      this.configService.get<number>('app.auth.emailVerificationTokenTtlSeconds') ?? 86400
    return new Date(Date.now() + ttlSeconds * 1000)
  }

  setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
    const accessTtlSeconds = this.configService.get<number>('app.auth.accessTokenTtlSeconds') ?? 900
    const refreshTtlSeconds = this.configService.get<number>('app.auth.refreshTokenTtlSeconds') ?? 2592000

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.baseCookieOptions(),
      maxAge: accessTtlSeconds * 1000,
    })
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.baseCookieOptions(),
      maxAge: refreshTtlSeconds * 1000,
      path: REFRESH_TOKEN_COOKIE_PATH,
    })
  }

  clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.baseCookieOptions())
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseCookieOptions(),
      path: REFRESH_TOKEN_COOKIE_PATH,
    })
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.baseCookieOptions(),
      path: LEGACY_REFRESH_TOKEN_COOKIE_PATH,
    })
  }

  private baseCookieOptions() {
    const configuredDomain = this.configService.get<string>('app.cookies.domain')
    const domain = configuredDomain && configuredDomain !== 'localhost' ? configuredDomain : undefined

    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get<boolean>('app.cookies.secure') ?? false,
      ...(domain ? { domain } : {}),
    }
  }
}
