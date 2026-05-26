import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from '@/lib/bff-api';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

describe('owner timeline BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards timeline pagination to the backend owner endpoint', async () => {
    await GET(
      new NextRequest(
        'http://localhost/api/owner/engagements/engagement-1/timeline?page=1&pageSize=10&order=desc'
      ),
      { params: Promise.resolve({ id: 'engagement-1' }) }
    );

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/owner/engagements/engagement-1/timeline?page=1&pageSize=10&order=desc'
    );
  });
});
