import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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

describe('notification mark-all-read BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ updatedCount: 0 }), { status: 200 })
    );
  });

  it('forwards mark-all-read requests to the backend notifications endpoint', async () => {
    const backendResponse = new Response(JSON.stringify({ updatedCount: 3 }), { status: 200 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(
      new NextRequest('http://localhost/api/notifications/read-all', { method: 'POST' })
    );

    expect(bffFetchMock).toHaveBeenCalledWith('/notifications/read-all', {
      method: 'POST'
    });
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(200);
  });

  it('passes backend errors through', async () => {
    const backendResponse = new Response(JSON.stringify({ message: 'Tenant context required' }), {
      headers: { 'content-type': 'application/json' },
      status: 403
    });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(
      new NextRequest('http://localhost/api/notifications/read-all', { method: 'POST' })
    );

    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(403);
  });

  it('returns a safe fallback when the backend request fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(
      new NextRequest('http://localhost/api/notifications/read-all', { method: 'POST' })
    );

    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo actualizar la notificación.'
    });
    expect(response.status).toBe(502);
  });
});
