import type { NavGroup } from '@/types';

/**
 * Operator console navigation — global operator, no tenant context.
 * Metrics dashboard is the core surface in slice 1.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Inquilinos',
        url: '/dashboard/tenants',
        icon: 'listDetails',
        isActive: false,
        items: []
      }
    ]
  }
];
