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
        title: 'Inmobiliarias',
        url: '/dashboard/tenants',
        icon: 'listDetails',
        isActive: false,
        items: []
      },
      {
        title: 'Auditoría',
        url: '/dashboard/audit',
        icon: 'clock',
        isActive: false,
        items: []
      },
      // platform-operator-management (A4, PR2) — OWNER-only surface (Design
      // Decision 6). `access.role` is enforced client-side by app-sidebar's
      // filterNavGroupsByRole; the server-side 403 remains the real guard.
      {
        title: 'Operadores',
        url: '/dashboard/operators',
        icon: 'user',
        isActive: false,
        items: [],
        access: { role: 'OWNER' }
      }
    ]
  }
];
