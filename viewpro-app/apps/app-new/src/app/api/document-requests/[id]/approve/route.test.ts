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

function approveRequest() {
  return new NextRequest('http://localhost/api/document-requests/request-1/approve', {
    method: 'POST'
  });
}

describe('internal document approve BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'request-1', status: 'APPROVED' }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('forwards approve to the backend internal endpoint', async () => {
    await POST(approveRequest(), { params: Promise.resolve({ id: 'request-1' }) });

    expect(bffFetchMock).toHaveBeenCalledWith('/document-requests/request-1/approve', {
      method: 'POST'
    });
  });

  it('passes backend errors through', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Document request not found' }), {
        headers: { 'content-type': 'application/json' },
        status: 404
      })
    );

    const response = await POST(approveRequest(), {
      params: Promise.resolve({ id: 'missing-request' })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Document request not found' });
  });
});
