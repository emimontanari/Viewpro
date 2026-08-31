import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((error, fallbackMessage) =>
    Response.json({ message: fallbackMessage }, { status: error?.name === 'AbortError' ? 504 : 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const proxyJsonResponseMock = vi.mocked(proxyJsonResponse);

describe('feedback BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockReset();
    proxyJsonResponseMock.mockClear();
  });

  it('proxies a feedback POST through the authenticated BFF transport', async () => {
    const backendResponse = new Response(JSON.stringify({ accepted: true }), { status: 201 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(
      new NextRequest('http://localhost/api/feedback', {
        body: JSON.stringify({ type: 'ERROR', description: 'La carga no funciona.' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      })
    );

    expect(bffFetchMock).toHaveBeenCalledWith('/feedback', {
      body: JSON.stringify({ type: 'ERROR', description: 'La carga no funciona.' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response).toBe(backendResponse);
  });

  it('preserves the BFF error status/body transport semantics', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('backend unavailable'));

    const response = await POST(
      new NextRequest('http://localhost/api/feedback', {
        body: JSON.stringify({ type: 'SUGGESTION', description: 'Agregar un filtro útil.' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudo enviar el comentario.' });
  });
});
