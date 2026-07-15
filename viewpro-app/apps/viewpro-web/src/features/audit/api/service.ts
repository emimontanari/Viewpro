// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import { parseAuditFeedResponse } from './schemas';
import type { AuditFeedResponse } from './types';

/**
 * Fetch a page of the operator global audit feed from viewpro-api.
 *
 * Endpoint: GET /operators/audit?offset&limit
 * Auth: viewpro_platform_access_token cookie (credentials:include set by apiRequest).
 * Global feed only, sorted seqNo DESC (newest-first) as served by the API;
 * `limit` is capped at 200 server-side (Q3 — no per-tenant filter param).
 */
export async function getAuditFeed(offset: number, limit: number): Promise<AuditFeedResponse> {
  const raw = await apiRequest<unknown>(`/operators/audit?offset=${offset}&limit=${limit}`);

  return parseAuditFeedResponse(raw);
}
