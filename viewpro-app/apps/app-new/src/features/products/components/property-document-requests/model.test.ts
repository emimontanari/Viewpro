import { describe, expect, it } from 'vitest';
import type { ProductDocumentRequest, PropertyLinkedOwner } from '../../api/types';
import {
  DOCUMENT_FILTER_OPTIONS,
  getDocumentFilter,
  getFilterCounts,
  getVisibleGroups,
  groupDocumentRequests,
  isEligibleDocumentOwner
} from './model';

describe('property document request core list model', () => {
  it('keeps the filter options and normalizes unknown active filters to all', () => {
    expect(DOCUMENT_FILTER_OPTIONS).toEqual([
      { key: 'all', label: 'Todos' },
      { key: 'review', label: 'Por revisar' },
      { key: 'pending', label: 'Pendientes' },
      { key: 'resolved', label: 'Resueltos' }
    ]);
    expect(getDocumentFilter('review')).toBe('review');
    expect(getDocumentFilter('other')).toBe('all');
    expect(getDocumentFilter(null)).toBe('all');
  });

  it('allows only active and invited owners to receive document requests', () => {
    expect(isEligibleDocumentOwner({ accessStatus: 'ACTIVE' } as PropertyLinkedOwner)).toBe(true);
    expect(isEligibleDocumentOwner({ accessStatus: 'INVITED' } as PropertyLinkedOwner)).toBe(true);
    expect(isEligibleDocumentOwner({ accessStatus: 'REVOKED' } as PropertyLinkedOwner)).toBe(false);
  });

  it('groups requests by action priority, preserves chronology supplied by the root, and counts them', () => {
    const groups = groupDocumentRequests(
      [
        request({ id: 'pending', status: 'PENDING', updatedAt: '2026-05-28T10:00:00.000Z' }),
        request({ id: 'review-old', status: 'SUBMITTED', updatedAt: '2026-05-27T10:00:00.000Z' }),
        request({ id: 'review-new', status: 'SUBMITTED', updatedAt: '2026-05-29T10:00:00.000Z' }),
        request({ id: 'approved', status: 'APPROVED', updatedAt: '2026-05-26T10:00:00.000Z' }),
        request({ id: 'cancelled', status: 'CANCELLED', updatedAt: '2026-05-30T10:00:00.000Z' })
      ],
      (item) => item.updatedAt
    );

    expect(groups.review.map((item) => item.id)).toEqual(['review-new', 'review-old']);
    expect(groups.pending.map((item) => item.id)).toEqual(['pending']);
    expect(groups.resolved.map((item) => item.id)).toEqual(['approved']);
    expect(getFilterCounts(groups)).toEqual({ all: 4, pending: 1, resolved: 1, review: 2 });
  });

  it('returns all groups in action order or the selected group with unchanged Spanish copy', () => {
    const groups = groupDocumentRequests([], (item) => item.updatedAt);

    expect(getVisibleGroups(groups, 'all')).toEqual([
      {
        emptyCopy: 'No hay documentos subidos para revisar.',
        items: [],
        key: 'review',
        title: 'Requiere tu revisión'
      },
      {
        emptyCopy: 'No hay solicitudes pendientes del propietario.',
        items: [],
        key: 'pending',
        title: 'Pendientes del propietario'
      },
      {
        emptyCopy: 'Todavía no hay documentos aprobados o rechazados.',
        items: [],
        key: 'resolved',
        title: 'Historial'
      }
    ]);
    expect(getVisibleGroups(groups, 'pending')).toHaveLength(1);
    expect(getVisibleGroups(groups, 'pending')[0]?.key).toBe('pending');
  });
});

function request(overrides: Partial<ProductDocumentRequest>): ProductDocumentRequest {
  return {
    id: 'request',
    tenantId: 'tenant',
    propertyEngagementId: 'property',
    propertyAssetOwnerId: 'owner',
    ownerUserId: 'owner-user',
    requestedByUserId: 'agent',
    title: 'Documento',
    description: null,
    status: 'PENDING',
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: '2026-05-26T10:00:00.000Z',
    updatedAt: '2026-05-26T10:00:00.000Z',
    currentVersion: null,
    versions: [],
    ...overrides
  };
}
