import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/bff-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-api')>()),
  bffFetch: vi.fn()
}));

const bffFetchMock = vi.mocked(bffFetch);

function reviewerRequest(path = '/api/property-proposals/review') {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      authorization: 'Bearer request-token',
      'x-tenant-id': 'selected-tenant'
    }
  });
}

describe('reviewer property proposals BFF collection route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards the raw query exactly, including duplicates, encoding, and unsupported filters', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: 'proposal-1' }], total: 1 }), { status: 200 })
    );
    const request = reviewerRequest(
      '/api/property-proposals/review?state=EN_REVISION&state=RECHAZADA&label=a%20b&tag=a%2Bb&search=nope'
    );

    const response = await GET(request);

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/property-proposals/review?state=EN_REVISION&state=RECHAZADA&label=a%20b&tag=a%2Bb&search=nope'
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: 'proposal-1' }], total: 1 });
  });

  it('passes backend errors through unchanged while delegating selected tenant and auth to bffFetch', async () => {
    const body = { errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', statusCode: 404 };
    bffFetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 404 }));
    const request = reviewerRequest();

    const response = await GET(request);

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals/review');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(body);
  });

  it.each([
    [new Response('not json', { status: 422 }), 422],
    [new Response(null, { status: 204 }), 204]
  ])('preserves backend status with an empty response for malformed or absent JSON', async (backend, status) => {
    bffFetchMock.mockResolvedValueOnce(backend);

    const response = await GET(reviewerRequest());

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('');
  });

  it('uses the shared network error response for failures', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('offline'));

    const response = await GET(reviewerRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudieron cargar las propuestas para revisión.' });
  });

  it('uses the shared timeout error response for aborts', async () => {
    bffFetchMock.mockRejectedValueOnce(new DOMException('timed out', 'AbortError'));

    const response = await GET(reviewerRequest());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ message: 'La operación tardó demasiado.' });
  });
});
