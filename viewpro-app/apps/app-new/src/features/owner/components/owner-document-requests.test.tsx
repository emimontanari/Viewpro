import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(
      screen.getByText(
        'Subí este documento para que ViewPro Demo Inmobiliaria pueda revisar la gestión.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Qué tiene que incluir')).toBeInTheDocument();
    expect(
      screen.getByText('Subí el DNI del propietario, frente y dorso en PDF.')
    ).toBeInTheDocument();
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

    expect(await screen.findAllByText('DNI del propietario')).toHaveLength(2);
    expect(screen.queryByText('dni.pdf')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'En revisión por ViewPro Demo Inmobiliaria. Te avisaremos cuando haya una novedad.'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('Escritura aprobada')).toHaveLength(2);
    expect(screen.getByText('Aprobado el 27 may 2026.')).toBeInTheDocument();
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

    const rejectedBadge = await screen.findByRole('status', {
      name: 'Estado del documento: rechazado. Acción requerida.'
    });
    expect(rejectedBadge).toHaveTextContent('Acción requerida');
    expect(rejectedBadge).toHaveClass('bg-destructive/10', 'text-destructive');
    expect(screen.getByRole('alert')).not.toHaveClass('text-destructive');
    expect(rejectedBadge.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('DNI inválido')).toHaveClass('text-destructive');
    expect(screen.getByText('El archivo no corresponde al documento solicitado.')).toHaveClass(
      'text-foreground'
    );
    expect(
      screen.queryByText(
        'Subí una nueva versión con las correcciones indicadas para que ViewPro Demo Inmobiliaria pueda revisarla.'
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Subí el DNI del propietario, frente y dorso en PDF.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir nueva versión' })).toHaveClass('min-h-11');
    expect(screen.getByText('Formatos: JPG, PNG, WebP o PDF · máx. 10 MB.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
  });

  it('does not repeat the title as request instructions', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          currentVersion: null,
          description: 'DNI del propietario',
          status: 'PENDING'
        })
      ])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findAllByText('DNI del propietario')).toHaveLength(1);
    expect(screen.queryByText('Qué tiene que incluir')).not.toBeInTheDocument();
  });

  it('shows actionable fallback copy for rejected requests without a backend reason', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'REJECTED', rejectionReason: null })])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByText('DNI inválido')).toBeInTheDocument();
    expect(
      screen.getByText(
        'El archivo no permite validar el DNI del propietario: la imagen debe verse clara, sin recortes ni reflejos.'
      )
    ).toBeInTheDocument();
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
    const documentCard = card.querySelector('[data-slot="card"]');
    expect(documentCard).toHaveClass('border', 'bg-card', 'shadow-xs');
    expect(documentCard).not.toHaveClass('border-[0.1px]');
    expect(documentCard).not.toHaveClass('border-[#5a2020]');
    const header = screen.getByTestId('owner-document-card-header');
    expect(header).toHaveTextContent('DNI del propietario');
    expect(header).toHaveTextContent('Solicitado por ViewPro Demo Inmobiliaria');
    expect(header).not.toHaveTextContent('DNI ·');
    expect(header).toHaveTextContent('Acción requerida');
    expect(screen.queryByText('Versión actual subida')).not.toBeInTheDocument();
    expect(screen.getByText('Subido el 28 may 2026')).toBeInTheDocument();
    expect(screen.getByText('PDF · 1 KB')).toBeInTheDocument();
    expect(screen.queryByText('dni.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('Subida')).not.toBeInTheDocument();
  });

  it('can hide repeated agency subtitles in document card headers', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests({ hideAgencyInDocumentCards: true });

    const header = await screen.findByTestId('owner-document-card-header');
    expect(header).toHaveTextContent('DNI del propietario');
    expect(header).not.toHaveTextContent('Solicitado por');
    expect(header).not.toHaveTextContent('DNI ·');
    expect(
      screen.getByText('Subí el DNI del propietario, frente y dorso en PDF.')
    ).toBeInTheDocument();
  });

  it('uses blue submitted state and blue read action for submitted requests', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findByRole('listitem')).not.toHaveClass('border-blue-700');
    const submittedBadge = screen.getByRole('status', {
      name: 'Estado del documento: en revisión'
    });
    expect(submittedBadge).toHaveTextContent('En revisión');
    expect(submittedBadge).toHaveClass('bg-blue-50');
    expect(submittedBadge.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir documento' })).toHaveClass('min-h-11');
    expect(
      screen.queryByRole('button', { name: /Subir nueva versión|Reemplazar/i })
    ).not.toBeInTheDocument();
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
    const pendingBadge = screen.getByRole('status', {
      name: 'Estado del documento: pendiente'
    });
    const approvedBadge = screen.getByRole('status', {
      name: 'Estado del documento: aprobado'
    });
    expect(pendingBadge).toHaveTextContent('Pendiente');
    expect(pendingBadge).toHaveClass('bg-amber-50');
    expect(pendingBadge.querySelector('svg')).toBeInTheDocument();
    expect(approvedBadge).toHaveTextContent('Aprobado');
    expect(approvedBadge).toHaveClass('bg-emerald-50');
    expect(approvedBadge.querySelector('svg')).toBeInTheDocument();
  });

  it('keeps rejected document versions collapsed in history after a new upload', async () => {
    const user = userEvent.setup();
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

    expect(await screen.findAllByText('DNI del propietario')).toHaveLength(2);
    expect(screen.queryByText('dni-nuevo.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Versión 2 · Subido el 28 may 2026')).toBeInTheDocument();
    const historyTrigger = screen.getByRole('button', {
      name: /Ver historial de versiones \(1\)/i
    });
    expect(historyTrigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(historyTrigger);

    expect(historyTrigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Versión 1 · Subido el 27 may 2026')).toBeInTheDocument();
    expect(screen.queryByText('Rechazada')).not.toBeInTheDocument();
    expect(screen.queryByText('dni-rechazado.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('dni-pendiente.pdf')).not.toBeInTheDocument();
  });

  it('shows a user-facing file name when the original filename is technical', async () => {
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          currentVersion: {
            ...currentVersion,
            originalFilename: 'seeded-smoke-document.pdf'
          }
        })
      ])
    );

    renderOwnerDocumentRequests();

    expect(await screen.findAllByText('DNI del propietario')).toHaveLength(2);
    expect(screen.queryByText('seeded-smoke-document.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('DNI del propietario.pdf')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Scroll/highlight tests — S-F1..S-F5 (Phase 6, 24.6a deep-link)
  // ---------------------------------------------------------------------------

  it('S-F1: scrolls to and highlights the matching item when highlightDocId matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ id: 'req-123', status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests({ highlightDocId: 'req-123' });

    await screen.findByText('DNI del propietario');

    expect(scrollIntoViewMock).toHaveBeenCalledOnce();
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    // FR-F3 requires BOTH scroll AND a transient highlight on the matching item.
    const highlightedItem = document.querySelector('[data-request-id="req-123"]');
    expect(highlightedItem).toHaveClass('ring-2', 'ring-primary');

    // The highlight clears after the 2s transient timeout.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector('[data-request-id="req-123"]')).not.toHaveClass('ring-2');

    vi.useRealTimers();
  });

  it('S-F2: does not scroll when highlightDocId is absent', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ id: 'req-123', status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests({ highlightDocId: null });

    await screen.findByText('DNI del propietario');

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('S-F3: does not scroll or throw when highlightDocId is not in the list', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ id: 'req-123', status: 'PENDING', currentVersion: null })])
    );

    renderOwnerDocumentRequests({ highlightDocId: 'req-deleted' });

    await screen.findByText('DNI del propietario');

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('S-F4: scrolls after query resolves, not before data is available', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const deferred = createDeferred<ReturnType<typeof documentRequestsResponse>>();
    getOwnerDocumentRequestsMock.mockReturnValueOnce(deferred.promise);

    renderOwnerDocumentRequests({ highlightDocId: 'req-123' });

    // Query still loading — scrollIntoView must not have been called yet.
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    // Resolve query with matching item.
    deferred.resolve(
      documentRequestsResponse([documentRequest({ id: 'req-123', status: 'PENDING', currentVersion: null })])
    );

    await screen.findByText('DNI del propietario');

    expect(scrollIntoViewMock).toHaveBeenCalledOnce();
  });

  // S-F5 lives in owner-property-detail.test.tsx (page level) where BOTH the `tab`
  // and `doc` nuqs params are registered, so the doc-survives-tab-write contract is
  // observable. A child-only test here cannot model that interaction.

  it('renders a real thumbnail for uploaded image versions', async () => {
    const imageVersion: OwnerDocumentVersion = {
      ...currentVersion,
      id: 'version-image',
      originalFilename: 'frente-dni.png',
      mimeType: 'image/png',
      storageKey: 'document-requests/request-1/frente-dni.png'
    };
    const readResponse: OwnerDocumentVersionUrlResponse = {
      version: imageVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/signed-image-token',
        storageKey: imageVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    getOwnerDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ currentVersion: imageVersion })])
    );
    createOwnerDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderOwnerDocumentRequests();

    expect(await screen.findByAltText('Vista previa de DNI — frente')).toHaveAttribute(
      'src',
      readResponse.readUrl.url
    );
    expect(screen.getByText('DNI — frente')).toBeInTheDocument();
    expect(screen.queryByText('frente-dni.png')).not.toBeInTheDocument();
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

function renderOwnerDocumentRequests({
  hideAgencyInDocumentCards = false,
  highlightDocId = null
}: { hideAgencyInDocumentCards?: boolean; highlightDocId?: string | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <OwnerDocumentRequests
        agencyName='ViewPro Demo Inmobiliaria'
        hideAgencyInDocumentCards={hideAgencyInDocumentCards}
        highlightDocId={highlightDocId}
        propertyEngagementId={propertyEngagementId}
      />
    </QueryClientProvider>
  );

  return { container, queryClient };
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
