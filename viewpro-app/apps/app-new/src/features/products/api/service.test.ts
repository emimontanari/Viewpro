import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  clearPrimaryProductAgent,
  createProductOwnerInvitationLink,
  revokeProductOwnerInvitationLink,
  setPrimaryProductAgent
} from './service';
import type {
  ClearPrimaryProductAgentPayload,
  ProductAgent,
  ProductListItem,
  ProductOwnerInvitationLinkResponse,
  ProductOwnerInvitationRevokeResponse,
  PropertyAssignedAgent,
  PropertyEngagement,
  SetPrimaryProductAgentPayload
} from './types';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import type { DashboardSummaryTopProperty } from '@/features/dashboard/api/types';

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

  it('uses primary-only detail agents while list, dashboard, and activity agents stay base agents', () => {
    expectTypeOf<ProductAgent>().toMatchTypeOf<ProductListItem['agents'][number]>();
    expectTypeOf<ProductAgent>().not.toMatchTypeOf<PropertyAssignedAgent>();
    expectTypeOf<PropertyAssignedAgent>().toMatchTypeOf<PropertyEngagement['agents'][number]>();
    expectTypeOf<PropertyAssignedAgent['isPrimary']>().toEqualTypeOf<boolean>();
    expectTypeOf<ProductAgent>().toMatchTypeOf<DashboardSummaryTopProperty['agents'][number]>();
    expectTypeOf<ProductAgent>().toMatchTypeOf<ActivityFeedItem['property']['agents'][number]>();
  });

  it('requires explicit compare-and-set primary payloads', () => {
    expectTypeOf<SetPrimaryProductAgentPayload>().toEqualTypeOf<{
      agentId: string;
      expectedPrimaryAgentId: string | null;
    }>();
    expectTypeOf<ClearPrimaryProductAgentPayload>().toEqualTypeOf<{
      expectedPrimaryAgentId: string | null;
    }>();
  });

  it('sets a primary agent through the detail BFF and returns the confirmed engagement', async () => {
    const engagement = { agents: [{ isPrimary: true }] } as unknown as PropertyEngagement;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(engagement), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      setPrimaryProductAgent('product-1', {
        agentId: 'assignment-2',
        expectedPrimaryAgentId: 'assignment-1'
      })
    ).resolves.toEqual(engagement);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/agents/primary',
      expect.objectContaining({
        body: JSON.stringify({ agentId: 'assignment-2', expectedPrimaryAgentId: 'assignment-1' }),
        headers: { 'content-type': 'application/json' },
        method: 'PUT'
      })
    );
  });

  it('clears an explicitly observed no-primary state through the detail BFF', async () => {
    const engagement = { agents: [] } as unknown as PropertyEngagement;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(engagement), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      clearPrimaryProductAgent('product-1', { expectedPrimaryAgentId: null })
    ).resolves.toEqual(engagement);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/agents/primary/clear',
      expect.objectContaining({
        body: JSON.stringify({ expectedPrimaryAgentId: null }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      })
    );
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
