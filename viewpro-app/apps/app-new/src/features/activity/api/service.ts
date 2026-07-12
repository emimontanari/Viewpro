import type { ActivityFeedFilters, ActivityFeedResponse } from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const ACTIVITY_FEED_API_PATH = '/api/activity/feed';
const ACTIVITY_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getActivityFeed(filters: ActivityFeedFilters): Promise<ActivityFeedResponse> {
  const response = await apiFetch(buildActivityFeedUrl(filters));
  return parseJsonResponse<ActivityFeedResponse>(response);
}

function buildActivityFeedUrl(filters: ActivityFeedFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'pageSize', filters.pageSize);
  appendSearchParam(searchParams, 'kind', filters.kind === 'all' ? undefined : filters.kind);
  appendSearchParam(searchParams, 'type', filters.type);
  appendSearchParam(searchParams, 'sellerId', filters.sellerId);
  appendSearchParam(searchParams, 'dateFrom', filters.dateFrom);
  appendSearchParam(searchParams, 'dateTo', filters.dateTo);

  const query = searchParams.toString();
  return query ? `${ACTIVITY_FEED_API_PATH}?${query}` : ACTIVITY_FEED_API_PATH;
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
  const timeoutId = setTimeout(() => controller.abort(), ACTIVITY_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El seguimiento tardó demasiado.', { cause: error });
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
