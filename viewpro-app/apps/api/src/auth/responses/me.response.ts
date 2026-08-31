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
  /**
   * Whether this identity can also enter the owner portal.
   *
   * Post-login routing used to consider memberships alone, so a user who is
   * both a seller and a property owner was indistinguishable from a seller and
   * was never offered the owner portal — the dashboard sidebar carries no link
   * to it either (#326). A boolean, never the owner records: what is inside
   * the portal stays behind the portal's own authorised calls.
   */
  hasOwnerAccess: boolean
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
