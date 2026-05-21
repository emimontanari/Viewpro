import { apiRequest, isApiError } from './api-client';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  status: string;
  globalRole: 'USER' | 'VIEWPRO_ADMIN';
};

export type TenantMembership = {
  id: string;
  role: string;
  permissions: string[];
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export type Session = {
  user: AuthUser;
  memberships: TenantMembership[];
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterTenantInput = LoginInput & {
  firstName: string;
  lastName?: string;
  tenantName: string;
};

export function login(input: LoginInput) {
  return apiRequest<Session>('/auth/login', {
    body: input,
    method: 'POST'
  });
}

export function registerTenant(input: RegisterTenantInput) {
  return apiRequest<Session>('/auth/register-tenant', {
    body: input,
    method: 'POST'
  });
}

export function getSession() {
  return apiRequest<Session>('/auth/me');
}

export async function getSessionWithRefresh() {
  try {
    return await getSession();
  } catch (error) {
    if (!isApiError(error) || (error.status !== 401 && error.status !== 403)) {
      throw error;
    }

    return refreshSession();
  }
}

export function refreshSession() {
  return apiRequest<Session>('/auth/refresh', {
    method: 'POST'
  });
}

export function logout() {
  return apiRequest<{ ok: true }>('/auth/logout', {
    method: 'POST'
  });
}

export function getUserDisplayName(user: AuthUser | null | undefined) {
  if (!user) {
    return '';
  }

  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

export function getMembershipRoleLabel(role: string | null | undefined) {
  const normalizedRole = role?.toLowerCase();

  if (normalizedRole?.includes('admin') || normalizedRole?.includes('owner')) {
    return 'Administración';
  }

  if (normalizedRole?.includes('manager')) {
    return 'Gestión';
  }

  return 'Equipo';
}

export function getUserStatusLabel(status: string | null | undefined) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'active' || normalizedStatus === 'enabled') {
    return 'Activa';
  }

  if (normalizedStatus === 'pending') {
    return 'Pendiente';
  }

  if (normalizedStatus === 'disabled' || normalizedStatus === 'inactive') {
    return 'Inactiva';
  }

  return 'Disponible';
}

export function getSingleMembership(session: Session | null | undefined) {
  return session?.memberships.length === 1 ? session.memberships[0] : null;
}
