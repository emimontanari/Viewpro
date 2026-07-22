import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { PlatformServiceIdentity } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import { verifyServiceToken } from './service-token.verifier'

/**
 * Augmented request type for internal platform control endpoints.
 * platformCaller is set by PlatformControlGuard on success.
 * request.user is NEVER set by this guard.
 */
export type PlatformControlRequest = Request & {
  platformCaller?: PlatformServiceIdentity
}

/**
 * Guard for internal platform control endpoints (/internal/platform/**).
 * Verifies an HS256 service JWT from Authorization: Bearer header.
 * Uses PLATFORM_CONTROL_SECRET — isolated from ACCESS_TOKEN_SECRET.
 *
 * On success: sets request.platformCaller, never request.user.
 * On failure: throws UnauthorizedException (401).
 */
@Injectable()
export class PlatformControlGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformControlRequest>()
    const authHeader = request.headers['authorization'] as string | undefined

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Service token required')
    }

    const token = authHeader.slice('Bearer '.length)
    const secret = process.env.PLATFORM_CONTROL_SECRET

    if (!secret) {
      throw new UnauthorizedException('Service token required')
    }

    try {
      const identity = await verifyServiceToken(token, secret)
      request.platformCaller = identity
      // Explicitly do NOT set request.user — this is the trust isolation invariant
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired service token')
    }
  }
}
