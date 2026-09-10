import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bff-api')>()),
  bffFetch: vi.fn()
}));

const bffFetchMock = vi.mocked(bffFetch);
const REQUEST_ID = '01234567-89ab-4cde-8fab-0123456789ab';
const ENCODED_PROPOSAL_ID = 'proposal%2Fcon%20espacio-%C3%B1';

function context(proposalId = 'proposal/con espacio-ñ') {
  return { params: Promise.resolve({ proposalId }) };
}

function request(body: string, contentType = 'application/problem+json') {
  return new NextRequest('http://localhost/api/property-proposals/review/proposal-1/reject', {
    body,
    headers: { 'content-type': contentType, 'x-tenant-id': 'selected-tenant' },
    method: 'POST'
  });
}

describe('reviewer property proposal reject BFF route', () => {
  beforeEach(() => vi.resetAllMocks());

  it('forwards the raw decision body and content type to the encoded reject endpoint', async () => {
    const body = ' { "reviewRoundId" : "round-1", "reason" : "  needs changes  ", "tenantId" : "body-tenant", "reviewerId" : "body-reviewer" } ';
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'proposal-1', state: 'RECHAZADA' }), {
        headers: { 'x-request-id': REQUEST_ID },
        status: 200
      })
    );

    const response = await POST(request(body), context());

    expect(bffFetchMock).toHaveBeenCalledWith(`/property-proposals/review/${ENCODED_PROPOSAL_ID}/reject`, {
      body,
      headers: { 'content-type': 'application/problem+json' },
      method: 'POST'
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    await expect(response.json()).resolves.toEqual({ id: 'proposal-1', state: 'RECHAZADA' });
  });

  it('passes backend JSON errors through while shared filtering drops an invalid request ID', async () => {
    const body = '{"reviewRoundId":"round-1","reason":""}';
    const error = { errorCode: 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID', statusCode: 400 };
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(error), { headers: { 'x-request-id': 'not-a-request-id' }, status: 400 })
    );

    const response = await POST(request(body), context('proposal-1'));

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals/review/proposal-1/reject', {
      body,
      headers: { 'content-type': 'application/problem+json' },
      method: 'POST'
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBeNull();
    await expect(response.json()).resolves.toEqual(error);
  });

  it.each([
    ['malformed backend JSON', 422, '{"reviewRoundId":', new Response('not json', { status: 422 })],
    ['an empty body', 204, '', new Response(null, { status: 204 })]
  ])('keeps %s raw and preserves a %i empty response', async (_name, status, body, backend) => {
    bffFetchMock.mockResolvedValueOnce(backend);

    const response = await POST(request(body), context('proposal-1'));

    expect(bffFetchMock).toHaveBeenCalledWith('/property-proposals/review/proposal-1/reject', {
      body,
      headers: { 'content-type': 'application/problem+json' },
      method: 'POST'
    });
    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('');
  });

  it('uses the shared network failure response', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('offline'));

    const response = await POST(request('{"reviewRoundId":"round-1","reason":"reason"}'), context('proposal-1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudo rechazar la propuesta.' });
  });
});
