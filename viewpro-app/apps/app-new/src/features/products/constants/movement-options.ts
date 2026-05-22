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

export const manualMovementTypes = [
  'GENERAL_UPDATE',
  'INQUIRY',
  'VISIT_SCHEDULED',
  'VISIT_COMPLETED',
  'OFFER_RECEIVED',
  'DOCUMENTATION_UPDATE',
  'STATUS_CHANGE'
] as const satisfies ReadonlyArray<Exclude<ProductMovementType, 'ARCHIVED' | 'RESTORED'>>;

export const manualMovementTypeOptions = manualMovementTypes.map((value) => ({
  label: movementTypeLabels[value],
  value
}));

export function getMovementTypeLabel(type: ProductMovementType) {
  return movementTypeLabels[type];
}
