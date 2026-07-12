import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function rejectRequest(body: unknown) {
  return new NextRequest('http://localhost/api/document-requests/request-1/reject', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });
}

describe('internal document reject BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'request-1', status: 'REJECTED' }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('forwards reject body to the backend internal endpoint', async () => {
    const body = { reason: 'El archivo no corresponde al documento solicitado.' };

    await POST(rejectRequest(body), { params: Promise.resolve({ id: 'request-1' }) });

    expect(bffFetchMock).toHaveBeenCalledWith('/document-requests/request-1/reject', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('passes backend validation errors through', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Rejection reason is required' }), {
        headers: { 'content-type': 'application/json' },
        status: 400
      })
    );

    const response = await POST(rejectRequest({ reason: '' }), {
      params: Promise.resolve({ id: 'request-1' })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Rejection reason is required' });
  });
});
