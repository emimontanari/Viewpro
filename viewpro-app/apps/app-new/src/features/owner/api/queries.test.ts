import { getDocumentRequestsRefetchInterval } from '@/lib/document-request-refresh';
import { describe, expect, it, vi } from 'vitest';
import {
  ownerDocumentRequestsOptions,
  ownerEngagementRecentMovementsOptions,
  ownerEngagementTimelineOptions,
  ownerKeys,
  ownerNotificationsOptions,
  ownerUnreadNotificationsCountOptions
} from './queries';
import { getOwnerEngagementTimeline } from './service';
import { getOwnerNotifications, getOwnerUnreadNotificationCount } from './notifications';

vi.mock('./notifications', () => ({
  getOwnerNotifications: vi.fn(),
  getOwnerUnreadNotificationCount: vi.fn()
}));

vi.mock('./service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./service')>()),
  getOwnerEngagementTimeline: vi.fn()
}));

const getOwnerNotificationsMock = vi.mocked(getOwnerNotifications);
const getOwnerUnreadNotificationCountMock = vi.mocked(getOwnerUnreadNotificationCount);
const getOwnerEngagementTimelineMock = vi.mocked(getOwnerEngagementTimeline);


describe('owner home movement query options', () => {
  it('uses the exact bounded home key and query independently from the detail page', async () => {
    getOwnerEngagementTimelineMock.mockResolvedValueOnce({
      engagement: {} as never,
      items: [],
      page: 1,
      pageSize: 5,
      total: 0
    });

    const homeOptions = ownerEngagementRecentMovementsOptions('engagement-home');
    const detailOptions = ownerEngagementTimelineOptions('engagement-home', {
      order: 'desc',
      page: 1,
      pageSize: 25
    });

    expect(homeOptions.queryKey).toEqual([
      'owner',
      'engagements',
      'engagement-home',
      'timeline',
      { order: 'desc', page: 1, pageSize: 5 }
    ]);
    expect(homeOptions.queryKey).not.toEqual(detailOptions.queryKey);
    await homeOptions.queryFn!({} as never);
    expect(getOwnerEngagementTimelineMock).toHaveBeenCalledWith('engagement-home', {
      order: 'desc',
      page: 1,
      pageSize: 5
    });
  });
});

describe('owner document request query options', () => {
  it('enables selective near-realtime refresh for owner documents', () => {
    const options = ownerDocumentRequestsOptions('engagement-1', { pageSize: 20 });

    expect(options.refetchInterval).toBe(getDocumentRequestsRefetchInterval);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
  });
});

describe('owner notification query options', () => {
  it('keeps notification keys under the owner namespace without tenant ids', () => {
    expect(ownerKeys.notifications({ page: 1, pageSize: 5, unreadOnly: true })).toEqual([
      'owner',
      'notifications',
      { page: 1, pageSize: 5, unreadOnly: true }
    ]);
    expect(ownerKeys.unreadNotificationsCount()).toEqual([
      'owner',
      'notifications',
      'unread-count'
    ]);
  });

  it('configures owner notification list query options without polling', async () => {
    getOwnerNotificationsMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });

    const options = ownerNotificationsOptions({ page: 1, pageSize: 20 });

    expect(options.queryKey).toEqual(['owner', 'notifications', { page: 1, pageSize: 20 }]);
    expect(options).not.toHaveProperty('refetchInterval');
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20
    });
    expect(getOwnerNotificationsMock).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('configures owner unread count query options without polling', async () => {
    getOwnerUnreadNotificationCountMock.mockResolvedValueOnce({ unreadCount: 2 });

    const options = ownerUnreadNotificationsCountOptions();

    expect(options.queryKey).toEqual(['owner', 'notifications', 'unread-count']);
    expect(options).not.toHaveProperty('refetchInterval');
    await expect(options.queryFn!({} as never)).resolves.toEqual({ unreadCount: 2 });
    expect(getOwnerUnreadNotificationCountMock).toHaveBeenCalledWith();
  });
});
