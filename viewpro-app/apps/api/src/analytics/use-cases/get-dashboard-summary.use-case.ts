import { Inject, Injectable } from '@nestjs/common'
import { MovementType } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../../documents/documents.repository'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../../movements/movements.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { ANALYTICS_REPOSITORY, type AnalyticsRepository } from '../analytics.repository'
import type { DashboardSummaryRange } from '../dto/get-dashboard-summary.query'
import {
  mapActivityFeedDocumentRequest,
  mapActivityFeedMovement,
  type ActivityFeedItemResponse,
} from '../responses/activity-feed.response'
import type { DashboardSummaryResponse } from '../responses/dashboard-summary.response'

const RANGE_DAYS: Record<DashboardSummaryRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
}
const RECENT_ACTIVITY_LIMIT = 5
const INSIGHT_LIMIT = 3
const ATTENTION_MOVEMENT_TYPES = [MovementType.INQUIRY, MovementType.VISIT_COMPLETED, MovementType.OFFER_RECEIVED]

export type GetDashboardSummaryInput = {
  range?: DashboardSummaryRange
  now?: Date
}

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepository,
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    input: GetDashboardSummaryInput = {},
  ): Promise<DashboardSummaryResponse> {
    const preset = input.range ?? '7d'
    const window = resolveDashboardWindow(preset, input.now)
    const canViewAllDocuments = tenant.permissions.includes(PERMISSIONS.DOCUMENTS_VIEW_ALL)

    const [
      activeProperties,
      movementsInRange,
      staleProperties,
      attentionNeeded,
      topProperties,
      topSellers,
      movementActivity,
      documentActivity,
    ] = await Promise.all([
      this.analyticsRepository.countActiveEngagements({ tenantId: tenant.tenantId }),
      this.analyticsRepository.countMovementsInWindow({ tenantId: tenant.tenantId, ...window }),
      this.analyticsRepository.countActiveEngagementsWithoutRecentMovement({ tenantId: tenant.tenantId, ...window }),
      this.analyticsRepository.countActiveEngagementsNeedingAttention({
        tenantId: tenant.tenantId,
        ...window,
        movementTypes: ATTENTION_MOVEMENT_TYPES,
      }),
      this.analyticsRepository.listTopPropertiesByActivity({
        tenantId: tenant.tenantId,
        ...window,
        limit: INSIGHT_LIMIT,
      }),
      this.analyticsRepository.listTopSellersByMovement({
        tenantId: tenant.tenantId,
        ...window,
        limit: INSIGHT_LIMIT,
      }),
      this.movementsRepository.findManyByTenant({
        tenantId: tenant.tenantId,
        userId: currentUser.id,
        canViewAll: true,
        page: 1,
        pageSize: RECENT_ACTIVITY_LIMIT,
        from: window.from,
        to: window.to,
      }),
      canViewAllDocuments
        ? this.documentsRepository.listActivityRequests({
            tenantId: tenant.tenantId,
            viewerUserId: currentUser.id,
            canViewAll: true,
            page: 1,
            pageSize: RECENT_ACTIVITY_LIMIT,
            from: window.from,
            to: window.to,
            activeEngagementsOnly: true,
          })
        : Promise.resolve({ items: [], total: 0 }),
    ])

    return {
      range: {
        preset,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
      },
      counters: {
        activeProperties,
        movementsInRange,
        staleProperties,
        attentionNeeded,
      },
      recentActivity: [...movementActivity.items.map(mapActivityFeedMovement), ...documentActivity.items.map(mapActivityFeedDocumentRequest)]
        .sort(compareActivityItems)
        .slice(0, RECENT_ACTIVITY_LIMIT),
      topProperties: topProperties.map((property) => ({
        ...property,
        lastActivityAt: property.lastActivityAt.toISOString(),
      })),
      topSellers: topSellers.map((seller) => ({
        ...seller,
        lastMovementAt: seller.lastMovementAt.toISOString(),
      })),
    }
  }
}

function resolveDashboardWindow(range: DashboardSummaryRange, now = new Date()) {
  const to = new Date(now)
  const from = new Date(to.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)

  return { from, to }
}

function compareActivityItems(left: ActivityFeedItemResponse, right: ActivityFeedItemResponse) {
  const createdAtDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()

  if (createdAtDifference !== 0) {
    return createdAtDifference
  }

  return right.id.localeCompare(left.id)
}
