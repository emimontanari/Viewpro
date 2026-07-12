import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PROPERTY_ENGAGEMENTS_REPOSITORY, type PropertyEngagementsRepository } from '../property-engagements.repository'

export type RemovePropertyAgentResponse = {
  deleted: true
  id: string
}

@Injectable()
export class RemovePropertyAgentUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    agentId: string,
  ): Promise<RemovePropertyAgentResponse> {
    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL),
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const removed = await this.propertyEngagementsRepository.removeAgent({
      tenantId: tenant.tenantId,
      engagementId,
      agentId,
    })

    if (!removed) {
      throw new NotFoundException('Property agent assignment not found')
    }

    return { deleted: true, id: agentId }
  }
}
