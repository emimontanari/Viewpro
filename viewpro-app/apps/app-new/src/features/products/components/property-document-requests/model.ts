import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  ProductDocumentRequest,
  ProductDocumentVersion,
  PropertyLinkedOwner
} from '../../api/types';

export type DocumentFilter = 'all' | 'pending' | 'resolved' | 'review';

export type DocumentRequestGroup = {
  emptyCopy: string;
  items: ProductDocumentRequest[];
  key: Exclude<DocumentFilter, 'all'>;
  title: string;
};

export const DOCUMENT_FILTER_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'review', label: 'Por revisar' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'resolved', label: 'Resueltos' }
] satisfies Array<{ key: DocumentFilter; label: string }>;

export function isEligibleDocumentOwner(owner: PropertyLinkedOwner) {
  return owner.accessStatus === 'INVITED' || owner.accessStatus === 'ACTIVE';
}

export function getDocumentFilter(value: string | null): DocumentFilter {
  if (value === 'all' || value === 'pending' || value === 'resolved' || value === 'review') {
    return value;
  }

  return 'all';
}

export function groupDocumentRequests(
  requests: ProductDocumentRequest[],
  getChronologyTimestamp: (request: ProductDocumentRequest) => string
) {
  const sortedRequests = requests.toSorted(
    (left, right) =>
      Date.parse(getChronologyTimestamp(right)) - Date.parse(getChronologyTimestamp(left))
  );

  return {
    pending: sortedRequests.filter((request) => request.status === 'PENDING'),
    resolved: sortedRequests.filter(
      (request) => request.status === 'APPROVED' || request.status === 'REJECTED'
    ),
    review: sortedRequests.filter((request) => request.status === 'SUBMITTED')
  } satisfies Record<Exclude<DocumentFilter, 'all'>, ProductDocumentRequest[]>;
}

export function getFilterCounts(
  groups: Record<Exclude<DocumentFilter, 'all'>, ProductDocumentRequest[]>
) {
  return {
    all: groups.pending.length + groups.resolved.length + groups.review.length,
    pending: groups.pending.length,
    resolved: groups.resolved.length,
    review: groups.review.length
  } satisfies Record<DocumentFilter, number>;
}

export function getVisibleGroups(
  groups: Record<Exclude<DocumentFilter, 'all'>, ProductDocumentRequest[]>,
  activeFilter: DocumentFilter
): DocumentRequestGroup[] {
  const allGroups: DocumentRequestGroup[] = [
    {
      emptyCopy: 'No hay documentos subidos para revisar.',
      items: groups.review,
      key: 'review',
      title: 'Requiere tu revisión'
    },
    {
      emptyCopy: 'No hay solicitudes pendientes del propietario.',
      items: groups.pending,
      key: 'pending',
      title: 'Pendientes del propietario'
    },
    {
      emptyCopy: 'Todavía no hay documentos aprobados o rechazados.',
      items: groups.resolved,
      key: 'resolved',
      title: 'Historial'
    }
  ];

  return activeFilter === 'all'
    ? allGroups
    : allGroups.filter((group) => group.key === activeFilter);
}

export function getCompactDocumentDescription(request: ProductDocumentRequest) {
  const description = request.description?.trim();

  if (!description) {
    return null;
  }

  const escapedTitle = escapeRegExp(request.title.trim());

  if (!escapedTitle) {
    return description;
  }

  const redundantSuffix = new RegExp(`\\s*:?\\s*${escapedTitle}\\s*$`, 'i');
  const compactDescription = description.replace(redundantSuffix, '').trim();

  return compactDescription || null;
}

export function getPendingDocumentSummary(description: string | null) {
  const statusCopy = 'Esperando que el propietario suba el documento';

  return description ? `${statusCopy} · ${description}` : statusCopy;
}

export function getRequestChronologyTimestamp(request: ProductDocumentRequest) {
  return (
    request.reviewedAt ??
    request.updatedAt ??
    request.currentVersion?.createdAt ??
    request.createdAt
  );
}

export function getDocumentDisplayName(
  request: ProductDocumentRequest,
  version: ProductDocumentVersion
) {
  const title = request.title.trim();

  if (title) {
    return title;
  }

  return getReadableFileName(version.originalFilename);
}

export function getVersionMetadata(
  request: ProductDocumentRequest,
  version: ProductDocumentVersion
) {
  const versionNumber = getVersionNumber(request, version);
  const fileFormat = getFileFormatLabel(version.mimeType);

  return versionNumber ? `v${versionNumber} · ${fileFormat}` : fileFormat;
}

export function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
}

export function getFileFormatLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType === 'image/jpeg') {
    return 'JPG';
  }

  if (mimeType === 'image/png') {
    return 'PNG';
  }

  if (mimeType === 'image/webp') {
    return 'WebP';
  }

  return 'Archivo';
}

export function formatCompactDateTime(value: string) {
  return format(new Date(value), 'd MMM · HH:mm', { locale: es });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getReadableFileName(fileName: string) {
  if (isTechnicalFileName(fileName)) {
    return 'Documento';
  }

  const nameWithoutExtension = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return nameWithoutExtension || 'Documento';
}

function isTechnicalFileName(fileName: string) {
  const normalizedName = fileName.toLowerCase();

  return normalizedName.includes('seeded') || normalizedName.includes('smoke-document');
}

function getVersionNumber(request: ProductDocumentRequest, version: ProductDocumentVersion) {
  const completedVersions = request.versions
    .filter((item) => item.status !== 'PENDING_UPLOAD')
    .toSorted((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const index = completedVersions.findIndex((item) => item.id === version.id);

  return index >= 0 ? index + 1 : null;
}
