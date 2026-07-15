import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { ACCESS_TOKEN_COOKIE } from '../auth.constants'
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

    try {
      const payload = await this.tokenService.verifyAccessToken(token)
      request.user = { id: payload.sub, email: payload.email }
      return true
    } catch {
      this.clearBothCookies(context)
      throw new UnauthorizedException('Authentication required')
    }
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
