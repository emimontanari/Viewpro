import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((_error: unknown, message: string) =>
    Response.json({ message }, { status: 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

describe('users BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('proxies GET to the backend team members endpoint', async () => {
    await GET(new NextRequest('http://localhost/api/users'));

    expect(bffFetchMock).toHaveBeenCalledWith('/team/members');
  });

  it('returns unsupported for POST without calling backend mutations', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/users', {
        body: JSON.stringify({ email: 'new@example.com' }),
        method: 'POST'
      })
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringMatching(/not supported|unsupported/i)
    });
    expect(bffFetchMock).not.toHaveBeenCalled();
  });
});
