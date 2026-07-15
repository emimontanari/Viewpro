import type { Prisma, TenantStatus } from '@prisma/client'
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
  | {
      status: 'terminal'
      tenantId: string
      currentStatus: TenantStatus
      updatedAt: Date
    }
  | { status: 'notFound' }

export type AdminTenantStatusRepository = {
  /**
   * Updates tenant status.
   * If `tx` is provided the mutation runs inside that existing transaction
   * (no nested $transaction). If omitted, the repo starts its own transaction
   * — preserving the existing /admin call-site behaviour exactly.
   */
  updateTenantStatus(
    input: UpdateAdminTenantStatusInput,
    tx?: Prisma.TransactionClient,
  ): Promise<UpdateAdminTenantStatusResult>
}
