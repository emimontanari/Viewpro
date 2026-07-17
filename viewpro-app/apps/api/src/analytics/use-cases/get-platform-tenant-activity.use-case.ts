import { Inject, Injectable } from '@nestjs/common'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../../documents/documents.repository'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../../movements/movements.repository'
import {
  mapActivityFeedDocumentRequest,
  mapActivityFeedMovement,
  type ActivityFeedItemResponse,
} from '../responses/activity-feed.response'
import { compareActivityItems } from './list-activity-feed.use-case'

/**
 * Sentinel userId passed to the movements/documents repositories. Both repos'
 * per-agent scoping is only applied when `canViewAll` is false (see
 * prisma-movements.repository.ts:329 and PrismaDocumentsRepository's activity
 * where-builder) — this use-case always passes `canViewAll: true`, so the
 * sentinel is a documented no-op, never used to scope any query.
 */
const PLATFORM_INTERNAL_USER_ID = 'platform-internal'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 20

export type GetPlatformTenantActivityInput = {
  tenantId: string
  offset?: number
  limit?: number
}

export type GetPlatformTenantActivityResponse = {
  total: number
  items: ActivityFeedItemResponse[]
}

/**
 * GetPlatformTenantActivityUseCase — platform-only, on-demand merged
 * (Movement + DocumentRequest) activity feed for an explicit tenantId.
 *
 * Design D3 (platform-tenant-tracking): cannot reuse `ListActivityFeedUseCase`
 * directly — its signature requires `TenantContext` + `CurrentUser` and
 * enforces human permission checks plus per-user assignment scoping, which is
 * semantically wrong for a platform caller with no acting user. This use-case
 * composes the two repositories directly with `canViewAll: true`, which
 * bypasses the per-agent filter entirely, and reuses the existing pure
 * mappers + sort comparator — no query-logic duplication.
 */
@Injectable()
export class GetPlatformTenantActivityUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: GetPlatformTenantActivityInput): Promise<GetPlatformTenantActivityResponse> {
    const limit = input.limit ?? DEFAULT_LIMIT
    const offset = input.offset ?? DEFAULT_OFFSET
    const page = Math.floor(offset / limit) + 1
    const pageSize = limit

    const [movementFeed, documentFeed] = await Promise.all([
      this.movementsRepository.findManyByTenant({
        tenantId: input.tenantId,
        userId: PLATFORM_INTERNAL_USER_ID,
        canViewAll: true,
        page,
        pageSize,
      }),
      this.documentsRepository.listActivityRequests({
        tenantId: input.tenantId,
        viewerUserId: PLATFORM_INTERNAL_USER_ID,
        canViewAll: true,
        page,
        pageSize,
      }),
    ])

    const items = [
      ...movementFeed.items.map(mapActivityFeedMovement),
      ...documentFeed.items.map(mapActivityFeedDocumentRequest),
    ].sort(compareActivityItems)

    return {
      total: movementFeed.total + documentFeed.total,
      items,
    }
  }
}
