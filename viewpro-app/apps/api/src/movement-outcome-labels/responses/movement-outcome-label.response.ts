import type { TenantMovementOutcomeLabel } from '@prisma/client'

export type MovementOutcomeLabelResponse = ReturnType<typeof mapMovementOutcomeLabel>

export function mapMovementOutcomeLabel(label: TenantMovementOutcomeLabel) {
  return {
    id: label.id,
    tenantId: label.tenantId,
    label: label.label,
    color: label.color,
    createdByUserId: label.createdByUserId,
    createdAt: label.createdAt.toISOString(),
    deletedAt: label.deletedAt ? label.deletedAt.toISOString() : null,
  }
}
