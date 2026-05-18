import { apiRequest } from './api-client'

export type AuthUser = {
  id: string
  email: string
  firstName: string
  lastName?: string | null
  status: string
  globalRole: 'USER' | 'VIEWPRO_ADMIN'
}

export type TenantMembership = {
  id: string
  role: string
  permissions: string[]
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
}

export type Session = {
  user: AuthUser
  memberships: TenantMembership[]
}

export type LoginInput = {
  email: string
  password: string
}

export type RegisterTenantInput = LoginInput & {
  firstName: string
  lastName?: string
  tenantName: string
}

export function registerTenant(input: RegisterTenantInput) {
  return apiRequest<Session>('/auth/register-tenant', {
    body: input,
    method: 'POST',
  })
}

export function login(input: LoginInput) {
  return apiRequest<Session>('/auth/login', {
    body: input,
    method: 'POST',
  })
}

export function logout() {
  return apiRequest<{ ok?: boolean }>('/auth/logout', {
    method: 'POST',
  })
}

export function getSession() {
  return apiRequest<Session>('/auth/me')
}

export function getSingleMembership(session: Session) {
  return session.memberships.length === 1 ? session.memberships[0] : null
}
