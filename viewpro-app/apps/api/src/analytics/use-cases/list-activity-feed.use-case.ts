import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { MOVEMENTS_REPOSITORY, type ActivityFeedCounters, type MovementsRepository } from '../../movements/movements.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListActivityFeedQuery } from '../dto/list-activity-feed.query'
import { mapActivityFeedMovement, type ActivityFeedItemResponse } from '../responses/activity-feed.response'

export type ActivityFeedResponse = {
  total: number
  page: number
  pageSize: number
  counters: ActivityFeedCounters
  items: ActivityFeedItemResponse[]
}

@Injectable()
export class ListActivityFeedUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    query: ListActivityFeedQuery,
    now = new Date(),
  ): Promise<ActivityFeedResponse> {
    const canViewAll = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ALL)
    const canViewAssigned = tenant.permissions.includes(PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED)

    if (!canViewAll && !canViewAssigned) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const from = query.dateFrom ? new Date(query.dateFrom) : undefined
    const to = query.dateTo ? new Date(query.dateTo) : undefined

    const [feed, counters] = await Promise.all([
      this.movementsRepository.findManyByTenant({
        tenantId: tenant.tenantId,
        userId: currentUser.id,
        canViewAll,
        page,
        pageSize,
        type: query.type,
        createdByUserId: query.sellerId,
        from,
        to,
      }),
      this.movementsRepository.getActivityCounters({
        tenantId: tenant.tenantId,
        userId: currentUser.id,
        canViewAll,
        now,
      }),
    ])

    return {
      total: feed.total,
      page,
      pageSize,
      counters,
      items: feed.items.map(mapActivityFeedMovement),
    }
  }
}
