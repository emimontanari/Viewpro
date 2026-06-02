import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((error: unknown, fallbackMessage: string, timeoutMessage: string) => {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return Response.json(
      { message: isTimeout ? timeoutMessage : fallbackMessage },
      { status: isTimeout ? 504 : 502 }
    );
  }),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const proxyJsonResponseMock = vi.mocked(proxyJsonResponse);

function listRequest(query = '') {
  return new NextRequest(`http://localhost/api/notifications${query}`);
}

describe('notifications list BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards list requests without query params to the backend notifications endpoint', async () => {
    const backendResponse = new Response(JSON.stringify({ items: [] }), { status: 200 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await GET(listRequest());

    expect(bffFetchMock).toHaveBeenCalledWith('/notifications');
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(200);
  });

  it('forwards only normalized list query params', async () => {
    await GET(
      listRequest('?page=2&pageSize=5&unreadOnly=true&ignored=value&badPage=3')
    );

    expect(bffFetchMock).toHaveBeenCalledWith('/notifications?page=2&pageSize=5&unreadOnly=true');
  });

  it('omits invalid query params before proxying', async () => {
    await GET(listRequest('?page=0&pageSize=99&unreadOnly=maybe'));

    expect(bffFetchMock).toHaveBeenCalledWith('/notifications');
  });

  it('returns a safe fallback when the backend request fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await GET(listRequest());

    await expect(response.json()).resolves.toEqual({
      message: 'No se pudieron cargar las notificaciones.'
    });
    expect(response.status).toBe(502);
  });
});
