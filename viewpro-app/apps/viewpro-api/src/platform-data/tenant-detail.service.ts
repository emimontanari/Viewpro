import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ChangeFeedClient, TenantSummaryFetchError } from './change-feed.client'
import type { PlatformTenantSummaryResponse } from './change-feed.client'

/**
 * TenantDetailService — on-demand passthrough of a single tenant's summary
 * (platform-tenant-tracking, D8).
 *
 * Calls InmoView's signed internal endpoint via `ChangeFeedClient` and
 * returns the result AS-IS — never persisted in any ViewPro table.
 *
 * Error mapping:
 *  - InmoView 404 (unknown tenant)      -> NotFoundException (404)
 *  - Any other non-2xx or unreachable   -> BadGatewayException (502)
 */
@Injectable()
export class TenantDetailService {
  constructor(private readonly changeFeedClient: ChangeFeedClient) {}

  async getTenantSummary(
    tenantId: string,
    offset: number,
    limit: number,
  ): Promise<PlatformTenantSummaryResponse> {
    try {
      return await this.changeFeedClient.fetchTenantSummary(tenantId, offset, limit)
    } catch (err) {
      if (err instanceof TenantSummaryFetchError && err.status === 404) {
        throw new NotFoundException('Tenant not found')
      }

      throw new BadGatewayException('Failed to reach InmoView tenant-summary endpoint')
    }
  }
}
