'use client';

import { useMemo } from 'react';
import { useActiveTenant } from '@/lib/session-context';
import {
  filterNavigationGroups,
  toNavigationAccessContext,
  type NavigationAccessContext
} from '@/lib/navigation-access';
import type { NavGroup } from '@/types';

export function useFilteredNavGroups(groups: NavGroup[]) {
  const { activeMembership, isTenantLoading } = useActiveTenant();

  const accessContext = useMemo<NavigationAccessContext>(
    () => toNavigationAccessContext(activeMembership, isTenantLoading),
    [activeMembership, isTenantLoading]
  );

  return useMemo(() => {
    return filterNavigationGroups(groups, accessContext);
  }, [groups, accessContext]);
}
