import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((_error: unknown, message: string) =>
    Response.json({ message }, { status: 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const revokeResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'REVOKED',
  expiresAt: '2026-06-14T10:00:00.000Z',
  revokedAt: '2026-06-01T10:00:00.000Z'
};

function revokeRequest() {
  return new NextRequest('http://localhost/api/team/invitations/invitation-1/revoke', {
    method: 'POST'
  });
}

describe('team invitation revoke BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(revokeResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('proxies POST to the backend revoke endpoint', async () => {
    const response = await POST(revokeRequest(), {
      params: Promise.resolve({ id: 'invitation-1' })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(revokeResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/invitations/invitation-1/revoke', {
      method: 'POST'
    });
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(revokeRequest(), {
      params: Promise.resolve({ id: 'invitation-1' })
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo revocar la invitación.'
    });
  });
});
