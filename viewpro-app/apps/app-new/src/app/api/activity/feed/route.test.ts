import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from '@/lib/bff-api';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function activityFeedRequest(query = '') {
  return new NextRequest(`http://localhost/api/activity/feed${query}`);
}

describe('activity feed BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('omits kind=all before forwarding to the backend', async () => {
    await GET(
      activityFeedRequest(
        '?page=1&pageSize=20&kind=all&type=CALL&sellerId=seller-1&dateFrom=2026-01-01&dateTo=2026-01-31'
      )
    );

    const [path] = bffFetchMock.mock.calls[0];

    expect(path).toBe(
      '/analytics/activity-feed?page=1&pageSize=20&type=CALL&sellerId=seller-1&dateFrom=2026-01-01&dateTo=2026-01-31'
    );
    expect(path).not.toContain('kind=');
  });

  it.each([
    ['movement', '/analytics/activity-feed?page=1&pageSize=20&kind=movement'],
    ['document_request', '/analytics/activity-feed?page=1&pageSize=20&kind=document_request']
  ])('forwards kind=%s to the backend', async (kind, expectedPath) => {
    await GET(activityFeedRequest(`?page=1&pageSize=20&kind=${kind}`));

    expect(bffFetchMock).toHaveBeenCalledWith(expectedPath);
  });
});
