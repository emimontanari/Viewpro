import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptTeamInvitation, getTeamInvitation } from './service';
import type { TeamInvitationResponse } from './types';

const invitation: TeamInvitationResponse = {
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  emailRegistered: false,
  tenant: {
    id: 'tenant-1',
    name: 'Inmobiliaria Norte',
    slug: 'inmobiliaria-norte',
    status: 'ACTIVE'
  }
};

describe('team invitation API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches team invitation metadata without caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitation), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTeamInvitation('raw token/value')).resolves.toEqual(invitation);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/team-invitations/raw%20token%2Fvalue',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'GET'
      })
    );
  });

  it('accepts a team invitation and returns the auth session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'agente@example.com',
            firstName: 'Ana',
            lastName: 'García',
            status: 'ACTIVE',
            globalRole: 'USER'
          },
          memberships: [
            {
              id: 'membership-1',
              role: 'AGENT',
              permissions: [],
              tenant: invitation.tenant
            }
          ]
        }),
        { headers: { 'content-type': 'application/json' }, status: 201 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      acceptTeamInvitation('token-1', {
        firstName: 'Ana',
        lastName: 'García',
        mode: 'register',
        password: 'test-credential-123'
      })
    ).resolves.toMatchObject({ user: { email: 'agente@example.com' } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/team-invitations/token-1/accept',
      expect.objectContaining({
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'García',
          mode: 'register',
          password: 'test-credential-123'
        }),
        credentials: 'include',
        headers: expect.any(Headers),
        method: 'POST'
      })
    );
  });
});
