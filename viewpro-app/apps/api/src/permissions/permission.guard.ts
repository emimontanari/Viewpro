import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import type { RequestWithTenantContext } from '../tenant-context/tenant-context.types'
import type { Permission } from './permissions.constants'
import { REQUIRED_ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    const requiredAnyPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []

    if (requiredPermissions.length === 0 && requiredAnyPermissions.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<Request & RequestWithTenantContext>()
    const permissions = request.tenantContext?.permissions ?? []

    const hasEveryPermission = requiredPermissions.every((permission) => permissions.includes(permission))
    const hasAnyPermission =
      requiredAnyPermissions.length === 0 || requiredAnyPermissions.some((permission) => permissions.includes(permission))

    if (!hasEveryPermission || !hasAnyPermission) {
      throw new ForbiddenException('Insufficient permissions')
    }

    return true
  }
}
