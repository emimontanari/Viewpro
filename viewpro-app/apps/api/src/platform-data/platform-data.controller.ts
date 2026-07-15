import { Controller, Get, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PrismaOutboxRepository } from './platform-outbox.repository'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformTenantsReadRepository } from './platform-tenants-read.repository'
import { PlatformControlGuard } from '../platform-control/platform-control.guard'
import type { ChangeFeedResponse } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { TenantRegistryItem } from './platform-tenants-read.repository'

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
}
