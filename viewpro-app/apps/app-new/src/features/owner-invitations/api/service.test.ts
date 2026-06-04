import { afterEach, describe, expect, it, vi } from 'vitest';
import { acceptOwnerInvitation, getOwnerInvitation } from './service';
import type { OwnerInvitationResponse } from './types';

const invitation: OwnerInvitationResponse = {
  id: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
  emailRegistered: false,
  ownerFirstName: 'Ana',
  ownerLastName: 'García',
  property: {
    id: 'property-1',
    title: 'Casa Palermo',
    addressLine: 'Uriarte 1234',
    city: 'CABA',
    province: 'Buenos Aires'
  },
  expiresAt: '2026-06-01T10:00:00.000Z'
};

describe('owner invitation API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches invitation metadata without caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitation), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getOwnerInvitation('raw token/value')).resolves.toEqual(invitation);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/owner-invitations/raw%20token%2Fvalue',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'GET'
      })
    );
  });

  it('accepts an invitation and returns the auth session', async () => {
    const validCredential = 'test-credential-123';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            firstName: 'Ana',
            lastName: 'García',
            status: 'ACTIVE',
            globalRole: 'USER'
          },
          memberships: []
        }),
        { headers: { 'content-type': 'application/json' }, status: 201 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      acceptOwnerInvitation('token-1', {
        firstName: 'Ana',
        lastName: 'García',
        password: validCredential
      })
    ).resolves.toMatchObject({ memberships: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/owner-invitations/token-1/accept',
      expect.objectContaining({
        body: JSON.stringify({
          firstName: 'Ana',
          lastName: 'García',
          password: validCredential
        }),
        credentials: 'include',
        headers: expect.any(Headers),
        method: 'POST'
      })
    );
  });
});
