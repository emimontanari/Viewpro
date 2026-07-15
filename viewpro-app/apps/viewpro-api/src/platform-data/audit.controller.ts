import { Controller, Get, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuditService } from './audit.service'
import type { AuditFeedList } from './audit.service'

const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 50

/**
 * Sanitize an offset query param: default 0; must be a finite integer >= 0.
 * Malformed input (`abc` → NaN, `-1` → negative, `1.5` → non-integer) degrades
 * to the default rather than reaching Prisma `skip` and throwing a 500.
 */
function sanitizeOffset(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_OFFSET
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_OFFSET
}

/**
 * Sanitize a limit query param: default 50; must be a finite integer >= 1.
 * Malformed input degrades to the default. The 200 cap (A9) stays enforced by
 * AuditService.
 */
function sanitizeLimit(raw?: string): number {
  const parsed = raw !== undefined ? Number(raw) : DEFAULT_LIMIT
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_LIMIT
}

/**
 * AuditController — operator-facing global audit feed (A9/A10).
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie).
 * Serves data EXCLUSIVELY from `platform_audit_log` — never from InmoView.
 *
 * Q3: no `tenantId` query param — the feed is intentionally global-only; any
 * such param is accepted but ignored (no filtering effect).
 */
@Controller('operators/audit')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /operators/audit?offset=<n>&limit=<n>
   *
   * Returns `{ total, items }` sorted by seqNo DESC (newest first).
   * Defaults: offset=0, limit=50 (capped at 200 — A9).
   */
  @Get()
  async list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<AuditFeedList> {
    return this.auditService.listAudit(sanitizeOffset(offset), sanitizeLimit(limit))
  }
}
