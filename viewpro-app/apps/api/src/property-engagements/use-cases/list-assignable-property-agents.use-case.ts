import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { TenantRole } from '@prisma/client'
import { MEMBERSHIPS_REPOSITORY, type MembershipsRepository } from '../../memberships/memberships.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'

export type AssignablePropertyAgent = {
  userId: string
  email: string
  firstName: string
  role: TenantRole
}

export type ListAssignablePropertyAgentsResponse = {
  items: AssignablePropertyAgent[]
}

@Injectable()
export class ListAssignablePropertyAgentsUseCase {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async execute(tenant: TenantContext): Promise<ListAssignablePropertyAgentsResponse> {
    const canViewTeam = tenant.permissions.includes(PERMISSIONS.TEAM_VIEW)
    const canCreateEngagements = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_CREATE)

    if (!canViewTeam && !canCreateEngagements) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const memberships = await this.membershipsRepository.findManyByTenantId(tenant.tenantId)

    return {
      items: memberships.map((membership) => ({
        userId: membership.userId,
        email: membership.user.email,
        firstName: membership.user.firstName,
        role: membership.role,
      })),
    }
  }
}
