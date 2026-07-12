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
const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
};

const pendingInvitationsResponse = {
  items: [
    {
      invitationId: 'invitation-1',
      email: 'agente@example.com',
      role: 'AGENT',
      status: 'PENDING',
      expiresAt: '2026-06-14T10:00:00.000Z',
      createdAt: '2026-05-31T10:00:00.000Z',
      invitedByUserId: 'user-1'
    }
  ]
};

describe('team invitations BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(invitationResponse), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('proxies GET to the backend team invitations endpoint', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(pendingInvitationsResponse), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(pendingInvitationsResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/invitations', { method: 'GET' });
  });

  it('returns a Spanish fallback when the GET BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudieron cargar las invitaciones.'
    });
  });

  it('proxies POST to the backend team invitations endpoint', async () => {
    const body = { email: 'agente@example.com', role: 'AGENT' };

    const response = await POST(
      new NextRequest('http://localhost/api/team/invitations', {
        body: JSON.stringify(body),
        method: 'POST'
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(invitationResponse);
    expect(bffFetchMock).toHaveBeenCalledWith('/team/invitations', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(
      new NextRequest('http://localhost/api/team/invitations', {
        body: JSON.stringify({ email: 'agente@example.com', role: 'AGENT' }),
        method: 'POST'
      })
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo crear la invitación.'
    });
  });
});
