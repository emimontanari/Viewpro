import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { ChangeFeedClient, DocumentReadUrlFetchError, TenantSummaryFetchError } from './change-feed.client'
import type { PlatformDocumentReadUrlResponse, PlatformTenantSummaryResponse } from './change-feed.client'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuditLogRepository } from './audit-log.repository'

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
  private readonly logger = new Logger(TenantDetailService.name)

  constructor(
    private readonly changeFeedClient: ChangeFeedClient,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

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

  /**
   * operator-activity-media (Slice 2a, D7): mints a fresh 5-minute signed
   * document read URL, then writes a native TENANT_DOCUMENT_VIEWED audit
   * entry — fail-closed: if the audit write fails, the URL is WITHHELD (the
   * caller only ever sees a 502) and the mint success does NOT leak to the
   * operator without an audit trail (spec: "Audit write fails").
   *
   * Error mapping (mirrors getTenantSummary's D8 pattern):
   *  - InmoView 404 (cross-tenant/missing version, D6) -> NotFoundException (404), no audit write
   *  - Any other non-2xx or unreachable                -> BadGatewayException (502), no audit write
   *  - Audit write throws AFTER a successful mint       -> BadGatewayException (502), URL withheld
   */
  async getDocumentReadUrl(
    tenantId: string,
    versionId: string,
    actor: { id: string; email: string },
  ): Promise<PlatformDocumentReadUrlResponse> {
    let result: PlatformDocumentReadUrlResponse
    try {
      result = await this.changeFeedClient.fetchDocumentReadUrl(tenantId, versionId)
    } catch (err) {
      if (err instanceof DocumentReadUrlFetchError && err.status === 404) {
        throw new NotFoundException('Document version not found')
      }

      throw new BadGatewayException('Failed to reach InmoView document-read-url endpoint')
    }

    try {
      await this.auditLogRepository.appendNative({
        action: 'TENANT_DOCUMENT_VIEWED',
        actor,
        target: { documentVersionId: versionId, filename: result.originalFilename },
        tenantId,
      })
    } catch (err) {
      // Fail-closed (spec: "Audit write fails"): the URL was successfully
      // minted but must NOT be returned without an audit trail. Logged for
      // operational visibility rather than silently discarded.
      this.logger.error(
        `Audit write failed for TENANT_DOCUMENT_VIEWED (tenantId=${tenantId}, versionId=${versionId}) — withholding the minted URL`,
        err instanceof Error ? err.stack : String(err),
      )
      throw new BadGatewayException('Failed to record document-view audit entry')
    }

    return result
  }
}
