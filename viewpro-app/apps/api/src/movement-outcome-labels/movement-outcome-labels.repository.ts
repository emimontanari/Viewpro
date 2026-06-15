import type { TenantMovementOutcomeLabel } from '@prisma/client'

export const MOVEMENT_OUTCOME_LABELS_REPOSITORY = Symbol('MOVEMENT_OUTCOME_LABELS_REPOSITORY')

export type CreateLabelInput = {
  tenantId: string
  label: string
  color?: string
  createdByUserId: string
}

export type FindManyLabelsInput = {
  tenantId: string
  activeOnly: boolean
}

export type FindByIdForTenantInput = {
  id: string
  tenantId: string
}

export type FindActiveInput = {
  tenantId: string
  label: string
}

export type SoftDeleteInput = {
  id: string
  tenantId: string
}

export type MovementOutcomeLabelsRepository = {
  create(input: CreateLabelInput): Promise<TenantMovementOutcomeLabel>
  findMany(input: FindManyLabelsInput): Promise<TenantMovementOutcomeLabel[]>
  findByIdForTenant(input: FindByIdForTenantInput): Promise<TenantMovementOutcomeLabel | null>
  /** Find the active (non-deleted) label with a case-insensitive name match. */
  findActive(input: FindActiveInput): Promise<TenantMovementOutcomeLabel | null>
  softDelete(input: SoftDeleteInput): Promise<TenantMovementOutcomeLabel>
}
