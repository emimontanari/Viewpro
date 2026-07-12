import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductOwnerInvitationLink, revokeProductOwnerInvitationLink } from './service';
import type {
  ProductOwnerInvitationLinkResponse,
  ProductOwnerInvitationRevokeResponse
} from './types';

const invitationLink: ProductOwnerInvitationLinkResponse = {
  invitationId: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
  expiresAt: '2026-06-12T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/owner-invitations/raw-token-1'
};

const invitationRevoke: ProductOwnerInvitationRevokeResponse = {
  propertyAssetOwnerId: 'owner-link-1',
  revokedInvitationIds: ['invitation-1'],
  revokedCount: 1
};

describe('product API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('revokes a manual owner invitation link through the product BFF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitationRevoke), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeProductOwnerInvitationLink('product-1', 'owner-link-1')).resolves.toEqual(
      invitationRevoke
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/owners/owner-link-1/invitation-link/revoke',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
    expect(JSON.stringify(invitationRevoke)).not.toContain('raw-token');
    expect(invitationRevoke).not.toHaveProperty('invitationUrl');
  });

  it('creates a manual owner invitation link through the product BFF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invitationLink), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createProductOwnerInvitationLink('product-1', 'owner-link-1')).resolves.toEqual(
      invitationLink
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/owners/owner-link-1/invitation-link',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        method: 'POST',
        signal: expect.any(AbortSignal)
      })
    );
  });
});
