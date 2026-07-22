'use client';

import { useMemo } from 'react';
import type { NavItem, NavGroup } from '@/types';

// Operator console: all nav items are accessible without tenant/org context.
export function useFilteredNavItems(items: NavItem[]) {
  return useMemo(() => {
    return items.map((item) => ({
      ...item,
      items: item.items ?? []
    }));
  }, [items]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  return useMemo(() => {
    return groups.filter((group) => group.items.length > 0);
  }, [groups]);
}
