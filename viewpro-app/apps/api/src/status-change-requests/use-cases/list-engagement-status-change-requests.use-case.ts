import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from '../../property-engagements/property-engagements.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  STATUS_CHANGE_REQUESTS_REPOSITORY,
  type StatusChangeRequestsRepository,
} from '../status-change-requests.repository'
import { mapStatusChangeRequest, type StatusChangeRequestResponse } from '../responses/status-change-request.response'

/** Minimal shape the use case needs from PropertyEngagementsRepository */
type EngagementForList = {
  id: string
  tenantId: string
  agents: Array<{ agentUserId: string }>
}

type EngagementsRepoPort = {
  findByIdForTenant(input: {
    tenantId: string
    engagementId: string
    userId: string
    canViewAll: boolean
  }): Promise<EngagementForList | null>
}

@Injectable()
export class ListEngagementStatusChangeRequestsUseCase {
  constructor(
    @Inject(STATUS_CHANGE_REQUESTS_REPOSITORY)
    private readonly repo: StatusChangeRequestsRepository,
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly engagementsRepo: EngagementsRepoPort,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
  ): Promise<StatusChangeRequestResponse[]> {
    const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
    const canViewAssigned = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)

    if (!canViewAll && !canViewAssigned) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.engagementsRepo.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll,
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    // Visibility: manager (canViewAll) OR assigned seller (FR-8/FR-3)
    if (!canViewAll) {
      const isAssigned = engagement.agents.some((a) => a.agentUserId === currentUser.id)
      if (!isAssigned) {
        throw new ForbiddenException('Insufficient permissions')
      }
    }

    const records = await this.repo.listByEngagementForTenant({
      engagementId,
      tenantId: tenant.tenantId,
    })

    // Sorted createdAt DESC per FR-8
    return records.map(mapStatusChangeRequest)
  }
}
