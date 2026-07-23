// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import { parseLimitsResponse, parseStatusResponse } from './schemas';
import type {
  AdminTenantLimitsUpdateResponse,
  AdminTenantStatusUpdateResponse,
  DocumentReadUrlResponse,
  TenantDetailResponse,
  TenantListResponse,
  UpdateTenantLimitsPayload,
  UpdateTenantPlanPayload,
  UpdateTenantStatusPayload
} from './types';

/**
 * Fetch a page of the operator tenant registry from viewpro-api.
 *
 * Endpoint: GET /operators/tenants?offset&limit
 * Auth: viewpro_platform_access_token cookie (credentials:include set by apiRequest).
 * Sorted name ASC as served by the API; `limit` is capped at 200 server-side.
 */
export async function getTenantList(offset: number, limit: number): Promise<TenantListResponse> {
  return apiRequest<TenantListResponse>(`/operators/tenants?offset=${offset}&limit=${limit}`);
}

/**
 * PATCH /operators/tenants/:id/status
 *
 * The server response is typed `unknown` (opaque InmoView control-lane
 * passthrough) — fetched as `unknown` then validated via zod (D4).
 */
export async function updateTenantStatus(
  tenantId: string,
  payload: UpdateTenantStatusPayload
): Promise<AdminTenantStatusUpdateResponse> {
  const raw = await apiRequest<unknown>(`/operators/tenants/${encodeURIComponent(tenantId)}/status`, {
    method: 'PATCH',
    body: payload
  });

  return parseStatusResponse(raw);
}

/**
 * PATCH /operators/tenants/:id/limits
 *
 * The server response is typed `unknown` (opaque InmoView control-lane
 * passthrough) — fetched as `unknown` then validated via zod (D4).
 */
export async function updateTenantLimits(
  tenantId: string,
  payload: UpdateTenantLimitsPayload
): Promise<AdminTenantLimitsUpdateResponse> {
  const raw = await apiRequest<unknown>(`/operators/tenants/${encodeURIComponent(tenantId)}/limits`, {
    method: 'PATCH',
    body: payload
  });

  return parseLimitsResponse(raw);
}

/**
 * PATCH /operators/tenants/:id/plan
 *
 * platform-manual-plans (Slice 4, Part 2) — assign a plan tier. The server
 * returns the SAME opaque limits-update passthrough shape as .../limits (the
 * controller forwards the limits-lane result verbatim) — reuses
 * parseLimitsResponse rather than a duplicate schema (D4/D6/D7).
 */
export async function assignTenantPlan(
  tenantId: string,
  payload: UpdateTenantPlanPayload
): Promise<AdminTenantLimitsUpdateResponse> {
  const raw = await apiRequest<unknown>(`/operators/tenants/${encodeURIComponent(tenantId)}/plan`, {
    method: 'PATCH',
    body: payload
  });

  return parseLimitsResponse(raw);
}

/**
 * Fetch a single tenant's counts + one page of its merged activity feed
 * (platform-tenant-tracking, D9).
 *
 * Endpoint: GET /operators/tenants/:id/summary?offset&limit
 * Auth: viewpro_platform_access_token cookie (credentials:include set by apiRequest).
 * Typed end-to-end (not zod-validated) — mirrors getTenantList's GET
 * precedent; only PATCH responses go through zod (InmoView's control-lane
 * PATCH responses are typed `unknown` server-side, this GET route is not).
 */
export async function getTenantDetail(
  tenantId: string,
  offset: number,
  limit: number
): Promise<TenantDetailResponse> {
  return apiRequest<TenantDetailResponse>(
    `/operators/tenants/${encodeURIComponent(tenantId)}/summary?offset=${offset}&limit=${limit}`
  );
}

/**
 * Mint a fresh signed read URL for a tenant's uploaded document version
 * (operator-activity-media, Slice 2b, D3/D6).
 *
 * Endpoint: GET /operators/tenants/:tenantId/document-versions/:versionId/read-url
 * Auth: viewpro_platform_access_token cookie; requires the operator-held
 * TENANT_DOCUMENTS_READ permission (403 if absent) — enforced server-side.
 * On-demand only: NEVER cached here — every call issues a fresh request, so a
 * stale/expired URL (5-min TTL) is simply re-minted on the next click.
 * Typed end-to-end (not zod-validated), mirrors the getTenantDetail GET
 * precedent above.
 */
export async function fetchDocumentReadUrl(
  tenantId: string,
  versionId: string
): Promise<DocumentReadUrlResponse> {
  return apiRequest<DocumentReadUrlResponse>(
    `/operators/tenants/${encodeURIComponent(tenantId)}/document-versions/${encodeURIComponent(versionId)}/read-url`
  );
}
