'use client';

import { useMemo } from 'react';
import { useActiveTenant } from '@/lib/session-context';
import {
  canAccessNavigation,
  createNavigationAccessPolicy,
  toNavigationAccessContext,
  type FrozenNavigationAccessPolicy,
  type NavigationAccessContext
} from '@/lib/navigation-access';

export const sellerPropertyProposalAccess = createNavigationAccessPolicy(
  ['AGENT'],
  ['property_proposals.seller']
);

export const reviewerPropertyProposalAccess = createNavigationAccessPolicy(
  ['MANAGER', 'PRINCIPAL_MANAGER'],
  ['property_proposals.review']
);

export type PropertyProposalAccessContext = {
  activeTenantId: string | null;
  accessContext: NavigationAccessContext;
};

export type PropertyProposalQueryAccess = Readonly<{
  activeTenantId: string | null;
  enabled: boolean;
}>;

/**
 * Applies proposal policy to the active tenant context used by a query.
 *
 * A matching membership tenant is required as well as navigation authorization
 * so a stale membership cannot enable an old tenant's proposal request.
 */
export function canAccessPropertyProposal(
  policy: FrozenNavigationAccessPolicy,
  { activeTenantId, accessContext }: PropertyProposalAccessContext
): boolean {
  return (
    activeTenantId !== null &&
    accessContext.membership?.tenantId === activeTenantId &&
    canAccessNavigation(policy, accessContext)
  );
}

/**
 * Returns the only two values a later proposal query needs: its active tenant
 * key and the fail-closed `enabled` predicate.
 */
export function usePropertyProposalAccess(
  policy: FrozenNavigationAccessPolicy
): PropertyProposalQueryAccess {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const accessContext = useMemo(
    () => toNavigationAccessContext(activeMembership, isTenantLoading),
    [activeMembership, isTenantLoading]
  );

  return useMemo(
    () => ({
      activeTenantId,
      enabled: canAccessPropertyProposal(policy, { activeTenantId, accessContext })
    }),
    [accessContext, activeTenantId, policy]
  );
}
