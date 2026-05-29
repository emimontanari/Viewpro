import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerKeys } from '../api/queries';
import type {
  CreateOwnerDocumentUploadUrlResponse,
  OwnerDocumentRequest,
  OwnerDocumentRequestsResponse,
  OwnerDocumentUploadResponse,
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
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:viewpro-preview'),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

    expect(await screen.findByText('MOTIVO DEL RECHAZO')).toBeInTheDocument();
    expect(
      screen.getByText('El archivo no corresponde al documento solicitado.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a subir documento' })).toHaveClass(
      'bg-purple-500'
    );
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog with PDF details and does not upload before confirmation', async () => {
    const user = userEvent.setup();
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests();

    const file = new File(['demo'], 'dni.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Subir documento archivo'), file);

    expect(
      await screen.findByRole('dialog', { name: 'Confirmar carga de documento' })
    ).toBeVisible();
    expect(screen.getByText('dni.pdf')).toBeInTheDocument();
    expect(screen.getByText('4 B')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG, PNG o WebP/i)).toBeInTheDocument();
    expect(createOwnerDocumentUploadUrlMock).not.toHaveBeenCalled();
    expect(uploadOwnerDocumentFileMock).not.toHaveBeenCalled();
    expect(confirmOwnerDocumentUploadMock).not.toHaveBeenCalled();
  });

  it('confirms upload, reports progress, refreshes the list and closes the dialog', async () => {
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
    const uploadDeferred = createDeferred<OwnerDocumentUploadResponse>();
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([request]));
    createOwnerDocumentUploadUrlMock.mockResolvedValueOnce(uploadResponse);
    uploadOwnerDocumentFileMock.mockImplementationOnce(async (_uploadUrl, _file, options) => {
      options?.onProgress?.({ loaded: 2, total: 4, percent: 50 });
      return uploadDeferred.promise;
    });
    confirmOwnerDocumentUploadMock.mockResolvedValueOnce({ ...currentVersion, id: 'version-new' });
    const { queryClient } = renderOwnerDocumentRequests();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const file = new File(['demo'], 'dni.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Subir documento archivo'), file);
    await user.click(await screen.findByRole('button', { name: 'Confirmar carga' }));

    expect(await screen.findByText('Subiendo archivo')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(uploadOwnerDocumentFileMock).toHaveBeenCalledWith(uploadResponse.uploadUrl, file, {
      mimeType: 'application/pdf',
      onProgress: expect.any(Function)
    });

    uploadDeferred.resolve({
      storageKey: uploadResponse.uploadUrl.storageKey,
      mimeType: 'application/pdf',
      sizeBytes: 4
    });

    await waitFor(() => {
      expect(confirmOwnerDocumentUploadMock).toHaveBeenCalledWith('version-new');
    });
    expect(createOwnerDocumentUploadUrlMock).toHaveBeenCalledWith('request-1', {
      originalFilename: 'dni.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: documentQueryKey });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows an image preview before confirmation', async () => {
    const user = userEvent.setup();
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests();

    const file = new File(['image'], 'frente-dni.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Subir documento archivo'), file);

    expect(await screen.findByAltText('Vista previa de frente-dni.png')).toHaveAttribute(
      'src',
      'blob:viewpro-preview'
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it('rejects unsupported file types before creating an upload URL', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests();

    const file = new File(['demo'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(await screen.findByLabelText('Subir documento archivo'), {
      target: { files: [file] }
    });

    expect(
      await screen.findByText('Formato no permitido. Subí PDF, JPG, PNG o WebP.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Confirmar carga de documento' })
    ).not.toBeInTheDocument();
    expect(createOwnerDocumentUploadUrlMock).not.toHaveBeenCalled();
  });

  it('renders each document request as a card with neutral chrome', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          status: 'REJECTED',
          rejectionReason: 'El archivo no corresponde al documento solicitado.'
        })
      ])
    );

    renderOwnerDocumentRequests();

    const card = await screen.findByRole('listitem');
    const listWrapper = card.parentElement?.parentElement;
    expect(listWrapper).toHaveClass('space-y-3');
    expect(listWrapper).not.toHaveClass('rounded-2xl');
    expect(listWrapper).not.toHaveClass('border');
    expect(listWrapper).not.toHaveClass('bg-card');
    expect(listWrapper).not.toHaveClass('p-4');
    expect(listWrapper).not.toHaveClass('shadow-xs');
    expect(card).toHaveClass('border', 'bg-background', 'shadow-xs');
    expect(card).not.toHaveClass('border-[0.1px]');
    expect(card).not.toHaveClass('border-[#5a2020]');
    const header = screen.getByTestId('owner-document-card-header');
    expect(header).toHaveTextContent('DNI del propietario');
    expect(header).toHaveTextContent('DNI · Solicitado por ViewPro Demo Inmobiliaria');
    expect(header).toHaveTextContent('Rechazado');
    expect(screen.getByText('Versión actual del documento')).toBeInTheDocument();
    expect(screen.getByText('Subida')).toBeInTheDocument();
  });

  it('uses blue submitted state and blue read action for submitted requests', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByRole('listitem')).not.toHaveClass('border-blue-700');
    expect(screen.getByText('Subido')).toHaveClass('bg-blue-50');
    expect(screen.getByRole('button', { name: 'Abrir documento' })).toHaveClass('bg-blue-50');
  });

  it('uses status badges for pending and approved requests', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({ id: 'request-pending', status: 'PENDING', currentVersion: null }),
        documentRequest({ id: 'request-approved', status: 'APPROVED', title: 'Escritura aprobada' })
      ])
    );

    renderOwnerDocumentRequests();

    const cards = await screen.findAllByRole('listitem');
    expect(cards[0]).not.toHaveClass('border-amber-600');
    expect(cards[1]).not.toHaveClass('border-[#1a4028]');
    expect(screen.getByText('Pendiente')).toHaveClass('bg-amber-50');
    expect(screen.getByText('Aprobado')).toHaveClass('bg-emerald-50');
  });

  it('keeps rejected document versions visible with rejection reason after a new upload', async () => {
    const rejectedVersion: OwnerDocumentVersion = {
      ...currentVersion,
      id: 'version-rejected',
      originalFilename: 'dni-rechazado.pdf',
      status: 'REJECTED',
      createdAt: '2026-05-27T10:00:00.000Z',
      updatedAt: '2026-05-27T10:00:00.000Z'
    };
    const abandonedPendingVersion: OwnerDocumentVersion = {
      ...currentVersion,
      id: 'version-pending',
      originalFilename: 'dni-pendiente.pdf',
      status: 'PENDING_UPLOAD',
      createdAt: '2026-05-27T12:00:00.000Z',
      updatedAt: '2026-05-27T12:00:00.000Z'
    };
    const uploadedVersion: OwnerDocumentVersion = {
      ...currentVersion,
      id: 'version-new',
      originalFilename: 'dni-nuevo.pdf',
      status: 'UPLOADED',
      createdAt: '2026-05-28T10:00:00.000Z',
      updatedAt: '2026-05-28T10:00:00.000Z'
    };
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          status: 'SUBMITTED',
          rejectionReason: 'El documento se ve mal. Subilo con mejor calidad.',
          currentVersion: uploadedVersion,
          versions: [rejectedVersion, abandonedPendingVersion, uploadedVersion]
        })
      ])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByText('dni-nuevo.pdf')).toBeInTheDocument();
    expect(screen.getByText('Historial de versiones')).toBeInTheDocument();
    expect(screen.getByText('dni-rechazado.pdf')).toBeInTheDocument();
    expect(screen.getByText('Versión anterior')).toBeInTheDocument();
    expect(screen.getByText('Rechazada')).toHaveClass('bg-red-50');
    expect(
      screen.getByText('El documento se ve mal. Subilo con mejor calidad.')
    ).toBeInTheDocument();
    expect(screen.queryByText('dni-pendiente.pdf')).not.toBeInTheDocument();
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
      <OwnerDocumentRequests
        agencyName='ViewPro Demo Inmobiliaria'
        propertyEngagementId={propertyEngagementId}
      />
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
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
  const resolvedCurrentVersion =
    overrides.currentVersion === undefined ? currentVersion : overrides.currentVersion;
  const resolvedVersions =
    overrides.versions ?? (resolvedCurrentVersion ? [resolvedCurrentVersion] : []);

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
    ...overrides,
    currentVersion: resolvedCurrentVersion,
    versions: resolvedVersions
  };
}
