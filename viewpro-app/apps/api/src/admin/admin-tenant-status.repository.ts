import type { TenantStatus } from '@prisma/client'
import type { CommandActor } from './admin-actor'

export const ADMIN_TENANT_STATUS_REPOSITORY = Symbol('ADMIN_TENANT_STATUS_REPOSITORY')

export type UpdateAdminTenantStatusInput = {
  tenantId: string
  targetStatus: TenantStatus
  actor: CommandActor
  now: Date
}

export type UpdateAdminTenantStatusResult =
  | {
      status: 'updated'
      tenantId: string
      previousStatus: TenantStatus
      currentStatus: TenantStatus
      updatedAt: Date
    }
  | {
      status: 'unchanged'
      tenantId: string
      previousStatus: TenantStatus
      currentStatus: TenantStatus
      updatedAt: Date
    }
  | { status: 'notFound' }

export type AdminTenantStatusRepository = {
  updateTenantStatus(input: UpdateAdminTenantStatusInput): Promise<UpdateAdminTenantStatusResult>
}
