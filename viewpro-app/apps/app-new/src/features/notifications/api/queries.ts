import { queryOptions } from '@tanstack/react-query';
import { getNotifications, getUnreadNotificationCount } from './service';
import type { NotificationFilters } from './types';

type NotificationListKeyInput = NotificationFilters & {
  tenantId?: string | null;
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ({ tenantId, ...filters }: NotificationListKeyInput) =>
    [...notificationKeys.all, 'list', tenantId ?? 'no-tenant', filters] as const,
  unreadCount: (tenantId?: string | null) =>
    [...notificationKeys.all, 'unread-count', tenantId ?? 'no-tenant'] as const
};

export const notificationsOptions = ({ tenantId, ...filters }: NotificationListKeyInput = {}) =>
  queryOptions({
    queryKey: notificationKeys.list({ tenantId, ...filters }),
    queryFn: () => getNotifications(filters)
  });

export const unreadNotificationsCountOptions = (tenantId?: string | null) =>
  queryOptions({
    queryKey: notificationKeys.unreadCount(tenantId),
    queryFn: () => getUnreadNotificationCount()
  });
