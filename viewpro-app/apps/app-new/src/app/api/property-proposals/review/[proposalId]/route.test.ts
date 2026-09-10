import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/bff-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-api')>()),
  bffFetch: vi.fn()
}));

const bffFetchMock = vi.mocked(bffFetch);
const ENCODED_PROPOSAL_ID = 'proposal%2Fcon%20espacio-%C3%B1';

type RouteContext = { params: Promise<{ proposalId: string }> };

function context(proposalId = 'proposal/con espacio-ñ'): RouteContext {
  return { params: Promise.resolve({ proposalId }) };
}

function reviewerRequest() {
  return new NextRequest('http://localhost/api/property-proposals/review/proposal%2Fcon%20espacio-%C3%B1', {
    headers: {
      authorization: 'Bearer request-token',
      'x-tenant-id': 'selected-tenant'
    }
  });
}

describe('reviewer property proposal detail BFF route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('awaits params and forwards a slash, space, and unicode proposal ID encoded exactly once', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proposal-1', state: 'EN_REVISION' }), { status: 200 })
    );

    const response = await GET(reviewerRequest(), context());

    expect(bffFetchMock).toHaveBeenCalledWith(`/property-proposals/review/${ENCODED_PROPOSAL_ID}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'proposal-1', state: 'EN_REVISION' });
  });

  it('passes backend detail errors through unchanged while delegating selected tenant and auth to bffFetch', async () => {
    const body = { errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', statusCode: 404 };
    bffFetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 404 }));
    const request = new NextRequest('http://localhost/api/property-proposals/review/missing', {
      headers: { authorization: 'Bearer request-token', 'x-tenant-id': 'selected-tenant' }
    });

    const response = await GET(request, context('missing'));

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals/review/missing');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(body);
  });

  it.each([
    [new Response('not json', { status: 422 }), 422],
    [new Response(null, { status: 204 }), 204]
  ])('preserves backend status with an empty response for malformed or absent JSON', async (backend, status) => {
    bffFetchMock.mockResolvedValueOnce(backend);

    const response = await GET(reviewerRequest(), context());

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('');
  });

  it('uses the shared network error response for failures', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('offline'));

    const response = await GET(reviewerRequest(), context());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudo cargar la propuesta para revisión.' });
  });

  it('uses the shared timeout error response for aborts', async () => {
    bffFetchMock.mockRejectedValueOnce(new DOMException('timed out', 'AbortError'));

    const response = await GET(reviewerRequest(), context());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ message: 'La operación tardó demasiado.' });
  });
});
