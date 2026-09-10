import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

vi.mock('@/lib/bff-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-api')>()),
  bffFetch: vi.fn()
}));

const bffFetchMock = vi.mocked(bffFetch);

describe('seller property proposals BFF collection route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 'proposal-1' }], total: 1 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('passes the collection query through with duplicate keys and exact encoding', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/property-proposals?state=EN_REVISION&state=RECHAZADA&label=a%20b&tag=a%2Bb'
      )
    );

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/property-proposals?state=EN_REVISION&state=RECHAZADA&label=a%20b&tag=a%2Bb'
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: 'proposal-1' }], total: 1 });
  });

  it.each([
    [
      'valid JSON with body-controlled identities',
      '{"title":"Casa","tenantId":"body-tenant","proposedByUserId":"body-proposer"}',
      'application/json; charset=utf-8',
      201
    ],
    ['malformed JSON', '{"title":', 'application/problem+json', 400],
    ['an empty body', '', 'text/plain;charset=UTF-8', 204]
  ])('forwards %s POST data exactly without a body-controlled tenant', async (_name, body, contentType, status) => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(status === 204 ? null : JSON.stringify({ status }), { status })
    );
    const requestHeaders = contentType ? { 'content-type': contentType } : undefined;

    const response = await POST(
      new NextRequest('http://localhost/api/property-proposals', {
        body,
        headers: requestHeaders,
        method: 'POST'
      })
    );

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals', {
      body,
      headers: { 'content-type': contentType },
      method: 'POST'
    });
    expect(new Headers(bffFetchMock.mock.calls[0]?.[1]?.headers).has('x-tenant-id')).toBe(false);
    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe(status === 204 ? '' : JSON.stringify({ status }));
  });

  it('uses the shared network error response for GET failures', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('offline'));

    const response = await GET(new NextRequest('http://localhost/api/property-proposals'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudieron cargar las propuestas.'
    });
  });

  it('uses the shared timeout error response for POST failures', async () => {
    bffFetchMock.mockRejectedValueOnce(new DOMException('timed out', 'AbortError'));

    const response = await POST(
      new NextRequest('http://localhost/api/property-proposals', { body: '{}', method: 'POST' })
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ message: 'La operación tardó demasiado.' });
  });
});
