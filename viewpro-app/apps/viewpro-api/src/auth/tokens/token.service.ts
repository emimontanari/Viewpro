import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import { ACCESS_TOKEN_COOKIE, CLOCK_TOLERANCE_SECONDS, STEP_UP_TOKEN_COOKIE } from '../auth.constants'

export type AccessTokenPayload = {
  sub: string
  email: string
  sessionExp: number
}

export type VerifiedAccessTokenPayload = AccessTokenPayload & { iat: number; exp: number }

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

  // D1/D3 — mints a NEW absolute-deadline claim (login only). The sliding
  // `exp` is per-call so it always reflects the current idle window.
  signAccessToken({ sub, email }: { sub: string; email: string }): Promise<string> {
    const absoluteSessionSeconds =
      this.configService.get<number>('app.auth.absoluteSessionSeconds') ?? 28800
    const sessionExp = Math.floor(Date.now() / 1000) + absoluteSessionSeconds
    return this.jwtService.signAsync(
      { sub, email, sessionExp },
      { expiresIn: this.idleTimeoutSeconds() },
    )
  }

  // D3 — builds a FRESH payload object; never spreads `verified` (which
  // already carries `iat`/`exp` and would make jsonwebtoken throw when
  // combined with the `expiresIn` sign option). `sessionExp` is copied
  // byte-identical — never re-minted.
  reissueAccessToken(verified: VerifiedAccessTokenPayload): Promise<string> {
    const { sub, email, sessionExp } = verified
    return this.jwtService.signAsync(
      { sub, email, sessionExp },
      { expiresIn: this.idleTimeoutSeconds() },
    )
  }

  verifyAccessToken(token: string): Promise<VerifiedAccessTokenPayload> {
    return this.jwtService.verifyAsync<VerifiedAccessTokenPayload>(token, {
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    })
  }

  setAccessCookie(response: Response, token: string): void {
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...this.baseCookieOptions(),
      maxAge: this.idleTimeoutSeconds() * 1000,
    })
  }

  private idleTimeoutSeconds(): number {
    return this.configService.get<number>('app.auth.idleTimeoutSeconds') ?? 600
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
