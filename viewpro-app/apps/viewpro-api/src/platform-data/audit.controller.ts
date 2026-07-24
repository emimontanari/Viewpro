import { Controller, Get, Query, UseGuards } from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuthGuard } from '../auth/guards/auth.guard'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { PlatformPermissionGuard } from '../permissions/platform-permission.guard'
import { PLATFORM_PERMISSIONS } from '../permissions/platform-permissions.constants'
import { RequirePlatformPermission } from '../permissions/require-platform-permission.decorator'
// biome-ignore lint/style/useImportType: Nest DI needs runtime metadata.
import { AuditService } from './audit.service'
import type { AuditFeedList, AuditFilters } from './audit.service'

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
 * audit-view (Slice 2, Phase 2), design D6 — trim-and-passthrough sanitizer
 * for `action`/`tenantId`/`actorId`: these are free-form Prisma columns (not
 * enums), so there is no allowlist to validate against. An empty/whitespace-
 * only value degrades to `undefined` (filter omitted) instead of being
 * applied as a literal empty-string match. A syntactically valid but
 * non-existent value (e.g. `?action=NOT_A_REAL_ACTION`) is intentionally NOT
 * rejected here — it passes through as a literal filter value and simply
 * matches zero rows at the Prisma layer, which still satisfies "never 500"
 * (Scenario: malformed filter degrades) without requiring an action
 * allowlist. Mirrors the degrade-not-throw posture of sanitizeOffset/
 * sanitizeLimit above.
 */
export function sanitizeTrimmedFilter(raw?: string): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * audit-view (Slice 2, Phase 2), design D6 — `source` IS allowlisted
 * (`INMOVIEW_OUTBOX` | `VIEWPRO_NATIVE`, matches the Prisma enum). Any other
 * value — including empty, whitespace, or an unrecognized string — degrades
 * to `undefined` (filter omitted), never a 400.
 */
export function sanitizeSource(raw?: string): AuditFilters['source'] {
  return raw === 'INMOVIEW_OUTBOX' || raw === 'VIEWPRO_NATIVE' ? raw : undefined
}

/**
 * audit-view (Slice 2, Phase 2), design D6 — parses via `new Date(x)`; a
 * missing, non-ISO, or otherwise unparseable value degrades to `undefined`
 * (filter omitted), never a 400 (Scenario: malformed filter degrades).
 */
export function sanitizeDate(raw?: string): Date | undefined {
  if (raw === undefined) {
    return undefined
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * AuditController — operator-facing global audit feed (A9/A10).
 *
 * Protected by Phase 4 AuthGuard (viewpro_platform_access_token cookie) and
 * PlatformPermissionGuard (D4 — operator-platform-roles).
 * Serves data EXCLUSIVELY from `platform_audit_log` — never from InmoView.
 *
 * audit-view (Slice 2, Phase 2), design D14: supersedes the earlier
 * "global-only" restriction (former Q3 note) — `action`/`source`/`tenantId`/
 * `actorId`/`dateFrom`/`dateTo` are now accepted and applied as an
 * AND-combined server-side filter (design D5/D6); `total` reflects the
 * filtered count (design D7).
 */
@Controller('operators/audit')
@UseGuards(AuthGuard, PlatformPermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /operators/audit?offset=<n>&limit=<n>&action=<a>&source=<s>&tenantId=<t>&actorId=<a>&dateFrom=<d>&dateTo=<d>
   *
   * Returns `{ total, items }` sorted by occurredAt DESC (newest first),
   * `total` reflecting any applied filters. Defaults: offset=0, limit=50
   * (capped at 200 — A9). All filter params are optional and AND-combined;
   * a malformed filter value degrades to "not applied" rather than a 400
   * (design D6).
   */
  @Get()
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_READ)
  async list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('source') source?: string,
    @Query('tenantId') tenantId?: string,
    @Query('actorId') actorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<AuditFeedList> {
    return this.auditService.listAudit(sanitizeOffset(offset), sanitizeLimit(limit), {
      action: sanitizeTrimmedFilter(action),
      source: sanitizeSource(source),
      tenantId: sanitizeTrimmedFilter(tenantId),
      actorId: sanitizeTrimmedFilter(actorId),
      dateFrom: sanitizeDate(dateFrom),
      dateTo: sanitizeDate(dateTo),
    })
  }
}
