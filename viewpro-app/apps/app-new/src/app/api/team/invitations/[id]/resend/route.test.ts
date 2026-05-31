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
const invitationResponse = {
  invitationId: 'invitation-2',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/fresh-token'
};

function resendRequest() {
  return new NextRequest('http://localhost/api/team/invitations/invitation-1/resend', {
    method: 'POST'
  });
}

describe('team invitation resend BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(invitationResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('proxies POST to the backend resend endpoint', async () => {
    const response = await POST(resendRequest(), {
      params: Promise.resolve({ id: 'invitation-1' })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(invitationResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/invitations/invitation-1/resend', {
      method: 'POST'
    });
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(resendRequest(), {
      params: Promise.resolve({ id: 'invitation-1' })
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo regenerar la invitación.'
    });
  });
});
