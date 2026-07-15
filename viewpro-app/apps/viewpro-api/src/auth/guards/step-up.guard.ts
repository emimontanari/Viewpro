import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { STEP_UP_TOKEN_COOKIE } from '../auth.constants'
import { TokenService } from '../tokens/token.service'
import type { AuthenticatedRequest } from './auth.guard'

export const STEP_UP_STATUS_TARGETS_KEY = 'stepUpStatusTargets'

/**
 * Route metadata: only require step-up when the raw request body's `status`
 * field is one of `targets` (design D5). Guards run after body parsing but
 * before pipes, so this reads the RAW, unvalidated body — any value not in
 * `targets` (including 'ACTIVE' or garbage the DTO later rejects with 400)
 * skips the step-up check.
 */
export const StepUpStatusTargets = (targets: string[]) =>
  SetMetadata(STEP_UP_STATUS_TARGETS_KEY, targets)

const STEP_UP_REQUIRED_RESPONSE = {
  statusCode: 403,
  code: 'STEP_UP_REQUIRED',
  message: 'Step-up verification required',
}

/**
 * StepUpGuard — additive, method-level guard verifying a fresh "sudo mode"
 * proof for destructive operator actions. MUST run after AuthGuard
 * (class-level), so `request.user` is guaranteed populated (D4).
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { body?: Record<string, unknown> }>()

    const statusTargets = this.reflector.getAllAndOverride<string[] | undefined>(
      STEP_UP_STATUS_TARGETS_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (statusTargets && !statusTargets.includes(request.body?.status as string)) {
      return true
    }

    const token = request.cookies?.[STEP_UP_TOKEN_COOKIE]

    if (!token) {
      throw new ForbiddenException(STEP_UP_REQUIRED_RESPONSE)
    }

    try {
      const payload = await this.tokenService.verifyStepUpToken(token)

      if (payload.stepUp !== true || payload.sub !== request.user?.id) {
        throw new ForbiddenException(STEP_UP_REQUIRED_RESPONSE)
      }

      return true
    } catch {
      throw new ForbiddenException(STEP_UP_REQUIRED_RESPONSE)
    }
  }
}
