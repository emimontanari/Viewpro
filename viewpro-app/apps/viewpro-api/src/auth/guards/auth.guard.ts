import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { ACCESS_TOKEN_COOKIE, CLOCK_TOLERANCE_SECONDS } from '../auth.constants'
import { TokenService } from '../tokens/token.service'

export type AuthenticatedRequest = Request & {
  user?: { id: string; email: string }
  cookies?: Record<string, string | undefined>
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

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
    // expired, never grandfathered as valid.
    if (typeof payload.sessionExp !== 'number') {
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
