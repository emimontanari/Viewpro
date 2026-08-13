'use client';

import { useMemo } from 'react';
import { useActiveTenant } from '@/lib/session-context';
import { filterNavigationGroups, type NavigationAccessContext } from '@/lib/navigation-access';
import type { NavGroup } from '@/types';

export function useFilteredNavGroups(groups: NavGroup[]) {
  const { activeMembership, isTenantLoading } = useActiveTenant();

  const accessContext = useMemo<NavigationAccessContext>(() => {
    return {
      resolved: !isTenantLoading,
      membership: activeMembership
        ? { role: activeMembership.role, permissions: activeMembership.permissions }
        : null
    };
  }, [activeMembership, isTenantLoading]);

  return useMemo(() => {
    return filterNavigationGroups(groups, accessContext);
  }, [groups, accessContext]);
}
