import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function ownerDocumentRequestsRequest(query = '') {
  return new NextRequest(`http://localhost/api/owner/document-requests${query}`);
}

describe('owner document requests BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards owner document request query params to the backend owner endpoint', async () => {
    await GET(
      ownerDocumentRequestsRequest(
        '?propertyEngagementId=engagement-1&status=PENDING&page=2&pageSize=10'
      )
    );

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/owner/document-requests?propertyEngagementId=engagement-1&status=PENDING&page=2&pageSize=10'
    );
  });

  it('passes backend error responses through', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Document request not found' }), {
        headers: { 'content-type': 'application/json' },
        status: 404
      })
    );

    const response = await GET(ownerDocumentRequestsRequest('?propertyEngagementId=missing'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Document request not found' });
  });
});
