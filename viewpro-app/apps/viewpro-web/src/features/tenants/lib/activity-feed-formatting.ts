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

// ── Collapsible detail ──────────────────────────────────────────────────────
// Rich per-item technical detail surfaced in each feed row's collapsible panel.
// It is a monitoring surface, so the operator can drill into who/when (to the
// second) plus the structured movement/document fields the wire already carries
// but the compact row does not show. Every field is read defensively and empty
// values are omitted, so a wire drift yields fewer rows rather than throwing.

const PROPERTY_STATUS_LABELS: Record<string, string> = {
  CAPTURE: 'En captación',
  DOCUMENTATION_PENDING: 'Documentación pendiente',
  PUBLICATION_PREPARATION: 'Preparando publicación',
  ACTIVE_PUBLICATION: 'Publicación activa',
  INQUIRIES_AND_VISITS: 'Consultas y visitas',
  OFFER_NEGOTIATION: 'Negociación de oferta',
  RESERVATION_STARTED: 'Reserva iniciada',
  FINAL_DOCUMENTATION: 'Documentación final',
  CLOSED: 'Cerrado',
  CANCELLED: 'Cancelado'
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado'
};

const DOCUMENT_VERSION_STATUS_LABELS: Record<string, string> = {
  PENDING_UPLOAD: 'Esperando archivo',
  UPLOADED: 'Subido',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado'
};

const INTEREST_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto'
};

const MOVEMENT_SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  SYSTEM: 'Sistema'
};

const OFFER_CURRENCY_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
});

function labelFrom(map: Record<string, string>, raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? (map[raw] ?? raw) : null;
}

function formatOfferAmount(cents: unknown): string | null {
  return typeof cents === 'number' && Number.isFinite(cents)
    ? OFFER_CURRENCY_FORMATTER.format(cents / 100)
    : null;
}

// "Nombre (email)" — the full "who" for the detail panel; degrades to whichever
// part is present, then to a neutral fallback.
function readActorFull(actor: unknown, fallback: string): string {
  if (actor && typeof actor === 'object') {
    const { firstName, email } = actor as ActorSummary;
    const name = typeof firstName === 'string' && firstName.trim().length > 0 ? firstName.trim() : null;
    const mail = typeof email === 'string' && email.trim().length > 0 ? email.trim() : null;
    if (name && mail) return `${name} (${mail})`;
    if (name) return name;
    if (mail) return mail;
  }
  return fallback;
}

export type TenantActivityDetailField = { label: string; value: string };

function readPropertyDetail(item: TenantActivityItem): TenantActivityDetailField[] {
  const property = item.property as
    | { title?: unknown; addressLine?: unknown; city?: unknown; province?: unknown; agents?: unknown }
    | undefined;
  if (!property || typeof property !== 'object') {
    return [];
  }

  const out: TenantActivityDetailField[] = [];
  const title = readString(property.title, '');
  if (title) {
    out.push({ label: 'Propiedad', value: title });
  }

  const address = [property.addressLine, property.city, property.province]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(', ');
  if (address) {
    out.push({ label: 'Dirección', value: address });
  }

  const agents = Array.isArray(property.agents) ? property.agents : [];
  const agentNames = agents.map((agent) => readActorName(agent, '')).filter((name) => name.length > 0);
  if (agentNames.length > 0) {
    out.push({
      label: agentNames.length === 1 ? 'Vendedor' : 'Vendedores',
      value: agentNames.join(', ')
    });
  }

  return out;
}

export type PropertyImageSummary = {
  id: string;
  url: string;
  isPrimary: boolean;
  originalFilename: string;
};

/**
 * readPropertyImages — operator-activity-media (Slice 1) design D8.
 *
 * Defensive loose-wire reader, mirrors `readPropertyDetail`: a missing
 * `property`, a missing/malformed `property.images`, or individually
 * malformed entries within the array all degrade to fewer/zero images —
 * never a throw.
 */
export function readPropertyImages(item: TenantActivityItem): PropertyImageSummary[] {
  const property = item.property as { images?: unknown } | undefined;
  if (!property || typeof property !== 'object' || !Array.isArray(property.images)) {
    return [];
  }

  const out: PropertyImageSummary[] = [];
  for (const raw of property.images) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const { id, url, isPrimary, originalFilename } = raw as Record<string, unknown>;
    if (typeof id === 'string' && typeof url === 'string') {
      out.push({
        id,
        url,
        isPrimary: typeof isPrimary === 'boolean' ? isPrimary : false,
        originalFilename: typeof originalFilename === 'string' ? originalFilename : ''
      });
    }
  }

  return out;
}

/**
 * readDocumentCurrentVersionId — operator-activity-media (Slice 2b) design
 * D6/D8.
 *
 * Defensive loose-wire reader, mirrors `readPropertyImages`: a missing
 * `documentRequest`, a null/absent `currentVersion` (no file uploaded yet),
 * or a malformed `currentVersion.id` all degrade to `null` — never a throw.
 * Used to gate the "Ver documento" action button (only shown when a version
 * id is present).
 */
