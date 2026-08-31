import { apiRequest, isApiError } from './api-client';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  status: string;
  globalRole: 'USER' | 'VIEWPRO_ADMIN';
  emailVerifiedAt: string | null;
};

export const TENANT_PERMISSIONS = {
  DOCUMENTS_REQUEST: 'documents.request',
  DOCUMENTS_REVIEW_OWN: 'documents.review_own',
  DOCUMENTS_VIEW_ALL: 'documents.view_all',
  ENGAGEMENTS_CREATE: 'engagements.create',
  ENGAGEMENTS_VIEW_ALL: 'engagements.view_all',
  MOVEMENTS_CREATE: 'movements.create',
  TENANT_MANAGE_SETTINGS: 'tenant.manage_settings'
} as const;

export type TenantPermission = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];

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
  /**
   * Whether this identity can also enter the owner portal. Post-login routing
   * used to consider memberships alone, so a user who is both a seller and a
   * property owner was never offered the owner portal (#326).
   */
  hasOwnerAccess: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterTenantInput = LoginInput & {
  firstName: string;
  lastName?: string;
  tenantName: string;
  whatsappPhone: string;
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

export function requestPasswordReset(input: { email: string }) {
  return apiRequest<{ ok: true }>('/auth/forgot-password', {
    body: input,
    method: 'POST'
  });
}

export function resetPassword(input: { token: string; password: string }) {
  return apiRequest<{ ok: true }>('/auth/reset-password', {
    body: input,
    method: 'POST'
  });
}

export function verifyEmail(input: { token: string }) {
  return apiRequest<{ ok: true }>('/auth/verify-email', {
    body: input,
    method: 'POST'
  });
}

export function resendVerification() {
  return apiRequest<{ ok: true }>('/auth/resend-verification', {
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
  return ({
    AGENT: 'Vendedor',
    MANAGER: 'Encargado',
    PRINCIPAL_MANAGER: 'Encargado principal'
  } as Record<string, string>)[role ?? ''] ?? 'Equipo';
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

export function hasTenantPermission(
  membership: TenantMembership | null | undefined,
  permission: TenantPermission
) {
  return Boolean(membership?.permissions.includes(permission));
}

export function canManagePropertyEngagements(membership: TenantMembership | null | undefined) {
  return hasTenantPermission(membership, TENANT_PERMISSIONS.ENGAGEMENTS_CREATE);
}

export function canManageTenantSettings(membership: TenantMembership | null | undefined) {
  return hasTenantPermission(membership, TENANT_PERMISSIONS.TENANT_MANAGE_SETTINGS);
}

export function canReviewTenantDocuments(membership: TenantMembership | null | undefined) {
  return (
    hasTenantPermission(membership, TENANT_PERMISSIONS.DOCUMENTS_VIEW_ALL) ||
    hasTenantPermission(membership, TENANT_PERMISSIONS.DOCUMENTS_REVIEW_OWN)
  );
}
