import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaOutboxRepository } from './platform-outbox.repository'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformTenantsReadRepository } from './platform-tenants-read.repository'
import { PlatformControlGuard } from '../platform-control/platform-control.guard'
import type { ChangeFeedResponse } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { TenantRegistryItem } from './platform-tenants-read.repository'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { GetPilotSummaryUseCase } from '../analytics/use-cases/get-pilot-summary.use-case'
import type { PilotSummaryResponse } from '../analytics/use-cases/get-pilot-summary.use-case'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { GetPlatformTenantActivityUseCase } from '../analytics/use-cases/get-platform-tenant-activity.use-case'
import type { GetPlatformTenantActivityResponse } from '../analytics/use-cases/get-platform-tenant-activity.use-case'

const DEFAULT_SUMMARY_ACTIVITY_OFFSET = 0
const DEFAULT_SUMMARY_ACTIVITY_LIMIT = 20
// Hard ceiling on the activity page size — an authenticated caller must not be
// able to request an arbitrarily large limit that becomes an unbounded Prisma
// `take` (DoS). Requests above the cap silently degrade to MAX_SUMMARY_ACTIVITY_LIMIT.
const MAX_SUMMARY_ACTIVITY_LIMIT = 100

/**
 * Sanitize an offset query param: default 0; must be a finite integer >= 0.
 * Malformed input degrades to the default rather than reaching a repository
 * `skip` with a NaN/negative value.
 */
function sanitizeSummaryOffset(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_SUMMARY_ACTIVITY_OFFSET
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_SUMMARY_ACTIVITY_OFFSET
}

/**
 * Sanitize a limit query param: default 20; clamped to [1, MAX_SUMMARY_ACTIVITY_LIMIT].
 * Malformed input degrades to the default; an over-max value degrades to the cap.
 */
function sanitizeSummaryLimit(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_SUMMARY_ACTIVITY_LIMIT
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_SUMMARY_ACTIVITY_LIMIT
  }
  return Math.min(Math.floor(parsed), MAX_SUMMARY_ACTIVITY_LIMIT)
}

/**
 * Response shape for GET /internal/platform/tenants/:id/summary.
 * Counts mirror `PilotSummaryResponse` exactly (including the 4-field
 * `documentEvents` shape, D2) plus one page of the merged activity feed.
 *
 * No `packages/platform-contract` type — FE-owned mirrored types are the
 * established convention for this wire shape (design D6).
 */
export type PlatformTenantSummaryResponse = PilotSummaryResponse & {
  activity: GetPlatformTenantActivityResponse
}

/**
 * PlatformDataController — read-side change-feed for the data lane.
 *
 * GET /internal/platform/changes?since=<seqNo>
 *   Returns a bounded batch of outbox events with seqNo > since, ordered
 *   by seqNo ASC. Protected by PlatformControlGuard (same HS256 service JWT
 *   as the control lane — guard reused by import, not module merge, per D2).
 *
 * Response: ChangeFeedResponse { events, nextCursor }
 *   - nextCursor = max seqNo in the returned batch, or the supplied since when empty.
 *   - seqNo values are converted from BigInt to number (JSON-safe, 2^53 caveat noted).
 *
 * This endpoint is READ-ONLY. It MUST NOT mutate any outbox row (D1 invariant).
 * Trust isolation: request.user is NEVER set on this path (PlatformControlGuard
 * sets platformCaller only).
 */
@Controller('internal/platform')
@UseGuards(PlatformControlGuard)
export class PlatformDataController {
  constructor(
    private readonly outboxRepository: PrismaOutboxRepository,
    private readonly tenantsReadRepository: PlatformTenantsReadRepository,
    private readonly getPilotSummaryUseCase: GetPilotSummaryUseCase,
    private readonly getPlatformTenantActivityUseCase: GetPlatformTenantActivityUseCase,
  ) {}

  /**
   * GET /internal/platform/changes?since=<seqNo>
   *
   * Fetches outbox events after the given cursor.
   * - `since` defaults to 0 when absent or NaN/negative.
   * - Batch size is capped to `PLATFORM_DATA_BATCH_LIMIT` (default 100).
   * - seqNo values in the response are plain numbers (BigInt safely cast, 2^53 caveat).
   */
  @Get('changes')
  async getChanges(@Query('since') sinceParam?: string): Promise<ChangeFeedResponse> {
    const parsed = sinceParam !== undefined ? Number(sinceParam) : NaN
    const cursor = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0

    const batchLimitEnv = Number(process.env.PLATFORM_DATA_BATCH_LIMIT)
    const batchSize = Number.isFinite(batchLimitEnv) && batchLimitEnv > 0 ? batchLimitEnv : 100

    const events = await this.outboxRepository.findSince(cursor, batchSize)

    const nextCursor =
      events.length > 0
        ? Math.max(...events.map((e) => e.seqNo))
        : cursor

    return { events, nextCursor }
  }

  /**
   * GET /internal/platform/tenants
   *
   * Returns all tenants with identity + limits for the one-time backfill seed
   * that viewpro-api calls to populate its platform_tenants projection (A13).
   *
   * Protected by PlatformControlGuard (same HS256 service token as the change-feed).
   * READ-ONLY: never writes any row.
   *
   * // TODO: add paging if tenant count exceeds 1 000
   */
  @Get('tenants')
  async getTenants(): Promise<{ tenants: TenantRegistryItem[] }> {
    const tenants = await this.tenantsReadRepository.findAll()
    return { tenants }
  }

  /**
   * GET /internal/platform/tenants/:id/summary?offset=<n>&limit=<n>
   *
   * Composes the existing GetPilotSummaryUseCase (counts, unchanged) with the
   * new GetPlatformTenantActivityUseCase (one page of the merged activity
   * feed) for an EXPLICIT :id path param — never a session-derived tenantId
   * (platform-tenant-tracking D1/D3/D4).
   *
   * 404 pre-check via `findById`: aggregate count queries silently return 0
   * for an unknown tenant id, so they cannot detect "not found" on their own.
   *
   * Protected by PlatformControlGuard (class-level, unchanged) — this route
   * adds NO new guard wiring. Trust isolation: request.user is NEVER set on
   * this path.
   */
  @Get('tenants/:id/summary')
  async getTenantSummary(
    @Param('id') id: string,
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
  ): Promise<PlatformTenantSummaryResponse> {
    const tenant = await this.tenantsReadRepository.findById(id)

    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }

    const offset = sanitizeSummaryOffset(offsetParam)
    const limit = sanitizeSummaryLimit(limitParam)

    const [summary, activity] = await Promise.all([
      this.getPilotSummaryUseCase.execute({ tenantId: id }),
      this.getPlatformTenantActivityUseCase.execute({ tenantId: id, offset, limit }),
    ])

    return { ...summary, activity }
  }
}
