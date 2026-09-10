import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from './route';

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

describe('seller property proposal detail BFF route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards an async detail parameter exactly once encoded without route-local tenant or auth handling', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proposal-1', state: 'BORRADOR' }), {
        headers: { 'content-type': 'application/json', 'x-request-id': CANONICAL_REQUEST_ID },
        status: 200
      })
    );

    const response = await GET(
      new NextRequest('http://localhost/api/property-proposals/proposal%2Fcon%20espacio-%C3%B1', {
        headers: { authorization: 'Bearer request-token', 'x-tenant-id': 'selected-tenant' }
      }),
      context()
    );

    expect(bffFetchMock).toHaveBeenCalledWith(`/property-proposals/${ENCODED_PROPOSAL_ID}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 'proposal-1', state: 'BORRADOR' });
    expect(response.headers.get('x-request-id')).toBe(CANONICAL_REQUEST_ID);
  });

  it('passes through a backend detail error while filtering a non-canonical request ID', async () => {
    const body = { errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', statusCode: 404 };
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json', 'x-request-id': 'not-a-canonical-request-id' },
        status: 404
      })
    );

    const response = await GET(new NextRequest('http://localhost/api/property-proposals/missing'), context('missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(body);
    expect(response.headers.get('x-request-id')).toBeNull();
  });

  it.each([
    [new Response('not json', { status: 422 }), 422],
    [new Response(null, { status: 204 }), 204]
  ])('preserves backend status when the shared JSON proxy receives malformed or no body', async (backend, status) => {
    bffFetchMock.mockResolvedValueOnce(backend);

    const response = await GET(new NextRequest('http://localhost/api/property-proposals/proposal-1'), context('proposal-1'));

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('');
  });

  it('delegates detail network failures to the shared BFF error response', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('offline'));

    const response = await GET(new NextRequest('http://localhost/api/property-proposals/proposal-1'), context('proposal-1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudo cargar la propuesta.' });
  });

  it.each([
    ['valid JSON', '{"title":"Casa","tenantId":"body-tenant"}', 'application/json; charset=utf-8', 200, { saved: true }],
    ['malformed JSON', '{"title":', 'application/problem+json', 409, { errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT' }],
    ['empty body without a content type', '', undefined, 204, undefined]
  ])('forwards %s PATCH data without parsing or identity interpretation', async (_name, body, contentType, status, responseBody) => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(responseBody === undefined ? null : JSON.stringify(responseBody), { status })
    );
    const request = new NextRequest(
      'http://localhost/api/property-proposals/proposal%2Fcon%20espacio-%C3%B1',
      {
        body,
        headers: contentType ? { 'content-type': contentType } : undefined,
        method: 'PATCH'
      }
    );

    const response = await PATCH(request, context());
    const forwardedContentType = request.headers.get('content-type');

    expect(bffFetchMock).toHaveBeenCalledWith(`/property-proposals/${ENCODED_PROPOSAL_ID}`, {
      body,
      headers: forwardedContentType ? { 'content-type': forwardedContentType } : {},
      method: 'PATCH'
    });
    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe(responseBody === undefined ? '' : JSON.stringify(responseBody));
  });
});
