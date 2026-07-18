import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
} from '../../memberships/memberships.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { toTeamMemberResponse, type TeamMemberResponse } from '../responses/team-member.response'
import { ensureTeamManagePermission } from './team-invitation-use-case-helpers'

export type UpdateTeamMemberRoleInput = {
  role: TenantRole
}

@Injectable()
export class UpdateTeamMemberRoleUseCase {
  constructor(
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    membershipId: string,
    input: UpdateTeamMemberRoleInput,
  ): Promise<TeamMemberResponse> {
    ensureTeamManagePermission(tenant)

    if (input.role === TenantRole.PRINCIPAL_MANAGER) {
      throw new BadRequestException('Unsupported team member role')
    }

    const membership = await this.membershipsRepository.findByIdForTenant(membershipId, tenant.tenantId)

    if (!membership) {
      throw new NotFoundException('Team member not found')
    }

    if (membership.status !== 'ACTIVE') {
      throw new BadRequestException('Team member is not active')
    }

    if (membership.role === TenantRole.PRINCIPAL_MANAGER) {
      throw new BadRequestException('Principal manager cannot be changed')
    }

    const updated = await this.membershipsRepository.updateRoleForTenant({
      membershipId,
      tenantId: tenant.tenantId,
      role: input.role,
      actorUserId: currentUser.id,
    })

    if (!updated) {
      throw new BadRequestException('Team member is not active')
    }

    return toTeamMemberResponse(updated)
  }
}
