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

const DEFAULT_APP_URL = 'http://localhost:3000';
const ADMIN_API_PATH = '/api/admin';
const ADMIN_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export function getAdminSummary(init: RequestInit = {}): Promise<AdminSummary> {
  return apiFetchJson<AdminSummary>(`${ADMIN_API_PATH}/summary`, init);
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

  return apiFetchJson<AdminTenantsResponse>(`${ADMIN_API_PATH}/tenants?${searchParams}`, init);
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

  return apiFetchJson<AdminActivityListResponse>(
    `${ADMIN_API_PATH}/activity?${searchParams}`,
    init
  );
}

export function updateAdminTenantStatus(
  tenantId: string,
  payload: UpdateAdminTenantStatusPayload
): Promise<AdminTenantStatusUpdateResponse> {
  return apiFetchJson<AdminTenantStatusUpdateResponse>(
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
  return apiFetchJson<AdminTenantLimitsUpdateResponse>(
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

async function apiFetchJson<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  const response = await apiFetch(path, init);
  return parseJsonResponse<TResponse>(response);
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud admin tardó demasiado.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
}

function getFetchUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://') || typeof window !== 'undefined') {
    return path;
  }

  return `${APP_URL}${path}`;
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return fallback || 'No se pudo cargar el admin.';
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
