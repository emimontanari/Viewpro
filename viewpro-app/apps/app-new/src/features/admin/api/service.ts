import { bffRequest } from '@/lib/bff-client';
import type {
  AdminActivityListResponse,
  AdminDashboardData,
  AdminSummary,
  AdminTenantLimitsUpdateResponse,
  AdminTenantStatusUpdateResponse,
  AdminTenantsResponse,
  ListAdminActivityInput,
  ListAdminTenantsInput,
  UpdateAdminTenantLimitsPayload,
  UpdateAdminTenantStatusPayload
} from './types';

const ADMIN_API_PATH = '/api/admin';
const ADMIN_REQUEST_TIMEOUT_MS = 10_000;

function adminRequest<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  return bffRequest<TResponse>(path, init, { timeoutMs: ADMIN_REQUEST_TIMEOUT_MS });
}

export function getAdminSummary(init: RequestInit = {}): Promise<AdminSummary> {
  return adminRequest<AdminSummary>(`${ADMIN_API_PATH}/summary`, init);
}

export function listAdminTenants(
  input: ListAdminTenantsInput,
  init: RequestInit = {}
): Promise<AdminTenantsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(input.page));
  searchParams.set('pageSize', String(input.pageSize));

  if (input.status) {
    searchParams.set('status', input.status);
  }

  return adminRequest<AdminTenantsResponse>(`${ADMIN_API_PATH}/tenants?${searchParams}`, init);
}

export function listAdminActivity(
  input: ListAdminActivityInput,
  init: RequestInit = {}
): Promise<AdminActivityListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(input.page));
  searchParams.set('pageSize', String(input.pageSize));

  if (input.tenantId) {
    searchParams.set('tenantId', input.tenantId);
  }

  return adminRequest<AdminActivityListResponse>(
    `${ADMIN_API_PATH}/activity?${searchParams}`,
    init
  );
}

export function updateAdminTenantStatus(
  tenantId: string,
  payload: UpdateAdminTenantStatusPayload
): Promise<AdminTenantStatusUpdateResponse> {
  return adminRequest<AdminTenantStatusUpdateResponse>(
    `${ADMIN_API_PATH}/tenants/${encodeURIComponent(tenantId)}/status`,
    {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    }
  );
}

export function updateAdminTenantLimits(
  tenantId: string,
  payload: UpdateAdminTenantLimitsPayload
): Promise<AdminTenantLimitsUpdateResponse> {
  return adminRequest<AdminTenantLimitsUpdateResponse>(
    `${ADMIN_API_PATH}/tenants/${encodeURIComponent(tenantId)}/limits`,
    {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    }
  );
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [summary, tenants, activity] = await Promise.all([
    getAdminSummary(),
    listAdminTenants({ page: 1, pageSize: 10 }),
    listAdminActivity({ page: 1, pageSize: 10 })
  ]);

  return { activity, summary, tenants };
}
