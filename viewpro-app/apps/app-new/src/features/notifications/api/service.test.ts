import { afterEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_BFF_ERROR_MESSAGE } from '@/lib/bff-client';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead
} from './service';

const notificationsResponse = {
  items: [
    {
      id: 'notification-1',
      type: 'DOCUMENT_UPLOADED',
      surface: 'INTERNAL',
      title: 'Documento subido',
      body: 'Un documento está listo para revisar.',
      linkHref: '/dashboard/product/engagement-1',
      readAt: null,
      createdAt: '2026-06-01T10:00:00.000Z',
      refs: {
        propertyEngagementId: 'engagement-1',
        propertyAssetId: null,
        documentRequestId: 'request-1',
        movementId: null
      }
    }
  ],
  page: 1,
  pageSize: 20,
  total: 1
};

const updatedNotification = {
  ...notificationsResponse.items[0],
  readAt: '2026-06-01T11:00:00.000Z'
};

describe('notifications API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads notifications through the notifications BFF route', async () => {
    const fetchMock = mockJsonResponse(notificationsResponse);

    await expect(getNotifications()).resolves.toEqual(notificationsResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('keeps credentials and no-store cache even when init overrides are provided', async () => {
    const fetchMock = mockJsonResponse(notificationsResponse);

    await getNotifications(
      {},
      {
        cache: 'force-cache',
        credentials: 'omit',
        headers: { 'x-test': '1' }
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: { 'x-test': '1' }
      })
    );
  });

  it('serializes supported notification filters', async () => {
    const fetchMock = mockJsonResponse(notificationsResponse);

    await getNotifications({ page: 2, pageSize: 5, unreadOnly: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications?page=2&pageSize=5&unreadOnly=true',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include'
      })
    );
  });

  it('loads unread notification count through the BFF route', async () => {
    const fetchMock = mockJsonResponse({ unreadCount: 3 });

    await expect(getUnreadNotificationCount()).resolves.toEqual({ unreadCount: 3 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/unread-count',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('marks one notification read through an encoded BFF route', async () => {
    const fetchMock = mockJsonResponse(updatedNotification);

    await expect(markNotificationRead('notification 1')).resolves.toEqual(updatedNotification);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/notification%201/read',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('marks all notifications read through the BFF route', async () => {
    const fetchMock = mockJsonResponse({ updatedCount: 2 });

    await expect(markAllNotificationsRead()).resolves.toEqual({ updatedCount: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/read-all',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('does not surface the API error sentence, and reports the status instead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Tenant context required' }), {
          headers: { 'content-type': 'application/json' },
          status: 403,
          statusText: 'Forbidden'
        })
      )
    );

    // This used to assert the opposite. 'Tenant context required' is the
    // backend's own sentence: copy nobody wrote for an operator, in a register
    // nobody chose, reaching a toast. The status is what a caller can branch on.
    const error = await getNotifications().catch((thrown: unknown) => thrown);

    expect((error as Error).message).toBe(GENERIC_BFF_ERROR_MESSAGE);
    expect((error as Error).message).not.toContain('Tenant context');
    expect((error as { status: number }).status).toBe(403);
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
