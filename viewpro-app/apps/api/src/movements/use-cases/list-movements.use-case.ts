import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../../property-engagements/property-engagements.repository'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListMovementsQuery } from '../dto/list-movements.query'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../movements.repository'
import { mapMovement, type MovementResponse } from '../responses/movement.response'

export type ListMovementsResponse = {
  items: MovementResponse[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class ListMovementsUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    query: ListMovementsQuery,
  ): Promise<ListMovementsResponse> {
    const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
    const canViewAssigned = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)

    if (!canViewAll && !canViewAssigned) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.propertyEngagementsRepository.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll,
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const result = await this.movementsRepository.findMany({
      tenantId: tenant.tenantId,
      propertyEngagementId: engagementId,
      page,
      pageSize,
      order: query.order ?? 'desc',
    })

    return {
      items: result.items.map(mapMovement),
      total: result.total,
      page,
      pageSize,
    }
  }
}
