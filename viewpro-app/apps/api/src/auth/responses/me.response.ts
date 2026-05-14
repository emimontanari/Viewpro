import type { MembershipWithTenant } from '../../memberships/memberships.repository'
import { getPermissionsForRole } from '../../permissions/role-permissions'
import type { Permission } from '../../permissions/permissions.constants'
import type { AuthUserResponse } from './auth-user.response'

export type MembershipResponse = {
  id: string
  role: string
  permissions: Permission[]
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
}

export type MeResponse = {
  user: AuthUserResponse
  memberships: MembershipResponse[]
}

export function mapMembership(membership: MembershipWithTenant): MembershipResponse {
  return {
    id: membership.id,
    role: membership.role,
    permissions: getPermissionsForRole(membership.role),
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      status: membership.tenant.status,
    },
  }
}
