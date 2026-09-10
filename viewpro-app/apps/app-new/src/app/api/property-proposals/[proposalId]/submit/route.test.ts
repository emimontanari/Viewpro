import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-api')>()),
  bffFetch: vi.fn()
}));

const bffFetchMock = vi.mocked(bffFetch);
const CANONICAL_REQUEST_ID = '01234567-89ab-4cde-8fab-0123456789ab';
const ENCODED_PROPOSAL_ID = 'proposal%2Fcon%20espacio-%C3%B1';

function context(proposalId = 'proposal/con espacio-ñ') {
  return { params: Promise.resolve({ proposalId }) };
}

describe('seller property proposal submit BFF route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards an async parameter encoded exactly once with raw submit data and selected context delegated to bffFetch', async () => {
    const body = '{"expectedVersion":4,"tenantId":"body-tenant"}';
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proposal-1', state: 'EN_REVISION' }), {
        headers: { 'content-type': 'application/json', 'x-request-id': CANONICAL_REQUEST_ID },
        status: 200
      })
    );

    const response = await POST(
      new NextRequest('http://localhost/api/property-proposals/proposal%2Fcon%20espacio-%C3%B1/submit', {
        body,
        headers: {
          authorization: 'Bearer request-token',
          'content-type': 'application/json; charset=utf-8',
          'x-tenant-id': 'selected-tenant'
        },
        method: 'POST'
      }),
      context()
    );

    expect(bffFetchMock).toHaveBeenCalledWith(`/property-proposals/${ENCODED_PROPOSAL_ID}/submit`, {
      body,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      method: 'POST'
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'proposal-1', state: 'EN_REVISION' });
    expect(response.headers.get('x-request-id')).toBe(CANONICAL_REQUEST_ID);
  });

  it.each([
    ['malformed JSON', '{"expectedVersion":', 'application/problem+json', 400, { errorCode: 'REQUEST_FAILED' }],
    ['empty body without a content type', '', undefined, 204, undefined]
  ])('passes through %s status and body without local parsing', async (_name, body, contentType, status, responseBody) => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(responseBody === undefined ? null : JSON.stringify(responseBody), { status })
    );
    const request = new NextRequest('http://localhost/api/property-proposals/proposal-1/submit', {
      body,
      headers: contentType ? { 'content-type': contentType } : undefined,
      method: 'POST'
    });

    const response = await POST(request, context('proposal-1'));
    const forwardedContentType = request.headers.get('content-type');

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals/proposal-1/submit', {
      body,
      headers: forwardedContentType ? { 'content-type': forwardedContentType } : {},
      method: 'POST'
    });
    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe(responseBody === undefined ? '' : JSON.stringify(responseBody));
  });

  it('delegates submit timeouts to the shared BFF error response', async () => {
    bffFetchMock.mockRejectedValueOnce(new DOMException('timed out', 'AbortError'));

    const response = await POST(
      new NextRequest('http://localhost/api/property-proposals/proposal-1/submit', {
        body: '{"expectedVersion":1}',
        method: 'POST'
      }),
      context('proposal-1')
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ message: 'La operación tardó demasiado.' });
  });
});
