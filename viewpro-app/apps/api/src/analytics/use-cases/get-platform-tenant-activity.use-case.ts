import { Inject, Injectable } from '@nestjs/common'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../../documents/documents.repository'
import {
  MEMBERSHIP_ACTIVITY_REPOSITORY,
  type MembershipActivityRepository,
} from '../../memberships/membership-activity.repository'
import { MOVEMENTS_REPOSITORY, type MovementsRepository } from '../../movements/movements.repository'
import {
  mapActivityFeedDocumentRequest,
  mapActivityFeedMembership,
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

/**
 * Hard upper bound on how many rows are fetched from EACH stream in a single
 * request. The merged-feed fix fetches `offset + limit` rows per stream to
 * build a correctly ordered combined page; without a cap, a large `offset`
 * would push the Prisma `take` unbounded (DoS). Deep pages beyond this window
 * degrade to empty rather than an unbounded query. Callers already clamp
 * `limit` to 100 (controller sanitizers), so this only guards against a huge
 * `offset`.
 */
const MAX_FETCH_WINDOW = 200

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
 * (Movement + DocumentRequest + MembershipActivity) activity feed for an
 * explicit tenantId.
 *
 * Design D3 (platform-tenant-tracking): cannot reuse `ListActivityFeedUseCase`
 * directly — its signature requires `TenantContext` + `CurrentUser` and
 * enforces human permission checks plus per-user assignment scoping, which is
 * semantically wrong for a platform caller with no acting user. This use-case
 * composes the repositories directly with `canViewAll: true`, which bypasses
 * the per-agent filter entirely, and reuses the existing pure mappers + sort
 * comparator — no query-logic duplication.
 *
 * platform-user-activity-capture (D2): extended from a 2-source to a
 * 3-source merge by adding `MembershipActivityRepository` (derived
 * INVITED/JOINED/DEACTIVATED events, zero new writes/migration). The
 * "global top-K ⊆ union of each stream's local top-K" invariant documented
 * below generalizes to any finite number of sorted-desc streams, so adding a
 * third source requires no change to the bounding/slicing logic itself.
 */
@Injectable()
export class GetPlatformTenantActivityUseCase {
  constructor(
    @Inject(MOVEMENTS_REPOSITORY)
    private readonly movementsRepository: MovementsRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(MEMBERSHIP_ACTIVITY_REPOSITORY)
    private readonly membershipActivityRepository: MembershipActivityRepository,
  ) {}

  async execute(input: GetPlatformTenantActivityInput): Promise<GetPlatformTenantActivityResponse> {
    const limit = input.limit ?? DEFAULT_LIMIT
    const offset = Math.max(input.offset ?? DEFAULT_OFFSET, 0)

    // Each stream is independently paginated, so to produce a correctly ordered
    // combined page for [offset, offset+limit) we fetch the [0, offset+limit)
    // window from EACH stream (page 1), merge, sort, and slice — mirroring
    // ListActivityFeedUseCase's merged "all" branch. The window is bounded by
    // MAX_FETCH_WINDOW so a large offset can never make the Prisma `take`
    // unbounded (DoS guard).
    //
    // Invariant: the global top-N is a subset of (movements' top-N ∪ documents'
    // top-N ∪ membership-events' top-N) — this holds for any finite number of
    // sorted-desc streams, not just two — so the FIRST `pageSize` positions of
    // the merged/sorted array are the true global order — but positions BEYOND
    // `pageSize` are NOT reliable (rows that truly rank there may never have
    // been fetched). The slice upper bound is therefore capped at `pageSize`
    // (the fetched window), NEVER `offset + limit`. Consequences: a full page
    // when offset+limit <= window; a correct PARTIAL last page when
    // offset < window < offset+limit; an EMPTY page when offset >= window. The
    // feed is thus browsable only to the MAX_FETCH_WINDOW most-recent merged
    // items; deeper pages return empty — never wrong/unrelated items. `total`
    // remains the true combined count and MAY exceed the browsable window: a
    // known, honest depth limit, not silent corruption.
    const pageSize = Math.min(offset + limit, MAX_FETCH_WINDOW)

    const [movementFeed, documentFeed, membershipFeed] = await Promise.all([
      this.movementsRepository.findManyByTenant({
        tenantId: input.tenantId,
        userId: PLATFORM_INTERNAL_USER_ID,
        canViewAll: true,
        page: 1,
        pageSize,
      }),
      this.documentsRepository.listActivityRequests({
        tenantId: input.tenantId,
        viewerUserId: PLATFORM_INTERNAL_USER_ID,
        canViewAll: true,
        page: 1,
        pageSize,
      }),
      this.membershipActivityRepository.findManyByTenant({
        tenantId: input.tenantId,
        page: 1,
        pageSize,
      }),
    ])

    const items = [
      ...movementFeed.items.map(mapActivityFeedMovement),
      ...documentFeed.items.map(mapActivityFeedDocumentRequest),
      ...membershipFeed.items.map(mapActivityFeedMembership),
    ]
      .sort(compareActivityItems)
      .slice(offset, pageSize)

    return {
      total: movementFeed.total + documentFeed.total + membershipFeed.total,
      items,
    }
  }
}
