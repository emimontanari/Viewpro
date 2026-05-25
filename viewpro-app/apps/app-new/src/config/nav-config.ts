import type { NavGroup } from '@/types';

/**
 * Customer-facing navigation for the inmobiliaria workspace.
 * Keep template/demo routes out of this menu; they may exist in the app for
 * reference, but the sidebar should only expose product areas.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Inmobiliaria',
    items: [
      {
        title: 'Inicio',
        url: '/dashboard',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Propiedades',
        url: '/dashboard/product',
        icon: 'product',
        shortcut: ['p', 'p'],
        isActive: false,
        items: []
      },
      {
        title: 'Seguimiento',
        url: '/dashboard/seguimiento',
        icon: 'trendingUp',
        shortcut: ['s', 's'],
        isActive: false,
        items: []
      },
      {
        title: 'Inmobiliarias',
        url: '/dashboard/workspaces',
        icon: 'workspace',
        isActive: false,
        items: []
      },
      {
        title: 'Equipo',
        url: '/dashboard/workspaces/team',
        icon: 'teams',
        isActive: false,
        items: [],
        access: { requireOrg: true }
      }
    ]
  },
  {
    label: 'Cuenta',
    items: [
      {
        title: 'Perfil',
        url: '/dashboard/profile',
        icon: 'profile',
        shortcut: ['m', 'm'],
        isActive: false,
        items: []
      },
      {
        title: 'Facturación',
        url: '/dashboard/billing',
        icon: 'billing',
        shortcut: ['b', 'b'],
        isActive: false,
        items: [],
        access: { requireOrg: true }
      }
    ]
  }
];
