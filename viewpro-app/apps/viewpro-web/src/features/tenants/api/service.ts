// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import { parseLimitsResponse, parseStatusResponse } from './schemas';
import type {
  AdminTenantLimitsUpdateResponse,
  AdminTenantStatusUpdateResponse,
  TenantListResponse,
  UpdateTenantLimitsPayload,
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
