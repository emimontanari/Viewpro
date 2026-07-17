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

// Spanish TenantRole labels — COPIED (not imported) from
// apps/app-new/src/features/users/components/team-members-list.tsx `formatRole`
// (Design B: InmoView-side isolation, no cross-app import).
const TENANT_ROLE_LABELS: Record<string, string> = {
  PRINCIPAL_MANAGER: 'Encargado principal',
  MANAGER: 'Encargado',
  AGENT: 'Vendedor'
};

function formatTenantRole(rawRole: unknown): string {
  return typeof rawRole === 'string' ? (TENANT_ROLE_LABELS[rawRole] ?? rawRole) : 'rol desconocido';
}

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
 * describeMembershipActivityItem — renders a `kind: 'membership'` item
 * (platform-user-activity-capture). `subject` (who the event is about) and
 * `actor` (who performed it, or absent) are read defensively via the same
 * `readActorName` helper used for `createdBy`/`requestedBy` above.
 */
function describeMembershipActivityItem(item: TenantActivityItem): TenantActivityItemDescription {
  const subjectLabel = readActorName(item.subject, 'Usuario');
  const actorLabel = readActorName(item.actor, FALLBACK_ACTOR);

  switch (item.membershipEvent) {
    case 'INVITED':
      return {
        title: `Usuario invitado · ${subjectLabel}`,
        subtitle: `Invitado por ${actorLabel}`
      };
    case 'JOINED':
      return {
        title: `Usuario se unió · ${subjectLabel}`,
        subtitle: 'Se unió al equipo'
      };
    case 'DEACTIVATED':
      return {
        title: `Usuario desactivado · ${subjectLabel}`,
        subtitle: `Desactivado por ${actorLabel}`
      };
    case 'ROLE_CHANGED': {
      const previousRoleLabel = formatTenantRole(item.previousRole);
      const newRoleLabel = formatTenantRole(item.newRole);
      return {
        title: `Rol cambiado · ${subjectLabel}: ${previousRoleLabel} → ${newRoleLabel}`,
        subtitle: `Cambiado por ${actorLabel}`
      };
    }
    default:
      return {
        title: `Actividad de usuario · ${subjectLabel}`,
        subtitle: 'Actividad del equipo'
      };
  }
}

/**
 * Derives a display title + subtitle from a merged activity feed item.
 * Never throws — every nested field access is defensive (the item's shape is
 * only guaranteed for `kind`/`id`/`createdAt`).
 *
 * Discriminates EXHAUSTIVELY on every known `kind` (movement/document_request/
 * membership) — a `membership` item is never rendered via the
 * documentRequest/requestedBy fallback path (platform-user-activity-capture).
 * A genuinely unknown future `kind` still falls back to the document-request
 * branch, preserving the "never throws" contract.
 */
export function describeTenantActivityItem(item: TenantActivityItem): TenantActivityItemDescription {
  const { title: propertyTitle } = readProperty(item);

  switch (item.kind) {
    case 'movement': {
      const rawType = readString(item.type, 'Movimiento');
      const actor = readActorName(item.createdBy, FALLBACK_ACTOR);

      return {
        title: `${formatMovementType(rawType)} · ${propertyTitle}`,
        subtitle: `Registrado por ${actor}`
      };
    }
    case 'membership':
      return describeMembershipActivityItem(item);
    default: {
      const documentRequest = item.documentRequest as DocumentRequestSummary | undefined;
      const documentTitle = readString(documentRequest?.title, FALLBACK_DOCUMENT_TITLE);
      const actor = readActorName(item.requestedBy, FALLBACK_ACTOR);

      return {
        title: `${documentTitle} · ${propertyTitle}`,
        subtitle: `Solicitado por ${actor}`
      };
    }
  }
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

/**
 * Presentation-only classification of an activity item into one of the four
 * feed filter buckets (feat/web-tenant-detail-redesign). Reads the item's
 * STRUCTURED discriminants (kind/type) — not the rendered title — so it stays
 * in lock-step with describeTenantActivityItem without depending on copy.
 * Never throws; an unknown future `kind` degrades to the same bucket as the
 * describe() fallback (document → 'deed').
 */
export type ActivityCategory = 'user' | 'deed' | 'update' | 'inquiry';

export function categorizeActivityItem(item: TenantActivityItem): ActivityCategory {
  switch (item?.kind) {
    case 'membership':
      return 'user';
    case 'movement':
      return item.type === 'INQUIRY' ? 'inquiry' : 'update';
    case 'document_request':
    default:
      return 'deed';
  }
}

const UNKNOWN_DAY_KEY = 'unknown';
const UNKNOWN_DATE_LABEL = 'Fecha desconocida';

const ACTIVITY_DATE_SEPARATOR_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const ACTIVITY_FULL_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'full',
  timeStyle: 'medium'
});

/**
 * Stable per-calendar-day grouping key derived from an item's existing
 * `createdAt` (YYYY-MM-DD in local time). Malformed/absent dates collapse to a
 * single neutral bucket so the feed degrades gracefully instead of throwing.
 */
export function activityDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_DAY_KEY;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Human date label for a day separator; neutral label for malformed input. */
export function formatActivityDateSeparator(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_DATE_LABEL;
  }
  return ACTIVITY_DATE_SEPARATOR_FORMATTER.format(date);
}

/** Fuller date/time string for the timestamp `title` tooltip; fails safe to '—'. */
export function formatActivityFullTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return ACTIVITY_FULL_TIMESTAMP_FORMATTER.format(date);
}
