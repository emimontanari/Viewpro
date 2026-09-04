export function getOwnerMovementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ARCHIVED: 'Archivada',
    DOCUMENTATION_UPDATE: 'Documentación',
    GENERAL_UPDATE: 'Actualización general',
    INQUIRY: 'Consulta',
    OFFER_RECEIVED: 'Oferta recibida',
    RESTORED: 'Restaurada',
    STATUS_CHANGE: 'Cambio de estado',
    VISIT_COMPLETED: 'Visita realizada',
    VISIT_SCHEDULED: 'Visita programada'
  };

  return labels[type] ?? type;
}

export type OwnerHomeMovementVisualKind =
  | 'documentation'
  | 'general'
  | 'inquiry'
  | 'neutral'
  | 'offer'
  | 'status'
  | 'visit';

export function getOwnerHomeMovementVisualKind(type: string): OwnerHomeMovementVisualKind {
  if (type === 'INQUIRY') return 'inquiry';
  if (type === 'VISIT_SCHEDULED' || type === 'VISIT_COMPLETED') return 'visit';
  if (type === 'DOCUMENTATION_UPDATE') return 'documentation';
  if (type === 'OFFER_RECEIVED') return 'offer';
  if (type === 'STATUS_CHANGE') return 'status';
  if (type === 'GENERAL_UPDATE') return 'general';

  return 'neutral';
}

export function formatOwnerHomeMovementDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric'
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  return `${part('day')}/${part('month')}/${part('year')} · ${part('hour')}:${part('minute')}`;
}

export function getOwnerMovementStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE_PUBLICATION: 'Publicación activa',
    CANCELLED: 'Cancelada',
    CAPTURE: 'Captación',
    CLOSED: 'Cerrada',
    DOCUMENTATION_PENDING: 'Documentación pendiente',
    FINAL_DOCUMENTATION: 'Documentación final',
    INQUIRIES_AND_VISITS: 'Consultas y visitas',
    OFFER_NEGOTIATION: 'Negociación',
    PUBLICATION_PREPARATION: 'Preparando publicación',
    RESERVATION_STARTED: 'Reserva iniciada'
  };

  return labels[status] ?? status;
}

export function getOwnerMovementInterestLabel(level: string) {
  const labels: Record<string, string> = {
    HIGH: 'alto',
    LOW: 'bajo',
    MEDIUM: 'medio'
  };

  return labels[level] ?? level.toLowerCase();
}

export function formatOwnerMovementDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(value));
}

export function formatOwnerMovementShortDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}
