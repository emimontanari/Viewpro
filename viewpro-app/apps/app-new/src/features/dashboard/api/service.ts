import type { DashboardSummaryFilters, DashboardSummaryResponse } from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const DASHBOARD_SUMMARY_API_PATH = '/api/dashboard/summary';
const DASHBOARD_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getDashboardSummary(
  filters: DashboardSummaryFilters
): Promise<DashboardSummaryResponse> {
  const response = await apiFetch(buildDashboardSummaryUrl(filters));
  return parseJsonResponse<DashboardSummaryResponse>(response);
}

function buildDashboardSummaryUrl(filters: DashboardSummaryFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'range', filters.range);

  const query = searchParams.toString();
  return query ? `${DASHBOARD_SUMMARY_API_PATH}?${query}` : DASHBOARD_SUMMARY_API_PATH;
}

function appendSearchParam(searchParams: URLSearchParams, key: string, value: string | undefined) {
  if (value === undefined || value === '') {
    return;
  }

  searchParams.set(key, value);
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El resumen operativo tardó demasiado.', { cause: error });
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
