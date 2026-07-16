import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { ACCESS_TOKEN_COOKIE, CLOCK_TOLERANCE_SECONDS, IDLE_REISSUE_THRESHOLD } from '../auth.constants'
import { TokenService } from '../tokens/token.service'

export type AuthenticatedRequest = Request & {
  user?: { id: string; email: string }
  cookies?: Record<string, string | undefined>
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE]

    if (!token) {
      this.clearBothCookies(context)
      throw new UnauthorizedException('Authentication required')
    }

    // 1. Sliding idle deadline (`exp`), clock-tolerant.
    let payload: Awaited<ReturnType<TokenService['verifyAccessToken']>>
    try {
      payload = await this.tokenService.verifyAccessToken(token)
    } catch {
      this.clearBothCookies(context)
      throw new UnauthorizedException('Authentication required')
    }

    // 2. Legacy/AC9 — a token without a sessionExp claim is treated as
    // expired, never grandfathered as valid. Number.isFinite (not a bare
    // `typeof === 'number'`) also rejects NaN/±Infinity, keeping the
    // absolute-deadline invariant self-contained: `typeof NaN === 'number'`
    // is true and `now > NaN + tol` is false, which would otherwise leak an
    // infinite session.
    if (!Number.isFinite(payload.sessionExp)) {
      this.clearBothCookies(context)
      throw new UnauthorizedException('Authentication required')
    }

    // 3. Absolute deadline (D2) — evaluated independently of the sliding
    // `exp`; either deadline alone is sufficient to reject.
    const now = Math.floor(Date.now() / 1000)
    if (now > payload.sessionExp + CLOCK_TOLERANCE_SECONDS) {
      this.clearBothCookies(context)
      throw new UnauthorizedException('Authentication required')
    }

    request.user = { id: payload.sub, email: payload.email }

    // 4. Threshold-based re-issue (D5) — the LAST statement before
    // `return true`. Structurally unreachable from any reject path above,
    // so a response can never carry both a set and a clear for the access
    // cookie (R5/AC8). Re-issue never touches the step-up cookie (AC6).
    const idleTimeoutSeconds = this.configService.get<number>('app.auth.idleTimeoutSeconds') ?? 600
    if (now - payload.iat >= idleTimeoutSeconds * IDLE_REISSUE_THRESHOLD) {
      const response = context.switchToHttp().getResponse()
      const freshToken = await this.tokenService.reissueAccessToken(payload)
      this.tokenService.setAccessCookie(response, freshToken)
    }

    return true
  }

  // D9/AC7 — no stale step-up cookie should outlive a rotated/invalidated
  // session. Set-Cookie headers set here survive the UnauthorizedException
  // thrown right after, since the response object is mutated directly.
  private clearBothCookies(context: ExecutionContext): void {
    const response = context.switchToHttp().getResponse()
    this.tokenService.clearAccessCookie(response)
    this.tokenService.clearStepUpCookie(response)
  }
}
