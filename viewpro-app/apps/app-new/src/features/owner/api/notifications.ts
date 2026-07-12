import type {
  DashboardNotification,
  MarkAllNotificationsReadResponse,
  NotificationFilters,
  NotificationsResponse,
  UnreadNotificationsCountResponse
} from '@/features/notifications/api/types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const OWNER_NOTIFICATIONS_API_PATH = '/api/owner/notifications';
const OWNER_NOTIFICATIONS_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export type OwnerNotification = DashboardNotification;
export type OwnerNotificationsResponse = NotificationsResponse;
export type OwnerNotificationFilters = NotificationFilters;
export type OwnerUnreadNotificationsCountResponse = UnreadNotificationsCountResponse;
export type MarkAllOwnerNotificationsReadResponse = MarkAllNotificationsReadResponse;

export async function getOwnerNotifications(
  filters: OwnerNotificationFilters = {},
  init: RequestInit = {}
): Promise<OwnerNotificationsResponse> {
  const response = await apiFetch(
    `${OWNER_NOTIFICATIONS_API_PATH}${buildOwnerNotificationsQuery(filters)}`,
    init
  );
  return parseJsonResponse<OwnerNotificationsResponse>(response);
}

export async function getOwnerUnreadNotificationCount(
  init: RequestInit = {}
): Promise<OwnerUnreadNotificationsCountResponse> {
  const response = await apiFetch(`${OWNER_NOTIFICATIONS_API_PATH}/unread-count`, init);
  return parseJsonResponse<OwnerUnreadNotificationsCountResponse>(response);
}

export async function markOwnerNotificationRead(id: string): Promise<OwnerNotification> {
  const response = await apiFetch(
    `${OWNER_NOTIFICATIONS_API_PATH}/${encodeURIComponent(id)}/read`,
    {
      method: 'POST'
    }
  );

  return parseJsonResponse<OwnerNotification>(response);
}

export async function markAllOwnerNotificationsRead(): Promise<MarkAllOwnerNotificationsReadResponse> {
  const response = await apiFetch(`${OWNER_NOTIFICATIONS_API_PATH}/read-all`, {
    method: 'POST'
  });

  return parseJsonResponse<MarkAllOwnerNotificationsReadResponse>(response);
}

function buildOwnerNotificationsQuery(filters: OwnerNotificationFilters) {
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
  const timeoutId = setTimeout(() => controller.abort(), OWNER_NOTIFICATIONS_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      ...init,
      cache: 'no-store',
      credentials: 'include',
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

  return fallback || 'No se pudieron cargar tus notificaciones.';
}
