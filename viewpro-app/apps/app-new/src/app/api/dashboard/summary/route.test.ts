import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from '@/lib/bff-api';
import { GET } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function dashboardSummaryRequest(query = '') {
  return new NextRequest(`http://localhost/api/dashboard/summary${query}`);
}

describe('dashboard summary BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ range: { preset: '7d' } }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('omits range when no range is provided', async () => {
    await GET(dashboardSummaryRequest());

    expect(bffFetchMock).toHaveBeenCalledWith('/analytics/dashboard-summary');
  });

  it.each([
    ['7d', '/analytics/dashboard-summary?range=7d'],
    ['14d', '/analytics/dashboard-summary?range=14d'],
    ['30d', '/analytics/dashboard-summary?range=30d']
  ])('forwards range=%s to the backend', async (range, expectedPath) => {
    await GET(dashboardSummaryRequest(`?range=${range}`));

    expect(bffFetchMock).toHaveBeenCalledWith(expectedPath);
  });

  it('omits unsupported ranges before forwarding to the backend', async () => {
    await GET(dashboardSummaryRequest('?range=90d'));

    expect(bffFetchMock).toHaveBeenCalledWith('/analytics/dashboard-summary');
  });
});
