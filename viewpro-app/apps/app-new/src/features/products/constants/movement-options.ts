import type { ProductMovementType } from '../api/types';

export const movementTypeLabels = {
  GENERAL_UPDATE: 'Actualización general',
  INQUIRY: 'Consulta',
  VISIT_SCHEDULED: 'Visita agendada',
  VISIT_COMPLETED: 'Visita realizada',
  OFFER_RECEIVED: 'Oferta recibida',
  DOCUMENTATION_UPDATE: 'Documentación',
  STATUS_CHANGE: 'Estado actualizado',
  ARCHIVED: 'Archivada',
  RESTORED: 'Restaurada'
} satisfies Record<ProductMovementType, string>;

export const manualMovementTypeOptions = [
  { label: movementTypeLabels.GENERAL_UPDATE, value: 'GENERAL_UPDATE' },
  { label: movementTypeLabels.INQUIRY, value: 'INQUIRY' },
  { label: movementTypeLabels.VISIT_SCHEDULED, value: 'VISIT_SCHEDULED' },
  { label: movementTypeLabels.VISIT_COMPLETED, value: 'VISIT_COMPLETED' },
  { label: movementTypeLabels.OFFER_RECEIVED, value: 'OFFER_RECEIVED' },
  { label: movementTypeLabels.DOCUMENTATION_UPDATE, value: 'DOCUMENTATION_UPDATE' },
  { label: movementTypeLabels.STATUS_CHANGE, value: 'STATUS_CHANGE' }
] satisfies Array<{ label: string; value: Exclude<ProductMovementType, 'ARCHIVED' | 'RESTORED'> }>;

export function getMovementTypeLabel(type: ProductMovementType) {
  return movementTypeLabels[type];
}
