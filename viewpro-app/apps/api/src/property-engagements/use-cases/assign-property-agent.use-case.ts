import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { MEMBERSHIPS_REPOSITORY, type MembershipsRepository } from '../../memberships/memberships.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PROPERTY_ENGAGEMENTS_REPOSITORY, type PropertyEngagementsRepository } from '../property-engagements.repository'

export type AssignPropertyAgentInput = {
  agentUserId: string
}

@Injectable()
export class AssignPropertyAgentUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
    @Inject(MEMBERSHIPS_REPOSITORY)
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, engagementId: string, input: AssignPropertyAgentInput) {
    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: true,
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const membership = await this.membershipsRepository.findByUserIdAndTenantId(input.agentUserId, tenant.tenantId)

    if (!membership) {
      throw new BadRequestException('Agent is not a member of this tenant')
    }

    return this.propertyEngagementsRepository.assignAgent({
      tenantId: tenant.tenantId,
      engagementId,
      agentUserId: input.agentUserId,
      assignedByUserId: currentUser.id,
    })
  }
}
