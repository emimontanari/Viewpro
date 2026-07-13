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
      throw new UnauthorizedException('Authentication required')
    }

    try {
      const payload = await this.tokenService.verifyAccessToken(token)
      request.user = { id: payload.sub, email: payload.email }
      return true
    } catch {
      throw new UnauthorizedException('Authentication required')
    }
  }
}
