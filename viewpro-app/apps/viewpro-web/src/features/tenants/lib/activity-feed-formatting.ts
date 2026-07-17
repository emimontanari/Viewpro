/**
 * Pure, defensive formatting helpers for the tenant-detail activity feed
 * (platform-tenant-tracking, D9). `TenantActivityItem` is intentionally loose
 * ([key:string]: unknown, mirrors the existing ViewPro backend convention for
 * this endpoint) — every nested field is read defensively here so a shape
 * drift on the wire degrades to a generic label instead of throwing.
 */
import type { TenantActivityItem } from '../api/types';

const FALLBACK_PROPERTY_TITLE = 'Propiedad sin título';
const FALLBACK_DOCUMENT_TITLE = 'Documento';
const FALLBACK_ACTOR = 'Operador';

// Complete map of InmoView's MovementType enum → Spanish labels (schema.prisma
// `enum MovementType`). Unknown values fall back to the raw code (defensive).
const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  GENERAL_UPDATE: 'Actualización general',
  INQUIRY: 'Consulta',
  VISIT_SCHEDULED: 'Visita agendada',
  VISIT_COMPLETED: 'Visita realizada',
  OFFER_RECEIVED: 'Oferta recibida',
  DOCUMENTATION_UPDATE: 'Actualización de documentación',
  STATUS_CHANGE: 'Cambio de estado',
  ARCHIVED: 'Archivado',
  RESTORED: 'Restaurado'
};

type PropertySummary = { title?: unknown };
type ActorSummary = { firstName?: unknown; email?: unknown };
type DocumentRequestSummary = { title?: unknown };

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readProperty(item: TenantActivityItem): { title: string } {
  const property = item.property as PropertySummary | undefined;
  return { title: readString(property?.title, FALLBACK_PROPERTY_TITLE) };
}

function readActorName(actor: unknown, fallback: string): string {
  if (actor && typeof actor === 'object') {
    const { firstName, email } = actor as ActorSummary;
    if (typeof firstName === 'string' && firstName.trim().length > 0) {
      return firstName;
    }
    if (typeof email === 'string' && email.trim().length > 0) {
      return email;
    }
  }
  return fallback;
}

function formatMovementType(rawType: string): string {
  return MOVEMENT_TYPE_LABELS[rawType] ?? rawType;
}

export type TenantActivityItemDescription = {
  title: string;
  subtitle: string;
};

/**
 * Derives a display title + subtitle from a merged activity feed item.
 * Never throws — every nested field access is defensive (the item's shape is
 * only guaranteed for `kind`/`id`/`createdAt`).
 */
export function describeTenantActivityItem(item: TenantActivityItem): TenantActivityItemDescription {
  const { title: propertyTitle } = readProperty(item);

  if (item.kind === 'movement') {
    const rawType = readString(item.type, 'Movimiento');
    const actor = readActorName(item.createdBy, FALLBACK_ACTOR);

    return {
      title: `${formatMovementType(rawType)} · ${propertyTitle}`,
      subtitle: `Registrado por ${actor}`
    };
  }

  const documentRequest = item.documentRequest as DocumentRequestSummary | undefined;
  const documentTitle = readString(documentRequest?.title, FALLBACK_DOCUMENT_TITLE);
  const actor = readActorName(item.requestedBy, FALLBACK_ACTOR);

  return {
    title: `${documentTitle} · ${propertyTitle}`,
    subtitle: `Solicitado por ${actor}`
  };
}

const ACTIVITY_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short'
});

/** Formats an ISO timestamp as an es-AR short date/time string; fails safe to '—'. */
export function formatActivityTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return ACTIVITY_TIMESTAMP_FORMATTER.format(date);
}
