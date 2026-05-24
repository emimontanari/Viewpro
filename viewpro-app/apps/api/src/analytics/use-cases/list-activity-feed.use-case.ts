import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../../documents/documents.repository'
import { MOVEMENTS_REPOSITORY, type ActivityFeedCounters, type MovementsRepository } from '../../movements/movements.repository'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListActivityFeedQuery } from '../dto/list-activity-feed.query'
import {
  mapActivityFeedDocumentRequest,
  mapActivityFeedMovement,
  type ActivityFeedItemResponse,
} from '../responses/activity-feed.response'

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
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
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
    const queryKind = query.kind ?? 'all'
    const from = query.dateFrom ? new Date(query.dateFrom) : undefined
    const to = query.dateTo ? new Date(query.dateTo) : undefined
    const takeForMerge = page * pageSize
    const movementOnly = queryKind === 'movement' || (queryKind === 'all' && Boolean(query.type))
    const documentOnly = queryKind === 'document_request'
    const includeMovements = queryKind === 'all' || queryKind === 'movement'
    const includeDocuments = queryKind === 'document_request' || (queryKind === 'all' && !query.type)
    const canViewAllDocuments = tenant.permissions.includes(PERMISSIONS.DOCUMENTS_VIEW_ALL)
    const canViewOwnDocuments =
      tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REQUEST) ||
      tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)

    const [movementFeed, documentFeed, counters] = await Promise.all([
      includeMovements
        ? this.movementsRepository.findManyByTenant({
            tenantId: tenant.tenantId,
            userId: currentUser.id,
            canViewAll,
            page: movementOnly ? page : 1,
            pageSize: movementOnly ? pageSize : takeForMerge,
            type: query.type,
            createdByUserId: query.sellerId,
            from,
            to,
          })
        : Promise.resolve({ items: [], total: 0 }),
      includeDocuments && (canViewAllDocuments || canViewOwnDocuments)
        ? this.documentsRepository.listActivityRequests({
            tenantId: tenant.tenantId,
            viewerUserId: currentUser.id,
            canViewAll: canViewAllDocuments,
            page: documentOnly ? page : 1,
            pageSize: documentOnly ? pageSize : takeForMerge,
            requestedByUserId: query.sellerId,
            from,
            to,
          })
        : Promise.resolve({ items: [], total: 0 }),
      this.movementsRepository.getActivityCounters({
        tenantId: tenant.tenantId,
        userId: currentUser.id,
        canViewAll,
        now,
      }),
    ])

    const movementItems = movementFeed.items.map(mapActivityFeedMovement)
    const documentItems = documentFeed.items.map(mapActivityFeedDocumentRequest)
    const total = movementFeed.total + documentFeed.total
    const items =
      queryKind === 'all' && !query.type
        ? [...movementItems, ...documentItems]
            .sort((left, right) => compareActivityItems(left, right))
            .slice((page - 1) * pageSize, page * pageSize)
        : [...movementItems, ...documentItems]

    return {
      total,
      page,
      pageSize,
      counters,
      items,
    }
  }
}

function compareActivityItems(left: ActivityFeedItemResponse, right: ActivityFeedItemResponse) {
  const createdAtDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()

  if (createdAtDifference !== 0) {
    return createdAtDifference
  }

  return right.id.localeCompare(left.id)
}
