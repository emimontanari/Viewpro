import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListPropertyEngagementsQuery } from '../dto/list-property-engagements.query'
import { PROPERTY_ENGAGEMENTS_REPOSITORY, type PropertyEngagementsRepository } from '../property-engagements.repository'
import { mapPropertyEngagement, type PropertyEngagementResponse } from '../responses/property-engagement.response'

export type ListPropertyEngagementsResponse = {
  items: PropertyEngagementResponse[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class ListPropertyEngagementsUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    query: ListPropertyEngagementsQuery,
  ): Promise<ListPropertyEngagementsResponse> {
    const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
    const canViewAssigned = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)

    if (!canViewAll && !canViewAssigned) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const result = await this.propertyEngagementsRepository.findMany({
      tenantId: tenant.tenantId,
      userId: currentUser.id,
      canViewAll,
      page,
      pageSize,
      status: query.status,
      operationType: query.operationType,
      archived: query.archived,
    })

    return {
      items: result.items.map(mapPropertyEngagement),
      total: result.total,
      page,
      pageSize,
    }
  }
}
