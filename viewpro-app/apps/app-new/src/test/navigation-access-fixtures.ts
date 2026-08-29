type Destination = { title: string; href: string };
const operationalDestinations: Destination[] = [{ title: 'Inicio', href: '/dashboard' }, { title: 'Propiedades', href: '/dashboard/product' }, { title: 'Seguimiento', href: '/dashboard/seguimiento' }];
const accountDestinations: Destination[] = [{ title: 'Perfil', href: '/dashboard/profile' }];
const permissions = {
  MANAGER: ['tenant.view', 'team.view', 'engagements.view_all'], PRINCIPAL_MANAGER: ['tenant.view', 'team.view', 'engagements.view_all', 'tenant.manage_settings'],
  AGENT: ['tenant.view', 'engagements.view_assigned']
};
export const membership = (role: string, permissions: string[]) => ({ id: 'membership-1', role, permissions, tenant: { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', status: 'ACTIVE' } });

export const navigationAccessScenarios = [
  {
    state: 'MANAGER',
    activeMembership: membership('MANAGER', permissions.MANAGER),
    destinations: [...operationalDestinations, { title: 'Solicitudes de estado', href: '/dashboard/status-change-requests' }, { title: 'Inmobiliarias', href: '/dashboard/workspaces' }, { title: 'Equipo', href: '/dashboard/users' }, ...accountDestinations], isTenantLoading: false
  }, {
    state: 'PRINCIPAL_MANAGER',
    activeMembership: membership('PRINCIPAL_MANAGER', permissions.PRINCIPAL_MANAGER),
    destinations: [...operationalDestinations, { title: 'Solicitudes de estado', href: '/dashboard/status-change-requests' }, { title: 'Inmobiliarias', href: '/dashboard/workspaces' }, { title: 'Equipo', href: '/dashboard/users' }, { title: 'Contacto WhatsApp', href: '/dashboard/settings/tenant-contact' }, ...accountDestinations], isTenantLoading: false
  }, {
    state: 'AGENT',
    activeMembership: membership('AGENT', permissions.AGENT),
    destinations: [...operationalDestinations, ...accountDestinations], isTenantLoading: false
  },
  ...(['MANAGER', 'PRINCIPAL_MANAGER', 'AGENT'] as const).map((role) => ({
    state: `loading ${role}`,
    activeMembership: membership(role, permissions[role]),
    destinations: [...operationalDestinations, ...accountDestinations], isTenantLoading: true
  }))
];
