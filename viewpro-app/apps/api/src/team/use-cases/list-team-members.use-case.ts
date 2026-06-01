import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import {
  MEMBERSHIPS_REPOSITORY,
  type MembershipsRepository,
} from '../../memberships/memberships.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { toTeamMemberResponse, type TeamMembersResponse } from '../responses/team-member.response'

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
      items: memberships.map(toTeamMemberResponse),
    }
  }
}
