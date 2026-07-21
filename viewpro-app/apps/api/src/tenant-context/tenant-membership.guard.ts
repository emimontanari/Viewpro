import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { TenantStatus, UserStatus } from '@prisma/client'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../auth/guards/auth.guard'
import { MEMBERSHIPS_REPOSITORY, type MembershipsRepository } from '../memberships/memberships.repository'
import { getPermissionsForRole } from '../permissions/role-permissions'
import { TenantContextStore } from './tenant-context.store'
import type { RequestWithTenantContext } from './tenant-context.types'

const TENANT_ID_HEADER = 'x-tenant-id'

/**
 * Enforces the tenant-scoped API contract for protected tenant routes.
 *
 * Clients must send `x-tenant-id` with the real tenant id. The frontend may use
 * tenant slugs for navigation, but backend authorization is always based on this
 * header, the authenticated user, an active membership, and the tenant status.
 */
@Injectable()
export class TenantMembershipGuard implements CanActivate {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
    private readonly tenantContextStore: TenantContextStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request & RequestWithTenantContext>()

    if (!request.user) {
      throw new UnauthorizedException('Authentication required')
    }

    const tenantId = request.header(TENANT_ID_HEADER)

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required')
    }

    const membership = await this.membershipsRepository.findActiveByUserIdAndTenantId(request.user.id, tenantId)

    if (!membership) {
      throw new ForbiddenException('Tenant access denied')
    }

    if (membership.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User is not active')
    }

    if (membership.tenant.status === TenantStatus.SUSPENDED || membership.tenant.status === TenantStatus.CANCELLED) {
      throw new ForbiddenException('Tenant is not active')
    }

    request.tenantContext = {
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      tenantStatus: membership.tenant.status,
      membershipId: membership.id,
      role: membership.role,
      permissions: getPermissionsForRole(membership.role),
      userStatus: membership.user.status,
    }

    // Isolation backstop (Phase 1): propagate the validated tenant id into the
    // request-scoped AsyncLocalStorage so the Prisma layer can enforce it later.
    this.tenantContextStore.setTenantId(membership.tenant.id)

    return true
  }
}
