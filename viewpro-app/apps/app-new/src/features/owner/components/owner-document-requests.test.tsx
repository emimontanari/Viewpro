import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerKeys } from '../api/queries';
import type {
  CreateOwnerDocumentUploadUrlResponse,
  OwnerDocumentRequest,
  OwnerDocumentRequestsResponse,
  OwnerDocumentVersion,
  OwnerDocumentVersionUrlResponse
} from '../api/types';
import { OwnerDocumentRequests } from './owner-document-requests';
import {
  confirmOwnerDocumentUpload,
  createOwnerDocumentReadUrl,
  createOwnerDocumentUploadUrl,
  getOwnerDocumentRequests,
  uploadOwnerDocumentFile
} from '../api/service';

vi.mock('../api/service', () => ({
  confirmOwnerDocumentUpload: vi.fn(),
  createOwnerDocumentReadUrl: vi.fn(),
  createOwnerDocumentUploadUrl: vi.fn(),
  getOwnerDocumentRequests: vi.fn(),
  uploadOwnerDocumentFile: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

const getOwnerDocumentRequestsMock = vi.mocked(getOwnerDocumentRequests);
const createOwnerDocumentUploadUrlMock = vi.mocked(createOwnerDocumentUploadUrl);
const uploadOwnerDocumentFileMock = vi.mocked(uploadOwnerDocumentFile);
const confirmOwnerDocumentUploadMock = vi.mocked(confirmOwnerDocumentUpload);
const createOwnerDocumentReadUrlMock = vi.mocked(createOwnerDocumentReadUrl);

const propertyEngagementId = 'engagement-1';
const documentQueryKey = ownerKeys.documentRequests(propertyEngagementId, { pageSize: 20 });

describe('OwnerDocumentRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerDocumentRequestsMock.mockResolvedValue(documentRequestsResponse([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an empty state when there are no document requests', async () => {
    renderOwnerDocumentRequests();

    expect(
      await screen.findByText('Todavía no hay solicitudes de documentos para esta propiedad.')
    ).toBeInTheDocument();
  });

  it('shows keyboard-accessible upload CTA for pending requests without read or internal review controls', async () => {
    const user = userEvent.setup();
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByText('DNI del propietario')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Subir documento' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
    expect(screen.queryByText('Aprobar')).not.toBeInTheDocument();
    expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
  });

  it('shows read CTA for submitted and approved requests with a current version', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({ id: 'request-submitted', status: 'SUBMITTED' }),
        documentRequest({ id: 'request-approved', status: 'APPROVED', title: 'Escritura aprobada' })
      ])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findAllByText('dni.pdf')).toHaveLength(2);
    expect(screen.getByText('Escritura aprobada')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Abrir documento' })).toHaveLength(2);
    expect(screen.queryByText('Aprobar')).not.toBeInTheDocument();
    expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
  });

  it('shows rejection reason and re-upload CTA for rejected requests', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          status: 'REJECTED',
          rejectionReason: 'El archivo no corresponde al documento solicitado.'
        })
      ])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByText(/Motivo de rechazo:/)).toBeInTheDocument();
    expect(
      screen.getByText('El archivo no corresponde al documento solicitado.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a subir documento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
  });

  it('uploads a selected file and refreshes the owner document request list', async () => {
    const user = userEvent.setup();
    const request = documentRequest({ status: 'PENDING', currentVersion: null });
    const uploadResponse: CreateOwnerDocumentUploadUrlResponse = {
      request,
      version: { ...currentVersion, id: 'version-new' },
      uploadUrl: {
        url: 'http://localhost:3001/api/document-storage/upload/signed-token',
        storageKey: 'document-requests/request-1/dni.pdf',
        expiresInSeconds: 600
      }
    };
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([request]));
    createOwnerDocumentUploadUrlMock.mockResolvedValueOnce(uploadResponse);
    uploadOwnerDocumentFileMock.mockResolvedValueOnce({
      storageKey: uploadResponse.uploadUrl.storageKey,
      mimeType: 'application/pdf',
      sizeBytes: 4
    });
    confirmOwnerDocumentUploadMock.mockResolvedValueOnce({ ...currentVersion, id: 'version-new' });
    const { queryClient } = renderOwnerDocumentRequests();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const file = new File(['demo'], 'dni.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Subir documento archivo'), file);

    await waitFor(() => {
      expect(createOwnerDocumentUploadUrlMock).toHaveBeenCalledWith('request-1', {
        originalFilename: 'dni.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4
      });
    });
    expect(uploadOwnerDocumentFileMock).toHaveBeenCalledWith(uploadResponse.uploadUrl, file, {
      mimeType: 'application/pdf'
    });
    expect(confirmOwnerDocumentUploadMock).toHaveBeenCalledWith('version-new');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: documentQueryKey });
  });

  it('creates a read URL and opens it in a safe new tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const readResponse: OwnerDocumentVersionUrlResponse = {
      version: currentVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/signed-token',
        storageKey: currentVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );
    createOwnerDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderOwnerDocumentRequests();

    await user.click(await screen.findByRole('button', { name: 'Abrir documento' }));

    await waitFor(() => {
      expect(createOwnerDocumentReadUrlMock).toHaveBeenCalledWith('version-1');
    });
    expect(openSpy).toHaveBeenCalledWith(readResponse.readUrl.url, '_blank', 'noopener,noreferrer');
    expect(screen.queryByText(readResponse.readUrl.url)).not.toBeInTheDocument();
  });
});

function renderOwnerDocumentRequests() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <OwnerDocumentRequests propertyEngagementId={propertyEngagementId} />
    </QueryClientProvider>
  );

  return { queryClient };
}

function documentRequestsResponse(items: OwnerDocumentRequest[]): OwnerDocumentRequestsResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length
  };
}

const currentVersion: OwnerDocumentVersion = {
  id: 'version-1',
  documentId: 'document-1',
  uploadedByUserId: 'owner-1',
  storageKey: 'document-requests/request-1/dni.pdf',
  originalFilename: 'dni.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  checksum: null,
  status: 'UPLOADED',
  createdAt: '2026-05-28T10:00:00.000Z',
  updatedAt: '2026-05-28T10:00:00.000Z'
};

function documentRequest(overrides: Partial<OwnerDocumentRequest> = {}): OwnerDocumentRequest {
  return {
    id: 'request-1',
    tenantId: 'tenant-1',
    propertyEngagementId,
    propertyAssetOwnerId: 'owner-link-1',
    ownerUserId: 'owner-1',
    requestedByUserId: 'agent-1',
    title: 'DNI del propietario',
    description: 'Necesitamos el frente y dorso en PDF.',
    status: 'SUBMITTED',
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    currentVersion,
    versions: currentVersion ? [currentVersion] : [],
    ...overrides
  };
}
