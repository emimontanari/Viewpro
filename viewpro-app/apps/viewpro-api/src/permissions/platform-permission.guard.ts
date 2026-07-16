import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AUTH_REQUIRED_CODE } from '../auth/auth.constants'
import type { AuthenticatedRequest } from '../auth/guards/auth.guard'
import { OPERATOR_REPOSITORY, type IOperatorRepository } from '../auth/repositories/operator.repository'
import { PERMISSION_DENIED_CODE, type PlatformPermission } from './platform-permissions.constants'
import { REQUIRED_PLATFORM_PERMISSION_KEY } from './require-platform-permission.decorator'
import { getPermissionsForRole } from './role-permissions'

// Single generic 403 body for every deny reason (undeclared route, unknown/
// non-ACTIVE operator, role lacks permission) — avoids leaking account state
// via the response shape (D6).
const PERMISSION_DENIED_RESPONSE = {
  statusCode: 403,
  code: PERMISSION_DENIED_CODE,
  message: 'Insufficient permissions',
}

// Defensive only — unreachable in production because AuthGuard (class-level,
// 1st) always populates request.user before this guard runs (D6 branch 1).
const AUTH_REQUIRED_RESPONSE = {
  statusCode: 401,
  code: AUTH_REQUIRED_CODE,
  message: 'Authentication required',
}

/**
 * PlatformPermissionGuard — enforces the platform permission declared via
 * `@RequirePlatformPermission(...)` on a route. Runs AFTER `AuthGuard`
 * (class-level order) and BEFORE `StepUpGuard` (method-level) on destructive
 * routes (D7).
 *
 * Role resolution is a per-request DB lookup (D1 — locked): no JWT `role`
 * claim, so a role/status change takes effect on the operator's very next
 * request with no re-login and no token dependency.
 */
@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PlatformPermission | undefined>(
      REQUIRED_PLATFORM_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )

    // D5 — fail-closed: a guarded route with no declared permission denies
    // every operator, regardless of role.
    if (!required) {
      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE)
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user) {
      throw new UnauthorizedException(AUTH_REQUIRED_RESPONSE)
    }

    const operator = await this.operatorRepository.findById(request.user.id)

    // Missing operator OR not ACTIVE (SUSPENDED lockout, D6 hardening) → deny.
    if (!operator || operator.status !== 'ACTIVE') {
      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE)
    }

    if (!getPermissionsForRole(operator.role).includes(required)) {
      throw new ForbiddenException(PERMISSION_DENIED_RESPONSE)
    }

    return true
  }
}
