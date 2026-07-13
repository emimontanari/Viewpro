import type { CommandActor } from './admin-actor'

export const ADMIN_TENANT_LIMITS_REPOSITORY = Symbol('ADMIN_TENANT_LIMITS_REPOSITORY')

export type AdminTenantLimits = {
  maxUsers: number | null
  maxActivePropertyEngagements: number | null
  maxDocumentsStorageMb: number | null
}

export type UpdateAdminTenantLimitsInput = {
  tenantId: string
  limits: AdminTenantLimits
  actor: CommandActor
  now: Date
}

export type UpdateAdminTenantLimitsResult =
  | {
      status: 'updated'
      tenantId: string
      previousLimits: AdminTenantLimits
      limits: AdminTenantLimits
      updatedAt: Date
    }
  | {
      status: 'unchanged'
      tenantId: string
      previousLimits: AdminTenantLimits
      limits: AdminTenantLimits
      updatedAt: Date
    }
  | { status: 'notFound' }

export type AdminTenantLimitsRepository = {
  updateTenantLimits(input: UpdateAdminTenantLimitsInput): Promise<UpdateAdminTenantLimitsResult>
}
