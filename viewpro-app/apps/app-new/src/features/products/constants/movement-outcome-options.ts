import type { MovementBuiltInOutcome } from '../api/types';

export const movementBuiltInOutcomeOptions: { value: MovementBuiltInOutcome; label: string }[] = [
  { value: 'EN_CAPTACION', label: 'En captación' },
  { value: 'DOCUMENTACION_PENDIENTE', label: 'Documentación pendiente' },
  { value: 'PREPARANDO_PUBLICACION', label: 'Preparando publicación' },
  { value: 'PUBLICACION_ACTIVA', label: 'Publicación activa' },
  { value: 'CONSULTAS_Y_VISITAS', label: 'Consultas y visitas' },
  { value: 'NEGOCIACION_OFERTA', label: 'Negociación / oferta' },
  { value: 'RESERVA_INICIADA', label: 'Reserva iniciada' },
  { value: 'DOCUMENTACION_FINAL', label: 'Documentación final' },
  { value: 'CERRADO', label: 'Cerrado' },
  { value: 'CANCELADO', label: 'Cancelado' }
];

export function getBuiltInOutcomeLabel(value: MovementBuiltInOutcome): string {
  return movementBuiltInOutcomeOptions.find((opt) => opt.value === value)?.label ?? value;
}
