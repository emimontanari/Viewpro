// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import { parseAuditFeedResponse } from './schemas';
import type { AuditFeedResponse, AuditFilters } from './types';

/**
 * Fetch a page of the operator global audit feed from viewpro-api.
 *
 * Endpoint: GET /operators/audit?offset&limit&<filters>
 * Auth: viewpro_platform_access_token cookie (credentials:include set by apiRequest).
 * Global feed only, sorted occurredAt DESC (newest-first) as served by the
 * API; `limit` is capped at 200 server-side.
 *
 * audit-view (Slice 3, Phase 3) — `filters` threads the server-side filter
 * params (design D5/D6) through to the query string. Omitted/empty filters
 * produce the exact same request as before this slice (no behavior change
 * for existing callers); the filter bar that populates them is Slice 4.
 */
export async function getAuditFeed(
  offset: number,
  limit: number,
  filters: AuditFilters = {}
): Promise<AuditFeedResponse> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });

  if (filters.action) params.set('action', filters.action);
  if (filters.source) params.set('source', filters.source);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);
  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  const raw = await apiRequest<unknown>(`/operators/audit?${params.toString()}`);

  return parseAuditFeedResponse(raw);
}
