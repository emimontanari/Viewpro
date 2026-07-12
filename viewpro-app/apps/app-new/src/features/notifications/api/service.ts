import type {
  DashboardNotification,
  MarkAllNotificationsReadResponse,
  NotificationFilters,
  NotificationsResponse,
  UnreadNotificationsCountResponse
} from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const NOTIFICATIONS_API_PATH = '/api/notifications';
const NOTIFICATIONS_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getNotifications(
  filters: NotificationFilters = {},
  init: RequestInit = {}
): Promise<NotificationsResponse> {
  const response = await apiFetch(
    `${NOTIFICATIONS_API_PATH}${buildNotificationsQuery(filters)}`,
    init
  );
  return parseJsonResponse<NotificationsResponse>(response);
}

export async function getUnreadNotificationCount(
  init: RequestInit = {}
): Promise<UnreadNotificationsCountResponse> {
  const response = await apiFetch(`${NOTIFICATIONS_API_PATH}/unread-count`, init);
  return parseJsonResponse<UnreadNotificationsCountResponse>(response);
}

export async function markNotificationRead(id: string): Promise<DashboardNotification> {
  const response = await apiFetch(`${NOTIFICATIONS_API_PATH}/${encodeURIComponent(id)}/read`, {
    method: 'POST'
  });

  return parseJsonResponse<DashboardNotification>(response);
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  const response = await apiFetch(`${NOTIFICATIONS_API_PATH}/read-all`, {
    method: 'POST'
  });

  return parseJsonResponse<MarkAllNotificationsReadResponse>(response);
}

function buildNotificationsQuery(filters: NotificationFilters) {
  const searchParams = new URLSearchParams();

  appendNumberSearchParam(searchParams, 'page', filters.page, 1);
  appendNumberSearchParam(searchParams, 'pageSize', filters.pageSize, 1, 50);

  if (filters.unreadOnly !== undefined) {
    searchParams.set('unreadOnly', String(filters.unreadOnly));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function appendNumberSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: number | undefined,
  min: number,
  max?: number
) {
  if (value === undefined || !Number.isInteger(value) || value < min) {
    return;
  }

  if (max !== undefined && value > max) {
    return;
  }

  searchParams.set(key, String(value));
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTIFICATIONS_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      ...init,
      cache: 'no-store',
      credentials: 'include',
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Las notificaciones tardaron demasiado.', { cause: error });
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

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
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

  return fallback || 'No se pudieron cargar las notificaciones.';
}
