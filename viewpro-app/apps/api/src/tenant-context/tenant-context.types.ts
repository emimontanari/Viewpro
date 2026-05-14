import type { TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import type { Permission } from '../permissions/permissions.constants'

export type TenantContext = {
  tenantId: string
  tenantSlug: string
  tenantStatus: TenantStatus
  membershipId: string
  role: TenantRole
  permissions: Permission[]
  userStatus: UserStatus
}

export type RequestWithTenantContext = {
  tenantContext?: TenantContext
}
