import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn(
    (error: unknown, fallbackMessage: string, timeoutMessage: string) => {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return Response.json(
        { message: isTimeout ? timeoutMessage : fallbackMessage },
        { status: isTimeout ? 504 : 502 }
      );
    }
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const proxyJsonResponseMock = vi.mocked(proxyJsonResponse);

describe('owner notifications unread count BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ unreadCount: 0 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards unread count requests to the backend owner notifications endpoint', async () => {
    const backendResponse = new Response(JSON.stringify({ unreadCount: 3 }), { status: 200 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await GET(
      new NextRequest('http://localhost/api/owner/notifications/unread-count')
    );

    expect(bffFetchMock).toHaveBeenCalledWith('/owner/notifications/unread-count');
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(200);
  });

  it('passes backend errors through', async () => {
    const backendResponse = new Response(
      JSON.stringify({ message: 'Owner notification not found' }),
      {
        headers: { 'content-type': 'application/json' },
        status: 404
      }
    );
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await GET(
      new NextRequest('http://localhost/api/owner/notifications/unread-count')
    );

    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(404);
  });

  it('returns a safe owner fallback when the backend request fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await GET(
      new NextRequest('http://localhost/api/owner/notifications/unread-count')
    );

    await expect(response.json()).resolves.toEqual({
      message: 'No se pudieron cargar tus notificaciones.'
    });
    expect(response.status).toBe(502);
  });
});
