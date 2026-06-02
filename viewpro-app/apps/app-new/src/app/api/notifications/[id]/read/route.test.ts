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

function readRequest(id = 'notification 1') {
  return new NextRequest(`http://localhost/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST'
  });
}

describe('notification mark-read BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'notification 1' }), { status: 200 })
    );
  });

  it('forwards mark-read requests to the backend notifications endpoint', async () => {
    const backendResponse = new Response(JSON.stringify({ id: 'notification 1' }), { status: 200 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(readRequest(), {
      params: Promise.resolve({ id: 'notification 1' })
    });

    expect(bffFetchMock).toHaveBeenCalledWith('/notifications/notification%201/read', {
      method: 'POST'
    });
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(200);
  });

  it('passes backend errors through', async () => {
    const backendResponse = new Response(JSON.stringify({ message: 'Notification not found' }), {
      headers: { 'content-type': 'application/json' },
      status: 404
    });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(readRequest('missing'), {
      params: Promise.resolve({ id: 'missing' })
    });

    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(404);
  });

  it('returns a safe fallback when the backend request fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(readRequest(), {
      params: Promise.resolve({ id: 'notification 1' })
    });

    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo actualizar la notificación.'
    });
    expect(response.status).toBe(502);
  });
});
