import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { TenantRole, UserStatus } from '@prisma/client'
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
  type MembershipWithUserAndTenant,
} from '../../memberships/memberships.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'

export type TeamMemberResponse = {
  membershipId: string
  userId: string
  email: string
  firstName: string
  lastName: string | null
  userStatus: UserStatus
  role: TenantRole
  createdAt: string
  updatedAt: string
}

export type TeamMembersResponse = {
  items: TeamMemberResponse[]
}

@Injectable()
export class ListTeamMembersUseCase {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async execute(tenant: TenantContext): Promise<TeamMembersResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.TEAM_VIEW)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const memberships = await this.membershipsRepository.findManyByTenantId(tenant.tenantId)

    return {
      items: memberships.map(mapTeamMember),
    }
  }
}

function mapTeamMember(membership: MembershipWithUserAndTenant): TeamMemberResponse {
  return {
    membershipId: membership.id,
    userId: membership.userId,
    email: membership.user.email,
    firstName: membership.user.firstName,
    lastName: membership.user.lastName,
    userStatus: membership.user.status,
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
  }
}
