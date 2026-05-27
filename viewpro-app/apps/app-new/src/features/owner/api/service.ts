import type {
  OwnerEngagementsResponse,
  OwnerPropertiesResponse,
  OwnerProperty,
  OwnerTimelineFilters,
  OwnerTimelineResponse
} from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const OWNER_API_PATH = '/api/owner';
const OWNER_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getOwnerProperties(): Promise<OwnerPropertiesResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties`);
  return parseJsonResponse<OwnerPropertiesResponse>(response);
}

export async function getOwnerProperty(id: string): Promise<OwnerProperty> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties/${id}`);
  return parseJsonResponse<OwnerProperty>(response);
}

export async function getOwnerPropertyEngagements(
  id: string
): Promise<OwnerEngagementsResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties/${id}/engagements`);
  return parseJsonResponse<OwnerEngagementsResponse>(response);
}

export async function getOwnerEngagementTimeline(
  id: string,
  filters: OwnerTimelineFilters = {}
): Promise<OwnerTimelineResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/engagements/${id}/timeline${buildTimelineQuery(filters)}`);
  return parseJsonResponse<OwnerTimelineResponse>(response);
}

function buildTimelineQuery(filters: OwnerTimelineFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'pageSize', filters.pageSize);
  appendSearchParam(searchParams, 'order', filters.order);

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: number | string | undefined
) {
  if (value === undefined || value === '') {
    return;
  }

  searchParams.set(key, String(value));
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OWNER_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El portal propietario tardó demasiado.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFetchUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://') || typeof window !== 'undefined') {
    return path;
  }

  return `${APP_URL}${path}`;
}

async function parseJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
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

  return fallback;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
