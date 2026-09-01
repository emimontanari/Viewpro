import type { ProductDocumentRequest, PropertyLinkedOwner } from '../../api/types';

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
