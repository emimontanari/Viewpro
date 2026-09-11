import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNavigationAccessPolicy, toNavigationAccessContext } from './navigation-access';
import {
  canAccessPropertyProposal,
  reviewerPropertyProposalAccess,
  sellerPropertyProposalAccess,
  usePropertyProposalAccess
} from './property-proposal-access';
import { propertyProposalMemberships } from '@/test/navigation-access-fixtures';

const activeTenant = vi.fn();
vi.mock('@/lib/session-context', () => ({ useActiveTenant: () => activeTenant() }));

const contextFor = (
  activeTenantId: string | null,
  membership = propertyProposalMemberships.seller,
  isTenantLoading = false
) => ({
  activeTenantId,
  accessContext: toNavigationAccessContext(membership, isTenantLoading)
});

describe('property proposal access policies', () => {
  it('exports deeply frozen singleton policies with exact role and permission arrays', () => {
    expect(sellerPropertyProposalAccess).toEqual({
      roles: ['AGENT'],
      permissions: ['property_proposals.seller']
    });
    expect(reviewerPropertyProposalAccess).toEqual({
      roles: ['MANAGER', 'PRINCIPAL_MANAGER'],
      permissions: ['property_proposals.review']
    });
    for (const policy of [sellerPropertyProposalAccess, reviewerPropertyProposalAccess]) {
      expect(Object.isFrozen(policy)).toBe(true);
      expect(Object.isFrozen(policy.roles)).toBe(true);
      expect(Object.isFrozen(policy.permissions)).toBe(true);
      expect(policy.permissions).not.toContain('engagements.create');
    }
  });

  it('freezes each policy returned by the narrow access-policy constructor', () => {
    const policy = createNavigationAccessPolicy(['AGENT'], ['property_proposals.seller']);

    expect(policy).toEqual({ roles: ['AGENT'], permissions: ['property_proposals.seller'] });
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.roles)).toBe(true);
    expect(Object.isFrozen(policy.permissions)).toBe(true);
  });
});

describe('canAccessPropertyProposal', () => {
  it('allows exact seller and both exact reviewer roles with their respective capabilities', () => {
    expect(canAccessPropertyProposal(sellerPropertyProposalAccess, contextFor('tenant-1'))).toBe(
      true
    );
    expect(
      canAccessPropertyProposal(
        reviewerPropertyProposalAccess,
        contextFor('tenant-1', propertyProposalMemberships.reviewer)
      )
    ).toBe(true);
    expect(
      canAccessPropertyProposal(
        reviewerPropertyProposalAccess,
        contextFor('tenant-1', propertyProposalMemberships.principalReviewer)
      )
    ).toBe(true);
  });

  it('fails closed for swapped roles, missing capabilities, and every missing required capability', () => {
    expect(
      canAccessPropertyProposal(
        sellerPropertyProposalAccess,
        contextFor('tenant-1', propertyProposalMemberships.reviewer)
      )
    ).toBe(false);
    expect(canAccessPropertyProposal(reviewerPropertyProposalAccess, contextFor('tenant-1'))).toBe(
      false
    );
    expect(
      canAccessPropertyProposal(
        sellerPropertyProposalAccess,
        contextFor('tenant-1', { ...propertyProposalMemberships.seller, role: 'MANAGER' })
      )
    ).toBe(false);
    expect(
      canAccessPropertyProposal(
        reviewerPropertyProposalAccess,
        contextFor('tenant-1', {
          ...propertyProposalMemberships.seller,
          permissions: ['property_proposals.review']
        })
      )
    ).toBe(false);
    expect(
      canAccessPropertyProposal(
        sellerPropertyProposalAccess,
        contextFor('tenant-1', { ...propertyProposalMemberships.seller, permissions: [] })
      )
    ).toBe(false);

    const twoCapabilities = createNavigationAccessPolicy(
      ['AGENT'],
      ['property_proposals.seller', 'property_proposals.extra']
    );
    expect(canAccessPropertyProposal(twoCapabilities, contextFor('tenant-1'))).toBe(false);
  });

  it('fails closed without a current resolved operational membership', () => {
    expect(canAccessPropertyProposal(sellerPropertyProposalAccess, contextFor(null))).toBe(false);
    expect(
      canAccessPropertyProposal(sellerPropertyProposalAccess, {
        activeTenantId: 'tenant-1',
        accessContext: toNavigationAccessContext(null, false)
      })
    ).toBe(false);
    expect(
      canAccessPropertyProposal(
        sellerPropertyProposalAccess,
        contextFor('tenant-1', propertyProposalMemberships.seller, true)
      )
    ).toBe(false);
    expect(
      canAccessPropertyProposal(sellerPropertyProposalAccess, {
        activeTenantId: 'tenant-1',
        accessContext: {
          ...toNavigationAccessContext(propertyProposalMemberships.seller, false),
          resolved: false
        }
      })
    ).toBe(false);
  });

  it.each(['SUSPENDED', 'CANCELLED', 'UNKNOWN'])('fails closed for a %s tenant', (status) => {
    expect(
      canAccessPropertyProposal(
        sellerPropertyProposalAccess,
        contextFor('tenant-1', {
          ...propertyProposalMemberships.seller,
          tenant: { ...propertyProposalMemberships.seller.tenant, status }
        })
      )
    ).toBe(false);
  });
});

describe('usePropertyProposalAccess', () => {
  beforeEach(() => {
    activeTenant.mockReset();
  });

  it('disables queries while a tenant switch has stale or absent membership context', () => {
    activeTenant.mockReturnValue({
      activeTenantId: 'tenant-1',
      activeMembership: propertyProposalMemberships.seller,
      isTenantLoading: false
    });
    const { result, rerender } = renderHook(() =>
      usePropertyProposalAccess(sellerPropertyProposalAccess)
    );
    expect(result.current).toEqual({ activeTenantId: 'tenant-1', enabled: true });

    activeTenant.mockReturnValue({
      activeTenantId: 'tenant-2',
      activeMembership: propertyProposalMemberships.seller,
      isTenantLoading: false
    });
    rerender();
    expect(result.current).toEqual({ activeTenantId: 'tenant-2', enabled: false });

    activeTenant.mockReturnValue({
      activeTenantId: 'tenant-2',
      activeMembership: propertyProposalMemberships.seller,
      isTenantLoading: true
    });
    rerender();
    expect(result.current).toEqual({ activeTenantId: 'tenant-2', enabled: false });

    activeTenant.mockReturnValue({
      activeTenantId: 'tenant-2',
      activeMembership: null,
      isTenantLoading: false
    });
    rerender();
    expect(result.current).toEqual({ activeTenantId: 'tenant-2', enabled: false });
  });

  it('enables only after the switched tenant has its own authorized membership', () => {
    activeTenant.mockReturnValue({
      activeTenantId: 'tenant-2',
      activeMembership: propertyProposalMemberships.switchedSeller,
      isTenantLoading: false
    });

    const { result } = renderHook(() => usePropertyProposalAccess(sellerPropertyProposalAccess));
    expect(result.current).toEqual({ activeTenantId: 'tenant-2', enabled: true });
  });
});
