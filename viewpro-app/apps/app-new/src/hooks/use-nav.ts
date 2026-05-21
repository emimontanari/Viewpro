'use client';

import { useMemo } from 'react';
import { useSession } from '@/lib/session-context';
import { useSelectedTenantId } from '@/lib/tenant-selection';
import type { NavItem, NavGroup } from '@/types';

export function useFilteredNavItems(items: NavItem[]) {
  const { session } = useSession();
  const selectedTenantId = useSelectedTenantId();

  const accessContext = useMemo(() => {
    const membership =
      session?.memberships.find((item) => item.tenant.id === selectedTenantId) ??
      session?.memberships[0];

    return {
      hasOrg: Boolean(membership),
      permissions: membership?.permissions ?? [],
      role: membership?.role
    };
  }, [selectedTenantId, session]);

  return useMemo(() => {
    return items
      .filter((item) => canAccessNavItem(item, accessContext))
      .map((item) => ({
        ...item,
        items: item.items?.filter((childItem) => canAccessNavItem(childItem, accessContext)) ?? []
      }));
  }, [items, accessContext]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const filteredItems = useFilteredNavItems(allItems);

  return useMemo(() => {
    const filteredSet = new Set(filteredItems.map((item) => item.title));
    return groups
      .map((group) => ({
        ...group,
        items: filteredItems.filter((item) =>
          group.items.some((groupItem) => groupItem.title === item.title && filteredSet.has(groupItem.title))
        )
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, filteredItems]);
}

function canAccessNavItem(
  item: NavItem,
  accessContext: { hasOrg: boolean; permissions: string[]; role?: string }
) {
  if (!item.access) {
    return true;
  }

  if (item.access.requireOrg && !accessContext.hasOrg) {
    return false;
  }

  if (item.access.permission && !accessContext.permissions.includes(item.access.permission)) {
    return false;
  }

  if (item.access.role && accessContext.role !== item.access.role) {
    return false;
  }

  return true;
}
