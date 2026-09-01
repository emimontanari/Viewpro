import { describe, expect, it } from 'vitest';
import type {
  ProductDocumentRequest,
  ProductDocumentVersion,
  PropertyLinkedOwner
} from '../../api/types';
import {
  DOCUMENT_FILTER_OPTIONS,
  formatCompactDateTime,
  getCompactDocumentDescription,
  getDocumentDisplayName,
  getDocumentFilter,
  getFileFormatLabel,
  getFilterCounts,
  getPendingDocumentSummary,
  getRequestChronologyTimestamp,
  getVersionMetadata,
  getVisibleGroups,
  groupDocumentRequests,
  isImageMimeType,
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

  it('selects the established chronology timestamp and compacts redundant descriptions', () => {
    const currentVersion = version({ createdAt: '2026-05-28T08:00:00.000Z' });

    expect(
      getRequestChronologyTimestamp(
        request({
          createdAt: '2026-05-26T08:00:00.000Z',
          currentVersion,
          reviewedAt: '2026-05-29T08:00:00.000Z',
          updatedAt: '2026-05-27T08:00:00.000Z'
        })
      )
    ).toBe('2026-05-29T08:00:00.000Z');
    expect(
      getRequestChronologyTimestamp(
        request({ currentVersion, reviewedAt: null, updatedAt: '2026-05-27T08:00:00.000Z' })
      )
    ).toBe('2026-05-27T08:00:00.000Z');
    expect(
      getCompactDocumentDescription(
        request({ description: '  Referencia: DNI (frente)  ', title: 'DNI (frente)' })
      )
    ).toBe('Referencia');
    expect(getCompactDocumentDescription(request({ description: '   ' }))).toBeNull();
    expect(getPendingDocumentSummary('Referencia')).toBe(
      'Esperando que el propietario suba el documento · Referencia'
    );
  });

  it('preserves document labels, version order, MIME classification, and compact dates', () => {
    const firstVersion = version({
      createdAt: '2026-05-26T10:00:00.000Z',
      id: 'first',
      mimeType: 'image/jpeg',
      originalFilename: 'dni_frente.JPG'
    });
    const secondVersion = version({
      createdAt: '2026-05-28T10:00:00.000Z',
      id: 'second',
      mimeType: 'application/pdf',
      originalFilename: 'seeded-document.pdf'
    });
    const pendingUpload = version({
      createdAt: '2026-05-25T10:00:00.000Z',
      id: 'pending',
      status: 'PENDING_UPLOAD'
    });
    const documentRequest = request({
      currentVersion: secondVersion,
      title: '   ',
      versions: [secondVersion, pendingUpload, firstVersion]
    });

    expect(getDocumentDisplayName(documentRequest, firstVersion)).toBe('dni frente');
    expect(getDocumentDisplayName(documentRequest, secondVersion)).toBe('Documento');
    expect(getVersionMetadata(documentRequest, secondVersion)).toBe('v2 · PDF');
    expect(getFileFormatLabel('image/webp')).toBe('WebP');
    expect(getFileFormatLabel('application/octet-stream')).toBe('Archivo');
    expect(isImageMimeType('image/svg+xml')).toBe(true);
    expect(isImageMimeType('application/pdf')).toBe(false);
    expect(formatCompactDateTime('2026-05-28T10:05:00')).toBe('28 may · 10:05');
  });
});

function version(overrides: Partial<ProductDocumentVersion>): ProductDocumentVersion {
  return {
    id: 'version',
    documentId: 'document',
    uploadedByUserId: 'agent',
    storageKey: 'documents/version',
    originalFilename: 'document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
    checksum: null,
    status: 'UPLOADED',
    createdAt: '2026-05-26T10:00:00.000Z',
    updatedAt: '2026-05-26T10:00:00.000Z',
    ...overrides
  };
}

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
