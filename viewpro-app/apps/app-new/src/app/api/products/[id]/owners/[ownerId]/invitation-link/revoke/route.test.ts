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
  propertyAssetOwnerId: 'owner-link-1',
  revokedInvitationIds: ['invitation-1'],
  revokedCount: 1
};

function revokeRequest() {
  return new NextRequest(
    'http://localhost/api/products/product-1/owners/owner-link-1/invitation-link/revoke',
    { method: 'POST' }
  );
}

describe('product owner invitation link revoke BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(revokeResponse), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('proxies POST to the backend owner invitation revoke endpoint', async () => {
    const response = await POST(revokeRequest(), {
      params: Promise.resolve({ id: 'product-1', ownerId: 'owner-link-1' })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(revokeResponse);
    expect(bffFetchMock).toHaveBeenCalledWith(
      '/property-engagements/product-1/owners/owner-link-1/invitation-link/revoke',
      { method: 'POST' }
    );
  });

  it('returns a Spanish fallback when the BFF proxy fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(revokeRequest(), {
      params: Promise.resolve({ id: 'product-1', ownerId: 'owner-link-1' })
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo revocar la invitación.'
    });
  });
});
