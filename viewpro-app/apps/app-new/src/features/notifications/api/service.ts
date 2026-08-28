import { bffRequest } from '@/lib/bff-client';
import type {
  DashboardNotification,
  MarkAllNotificationsReadResponse,
  NotificationFilters,
  NotificationsResponse,
  UnreadNotificationsCountResponse
} from './types';

const NOTIFICATIONS_API_PATH = '/api/notifications';
const NOTIFICATIONS_REQUEST_TIMEOUT_MS = 10_000;

export async function getNotifications(
  filters: NotificationFilters = {},
  init: RequestInit = {}
): Promise<NotificationsResponse> {
  return bffRequest<NotificationsResponse>(
    `${NOTIFICATIONS_API_PATH}${buildNotificationsQuery(filters)}`,
    init,
    { timeoutMs: NOTIFICATIONS_REQUEST_TIMEOUT_MS }
  );
}

export async function getUnreadNotificationCount(
  init: RequestInit = {}
): Promise<UnreadNotificationsCountResponse> {
  return bffRequest<UnreadNotificationsCountResponse>(
    `${NOTIFICATIONS_API_PATH}/unread-count`,
    init,
    { timeoutMs: NOTIFICATIONS_REQUEST_TIMEOUT_MS }
  );
}

export async function markNotificationRead(id: string): Promise<DashboardNotification> {
  return bffRequest<DashboardNotification>(`${NOTIFICATIONS_API_PATH}/${encodeURIComponent(id)}/read`, {
    method: 'POST'
  }, { timeoutMs: NOTIFICATIONS_REQUEST_TIMEOUT_MS });
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  return bffRequest<MarkAllNotificationsReadResponse>(`${NOTIFICATIONS_API_PATH}/read-all`, {
    method: 'POST'
  }, { timeoutMs: NOTIFICATIONS_REQUEST_TIMEOUT_MS });
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
