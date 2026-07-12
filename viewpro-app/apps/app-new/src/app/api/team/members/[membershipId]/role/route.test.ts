import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((_error: unknown, message: string) =>
    Response.json({ message }, { status: 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const memberResponse = {
  membershipId: 'membership-1',
  userId: 'user-1',
  email: 'agente@example.com',
  firstName: 'Vendedor',
  lastName: null,
  userStatus: 'ACTIVE',
  role: 'MANAGER',
  membershipStatus: 'ACTIVE',
  deactivatedAt: null,
  deactivatedByUserId: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z'
};

function roleRequest(body = { role: 'MANAGER' }) {
  return new NextRequest('http://localhost/api/team/members/membership-1/role', {
    body: JSON.stringify(body),
    method: 'PATCH'
  });
}

describe('team member role BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(memberResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('proxies PATCH to the backend team member role endpoint', async () => {
    const body = { role: 'MANAGER' };

    const response = await PATCH(roleRequest(body), {
      params: Promise.resolve({ membershipId: 'membership 1' })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(memberResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/members/membership%201/role', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    });
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await PATCH(roleRequest(), {
      params: Promise.resolve({ membershipId: 'membership-1' })
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo actualizar el rol.'
    });
  });
});
