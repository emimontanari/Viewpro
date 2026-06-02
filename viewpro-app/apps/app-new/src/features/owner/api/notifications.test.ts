import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOwnerNotifications,
  getOwnerUnreadNotificationCount,
  markAllOwnerNotificationsRead,
  markOwnerNotificationRead
} from './notifications';

const ownerNotificationsResponse = {
  items: [
    {
      id: 'notification-1',
      type: 'DOCUMENT_UPLOADED',
      surface: 'OWNER',
      title: 'Documento recibido',
      body: 'La inmobiliaria recibió tu documento.',
      linkHref: '/owner/properties/property-1',
      readAt: null,
      createdAt: '2026-06-02T10:00:00.000Z',
      refs: {
        propertyEngagementId: 'engagement-1',
        propertyAssetId: 'property-1',
        documentRequestId: 'request-1',
        movementId: null
      }
    }
  ],
  page: 1,
  pageSize: 20,
  total: 1
};

const updatedOwnerNotification = {
  ...ownerNotificationsResponse.items[0],
  readAt: '2026-06-02T11:00:00.000Z'
};

describe('owner notifications API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads owner notifications through the owner notifications BFF route', async () => {
    const fetchMock = mockJsonResponse(ownerNotificationsResponse);

    await expect(getOwnerNotifications()).resolves.toEqual(ownerNotificationsResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('keeps credentials, no-store cache, and service timeout signal when init overrides are provided', async () => {
    const fetchMock = mockJsonResponse(ownerNotificationsResponse);
    const callerController = new AbortController();

    await getOwnerNotifications(
      {},
      {
        cache: 'force-cache',
        credentials: 'omit',
        headers: { 'x-test': '1' },
        signal: callerController.signal
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: { 'x-test': '1' },
        signal: expect.any(AbortSignal)
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).not.toBe(callerController.signal);
  });

  it('serializes supported owner notification filters', async () => {
    const fetchMock = mockJsonResponse(ownerNotificationsResponse);

    await getOwnerNotifications({ page: 2, pageSize: 5, unreadOnly: false });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications?page=2&pageSize=5&unreadOnly=false',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include'
      })
    );
  });

  it('loads owner unread notification count through the owner BFF route', async () => {
    const fetchMock = mockJsonResponse({ unreadCount: 3 });

    await expect(getOwnerUnreadNotificationCount()).resolves.toEqual({ unreadCount: 3 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications/unread-count',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('marks one owner notification read through an encoded owner BFF route', async () => {
    const fetchMock = mockJsonResponse(updatedOwnerNotification);

    await expect(markOwnerNotificationRead('notification 1')).resolves.toEqual(
      updatedOwnerNotification
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications/notification%201/read',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('marks all owner notifications read through the owner BFF route', async () => {
    const fetchMock = mockJsonResponse({ updatedCount: 2 });

    await expect(markAllOwnerNotificationsRead()).resolves.toEqual({ updatedCount: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/notifications/read-all',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('surfaces owner API error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Owner notification not found' }), {
          headers: { 'content-type': 'application/json' },
          status: 404,
          statusText: 'Not Found'
        })
      )
    );

    await expect(getOwnerNotifications()).rejects.toThrow('Owner notification not found');
  });
});

function mockJsonResponse(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
      status: 200
    })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
