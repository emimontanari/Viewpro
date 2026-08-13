import type { NavigationAccessPolicy, NavGroup } from '@/types';

export const workspaceAdministrationAccess: Readonly<NavigationAccessPolicy> = Object.freeze({ roles: Object.freeze(['MANAGER', 'PRINCIPAL_MANAGER']), permissions: Object.freeze(['team.view']) });

/**
 * Customer-facing navigation for the inmobiliaria workspace.
 * Keep template/demo routes out of this menu; they may exist in the app for
 * reference, but the sidebar should only expose product areas.
 */
export const ownerNavGroups: NavGroup[] = [
  {
    label: 'Propietario',
    items: [
      {
        title: 'Mis propiedades',
        url: '/owner',
        icon: 'product',
        isActive: false,
        items: []
      }
    ]
  }
];

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
        title: 'Solicitudes de estado',
        url: '/dashboard/status-change-requests',
        icon: 'trendingUp',
        isActive: false,
        items: [],
        access: { permissions: ['engagements.view_all'] }
      },
      {
        title: 'Inmobiliarias',
        url: '/dashboard/workspaces',
        icon: 'workspace',
        isActive: false,
        items: [],
        access: workspaceAdministrationAccess
      },
      {
        title: 'Equipo',
        url: '/dashboard/users',
        icon: 'teams',
        isActive: false,
        items: [],
        access: workspaceAdministrationAccess
      }
    ]
  },
  {
    label: 'Configuración',
    items: [
      {
        title: 'Contacto WhatsApp',
        url: '/dashboard/settings/tenant-contact',
        icon: 'profile',
        isActive: false,
        items: [],
        access: { roles: ['PRINCIPAL_MANAGER'], permissions: ['tenant.manage_settings'] }
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
      }
    ]
  }
];