export function readDocumentCurrentVersionId(item: TenantActivityItem): string | null {
  const documentRequest = item.documentRequest as { currentVersion?: unknown } | undefined;
  if (!documentRequest || typeof documentRequest !== 'object') {
    return null;
  }

  const currentVersion = documentRequest.currentVersion as { id?: unknown } | undefined;
  if (!currentVersion || typeof currentVersion !== 'object') {
    return null;
  }

  return typeof currentVersion.id === 'string' && currentVersion.id.length > 0 ? currentVersion.id : null;
}

/**
 * Builds the ordered list of technical detail fields shown when a feed row is
 * expanded. Discriminates on `kind` exactly like describeTenantActivityItem and
 * never throws — absent fields are simply omitted.
 */
export function buildTenantActivityDetail(item: TenantActivityItem): TenantActivityDetailField[] {
  const fields: TenantActivityDetailField[] = [];
  const push = (label: string, value: string | null) => {
    if (value && value.trim().length > 0) {
      fields.push({ label, value });
    }
  };
  const fullTimestamp = formatActivityFullTimestamp(item.createdAt);

  switch (item.kind) {
    case 'movement': {
      push('Registrado por', readActorFull(item.createdBy, FALLBACK_ACTOR));
      push('Fecha y hora', fullTimestamp);
      push('Tipo', formatMovementType(readString(item.type, 'Movimiento')));
      push('Observación', readString(item.observation, ''));
      push('Próximo paso', readString(item.nextStep, ''));

      const previousStatus = labelFrom(PROPERTY_STATUS_LABELS, item.previousStatus);
      const newStatus = labelFrom(PROPERTY_STATUS_LABELS, item.newStatus);
      if (previousStatus && newStatus) {
        push('Cambio de estado', `${previousStatus} → ${newStatus}`);
      } else if (newStatus) {
        push('Estado', newStatus);
      }

      push('Nivel de interés', labelFrom(INTEREST_LEVEL_LABELS, item.interestLevel));
      if (typeof item.interestCount === 'number' && item.interestCount > 0) {
        push('Consultas', String(item.interestCount));
      }
      if (typeof item.visitCount === 'number' && item.visitCount > 0) {
        push('Visitas', String(item.visitCount));
      }
      push('Oferta', formatOfferAmount(item.offerAmountCents));
      push('Origen', labelFrom(MOVEMENT_SOURCE_LABELS, item.source));
      fields.push(...readPropertyDetail(item));
      break;
    }
    case 'membership': {
      push('Usuario', readActorFull(item.subject, 'Usuario'));
      if (item.actor) {
        push('Realizado por', readActorFull(item.actor, FALLBACK_ACTOR));
      }
      push('Fecha y hora', fullTimestamp);
      if (item.membershipEvent === 'ROLE_CHANGED') {
        push('Cambio de rol', `${formatTenantRole(item.previousRole)} → ${formatTenantRole(item.newRole)}`);
      }
      break;
    }
    default: {
      const documentRequest = item.documentRequest as
        | { title?: unknown; description?: unknown; status?: unknown; currentVersion?: unknown }
        | undefined;
      push('Solicitado por', readActorFull(item.requestedBy, FALLBACK_ACTOR));
      push('Fecha y hora', fullTimestamp);
      push('Documento', readString(documentRequest?.title, ''));
      push('Descripción', readString(documentRequest?.description, ''));
      push('Estado', labelFrom(DOCUMENT_STATUS_LABELS, documentRequest?.status));

      const currentVersion = documentRequest?.currentVersion as
        | { originalFilename?: unknown; status?: unknown }
        | undefined;
      if (currentVersion && typeof currentVersion === 'object') {
        const filename = readString(currentVersion.originalFilename, '');
        const versionStatus = labelFrom(DOCUMENT_VERSION_STATUS_LABELS, currentVersion.status);
        if (filename) {
          push('Archivo', versionStatus ? `${filename} · ${versionStatus}` : filename);
        }
      } else {
        push('Archivo', 'Sin archivo cargado');
      }

      const owner = item.owner as
        | { ownerFirstName?: unknown; ownerLastName?: unknown; email?: unknown }
        | undefined;
      if (owner && typeof owner === 'object') {
        const ownerName = [owner.ownerFirstName, owner.ownerLastName]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .map((part) => part.trim())
          .join(' ');
        const ownerEmail = readString(owner.email, '');
        const ownerLabel = ownerName && ownerEmail ? `${ownerName} (${ownerEmail})` : ownerName || ownerEmail;
        push('Propietario', ownerLabel);
      }

      fields.push(...readPropertyDetail(item));
      break;
    }
  }

  return fields;
}
