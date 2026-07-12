import { describe, expect, it, vi } from 'vitest';
import { notificationKeys, notificationsOptions, unreadNotificationsCountOptions } from './queries';
import { getNotifications, getUnreadNotificationCount } from './service';

vi.mock('./service', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn()
}));

const getNotificationsMock = vi.mocked(getNotifications);
const getUnreadNotificationCountMock = vi.mocked(getUnreadNotificationCount);

describe('notification query options', () => {
  it('includes tenant id in list and unread-count keys', () => {
    expect(
      notificationKeys.list({ tenantId: 'tenant-1', page: 1, pageSize: 10, unreadOnly: true })
    ).toEqual(['notifications', 'list', 'tenant-1', { page: 1, pageSize: 10, unreadOnly: true }]);
    expect(notificationKeys.unreadCount('tenant-1')).toEqual([
      'notifications',
      'unread-count',
      'tenant-1'
    ]);
  });

  it('uses a no-tenant fallback in query keys', () => {
    expect(notificationKeys.list({ tenantId: null, pageSize: 5 })).toEqual([
      'notifications',
      'list',
      'no-tenant',
      { pageSize: 5 }
    ]);
    expect(notificationKeys.unreadCount(null)).toEqual([
      'notifications',
      'unread-count',
      'no-tenant'
    ]);
  });

  it('configures list query options without polling', async () => {
    getNotificationsMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });

    const options = notificationsOptions({ tenantId: 'tenant-1', page: 1, pageSize: 20 });

    expect(options.queryKey).toEqual([
      'notifications',
      'list',
      'tenant-1',
      { page: 1, pageSize: 20 }
    ]);
    expect(options).not.toHaveProperty('refetchInterval');
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    });
    expect(getNotificationsMock).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('configures unread count query options without polling', async () => {
    getUnreadNotificationCountMock.mockResolvedValueOnce({ unreadCount: 2 });

    const options = unreadNotificationsCountOptions('tenant-1');

    expect(options.queryKey).toEqual(['notifications', 'unread-count', 'tenant-1']);
    expect(options).not.toHaveProperty('refetchInterval');
    await expect(options.queryFn!({} as never)).resolves.toEqual({ unreadCount: 2 });
    expect(getUnreadNotificationCountMock).toHaveBeenCalledWith();
  });
});
