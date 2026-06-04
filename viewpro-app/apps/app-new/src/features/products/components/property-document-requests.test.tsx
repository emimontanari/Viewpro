import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productKeys } from '../api/queries';
import type {
  ProductDocumentRequest,
  ProductDocumentRequestsResponse,
  ProductDocumentVersion,
  ProductDocumentVersionUrlResponse,
  PropertyLinkedOwner
} from '../api/types';
import {
  approveProductDocumentRequest,
  createProductDocumentReadUrl,
  createProductDocumentRequest,
  getProductDocumentRequests,
  rejectProductDocumentRequest
} from '../api/service';
import { PropertyDocumentRequests } from './property-document-requests';

vi.mock('../api/service', () => ({
  approveProductDocumentRequest: vi.fn(),
  createProductDocumentReadUrl: vi.fn(),
  createProductDocumentRequest: vi.fn(),
  getProductDocumentRequests: vi.fn(),
  rejectProductDocumentRequest: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

vi.mock('nuqs', async () => {
  const React = await import('react');

  return {
    parseAsString: {
      withDefault: (defaultValue: string) => ({ defaultValue }),
      withOptions: () => ({
        withDefault: (defaultValue: string) => ({ defaultValue })
      })
    },
    useQueryState: (_key: string, parser: { defaultValue: string }) =>
      React.useState(parser.defaultValue)
  };
});

const getProductDocumentRequestsMock = vi.mocked(getProductDocumentRequests);
const createProductDocumentReadUrlMock = vi.mocked(createProductDocumentReadUrl);
const approveProductDocumentRequestMock = vi.mocked(approveProductDocumentRequest);
const rejectProductDocumentRequestMock = vi.mocked(rejectProductDocumentRequest);
const createProductDocumentRequestMock = vi.mocked(createProductDocumentRequest);

const productId = 'engagement-1';
const tenantId = 'tenant-1';
const documentRequestsQueryKey = productKeys.documentRequests(productId, tenantId);

describe('PropertyDocumentRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductDocumentRequestsMock.mockResolvedValue(documentRequestsResponse([]));
  });

  it('shows read, approve and reject actions for a submitted request with a current version', async () => {
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );

    renderPropertyDocumentRequests();

    expect(await screen.findByRole('heading', { name: 'DNI del propietario' })).toBeInTheDocument();
    const openButton = screen.getByRole('button', { name: 'Abrir documento' });
    const approveButton = screen.getByRole('button', { name: 'Aprobar' });
    const rejectButton = screen.getByRole('button', { name: 'Rechazar' });
    expect(openButton).toHaveClass('min-h-11', 'text-foreground/70');
    expect(openButton).not.toHaveClass('bg-primary', 'w-full');
    expect(screen.getByTestId('document-review-action-row')).toHaveClass(
      'border-t',
      'border-border/40',
      'flex-wrap'
    );
    expect(screen.getByTestId('document-review-decision-actions')).toHaveClass(
      'flex',
      'justify-end',
      'gap-2'
    );
    expect(rejectButton).toHaveClass('border-destructive/40', 'text-destructive');
    expect(approveButton).toHaveClass('bg-emerald-200', 'text-emerald-950');
    expect(approveButton).not.toHaveClass('border-destructive/40');
    expect(openButton.compareDocumentPosition(rejectButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(rejectButton.compareDocumentPosition(approveButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('creates a read URL and opens it in a safe new tab without rendering the signed URL', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const readResponse: ProductDocumentVersionUrlResponse = {
      version: currentVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/signed-token',
        storageKey: currentVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );
    createProductDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderPropertyDocumentRequests();

    await user.click(await screen.findByRole('button', { name: 'Abrir documento' }));

    await waitFor(() => {
      expect(createProductDocumentReadUrlMock).toHaveBeenCalledWith('version-1');
    });
    expect(openSpy).toHaveBeenCalledWith(readResponse.readUrl.url, '_blank', 'noopener,noreferrer');
    expect(screen.queryByText(readResponse.readUrl.url)).not.toBeInTheDocument();
  });

  it('opens the inline file chip with the same read handler', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const readResponse: ProductDocumentVersionUrlResponse = {
      version: currentVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/chip-token',
        storageKey: currentVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );
    createProductDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderPropertyDocumentRequests();

    await user.click(
      await screen.findByRole('button', { name: 'Abrir documento DNI del propietario' })
    );

    await waitFor(() => {
      expect(createProductDocumentReadUrlMock).toHaveBeenCalledWith('version-1');
    });
    expect(openSpy).toHaveBeenCalledWith(readResponse.readUrl.url, '_blank', 'noopener,noreferrer');
  });

  it('approves a submitted request and refreshes the document request list', async () => {
    const user = userEvent.setup();
    const request = documentRequest({ status: 'SUBMITTED' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([request]));
    approveProductDocumentRequestMock.mockResolvedValueOnce({ ...request, status: 'APPROVED' });
    const { queryClient } = renderPropertyDocumentRequests();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(approveProductDocumentRequestMock).toHaveBeenCalledWith('request-1');
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: documentRequestsQueryKey });
  });

  it('requires a non-empty rejection reason before rejecting a request', async () => {
    const user = userEvent.setup();
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );

    renderPropertyDocumentRequests();

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await user.click(screen.getByRole('button', { name: 'Rechazar documento' }));

    expect(await screen.findByText('El motivo de rechazo es obligatorio.')).toBeInTheDocument();
    expect(rejectProductDocumentRequestMock).not.toHaveBeenCalled();
  });

  it('rejects with a reason and refreshes the document request list', async () => {
    const user = userEvent.setup();
    const request = documentRequest({ status: 'SUBMITTED' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([request]));
    rejectProductDocumentRequestMock.mockResolvedValueOnce({
      ...request,
      status: 'REJECTED',
      rejectionReason: 'El archivo no corresponde al documento solicitado.'
    });
    const { queryClient } = renderPropertyDocumentRequests();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(await screen.findByRole('button', { name: 'Rechazar' }));
    await user.type(
      screen.getByLabelText('Motivo de rechazo'),
      'El archivo no corresponde al documento solicitado.'
    );
    await user.click(screen.getByRole('button', { name: 'Rechazar documento' }));

    await waitFor(() => {
      expect(rejectProductDocumentRequestMock).toHaveBeenCalledWith('request-1', {
        reason: 'El archivo no corresponde al documento solicitado.'
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: documentRequestsQueryKey });
  });

  it('does not show review actions for pending requests', async () => {
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'PENDING', currentVersion: null })])
    );

    renderPropertyDocumentRequests();

    expect(await screen.findByText('DNI del propietario')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Estado del documento: pendiente' })).toHaveClass(
      'bg-zinc-50'
    );
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('groups requests by action priority, sorts each group, and filters with counters', async () => {
    const olderSubmitted = documentRequest({
      id: 'request-review-old',
      title: 'DNI viejo',
      status: 'SUBMITTED',
      updatedAt: '2026-05-27T10:00:00.000Z'
    });
    const newerSubmitted = documentRequest({
      id: 'request-review-new',
      title: 'DNI nuevo',
      status: 'SUBMITTED',
      updatedAt: '2026-05-29T10:00:00.000Z'
    });
    const pending = documentRequest({
      id: 'request-pending',
      title: 'Escritura pendiente',
      currentVersion: null,
      status: 'PENDING',
      updatedAt: '2026-05-30T10:00:00.000Z',
      versions: []
    });
    const approved = documentRequest({
      id: 'request-approved',
      title: 'Contrato aprobado',
      status: 'APPROVED',
      updatedAt: '2026-05-28T10:00:00.000Z'
    });
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([olderSubmitted, pending, approved, newerSubmitted])
    );

    renderPropertyDocumentRequests();

    const tablist = await screen.findByRole('tablist', {
      name: 'Filtros de solicitudes documentales'
    });
    const allTab = within(tablist).getByRole('tab', { name: /Todos · 4/i });
    const reviewTab = within(tablist).getByRole('tab', { name: /Por revisar · 2/i });
    const pendingTab = within(tablist).getByRole('tab', { name: /Pendientes · 1/i });
    const resolvedTab = within(tablist).getByRole('tab', { name: /Resueltos · 1/i });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(reviewTab).toHaveAttribute('aria-selected', 'false');
    expect(pendingTab).toHaveAttribute('aria-selected', 'false');
    expect(resolvedTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Requiere tu revisión')).toBeInTheDocument();
    expect(screen.getByText('Pendientes del propietario')).toBeInTheDocument();
    expect(screen.getByTestId('document-request-panel-body')).not.toHaveClass(
      'rounded-2xl',
      'border',
      'bg-card',
      'p-4',
      'shadow-xs'
    );
    expect(screen.getByTestId('document-request-results')).toHaveClass(
      'min-h-[28rem]',
      'sm:min-h-[32rem]',
      '[overflow-anchor:none]'
    );
    expect(screen.getByTestId('document-section-heading-review')).toHaveTextContent(
      'Requiere tu revisión'
    );
    expect(screen.getByTestId('document-section-heading-review')).not.toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Historial/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(
      screen
        .getByRole('heading', { name: 'DNI nuevo' })
        .compareDocumentPosition(screen.getByRole('heading', { name: 'DNI viejo' }))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(reviewTab);

    expect(allTab).toHaveAttribute('aria-selected', 'false');
    expect(reviewTab).toHaveAttribute('aria-selected', 'true');
    expect(reviewTab).toHaveClass('border-foreground', 'text-foreground');
    expect(within(reviewTab).getByText('2')).toHaveClass('bg-amber-50', 'text-amber-700');

    await userEvent.click(pendingTab);

    expect(screen.queryByText('Requiere tu revisión')).not.toBeInTheDocument();
    expect(screen.getByText('Pendientes del propietario')).toBeInTheDocument();
    expect(screen.getByText('Escritura pendiente')).toBeInTheDocument();
  });

  it('opens approved and rejected documents while keeping decision actions only for submitted requests', async () => {
    const user = userEvent.setup();
    const approvedVersion = documentVersion({ id: 'version-approved' });
    const rejectedVersion = documentVersion({ id: 'version-rejected' });
    const approved = documentRequest({
      id: 'request-approved',
      title: 'Escritura aprobada',
      status: 'APPROVED',
      currentVersion: approvedVersion,
      versions: [approvedVersion]
    });
    const rejected = documentRequest({
      id: 'request-rejected',
      title: 'DNI rechazado',
      status: 'REJECTED',
      currentVersion: rejectedVersion,
      rejectionReason: 'La imagen está borrosa.',
      versions: [rejectedVersion]
    });
    const readResponse: ProductDocumentVersionUrlResponse = {
      version: approvedVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/approved-token',
        storageKey: approvedVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([approved, rejected])
    );
    createProductDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderPropertyDocumentRequests();
    await user.click(await screen.findByRole('button', { name: /Historial/i }));

    expect(screen.getAllByRole('button', { name: 'Abrir documento' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Abrir documento' })[0]!);

    await waitFor(() => {
      expect(createProductDocumentReadUrlMock).toHaveBeenCalledWith('version-approved');
    });
    expect(openSpy).toHaveBeenCalledWith(readResponse.readUrl.url, '_blank', 'noopener,noreferrer');
  });

  it('shows pending requests without review or placeholder reminder controls', async () => {
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({ status: 'PENDING', currentVersion: null, versions: [] })
      ])
    );

    renderPropertyDocumentRequests();

    const passiveSummary = await screen.findByTestId('document-passive-summary');
    expect(passiveSummary).toHaveTextContent(
      'Esperando que el propietario suba el documento · Necesitamos el frente y dorso en PDF.'
    );
    expect(passiveSummary).toHaveClass('truncate', 'text-foreground/70');
    expect(screen.queryByRole('button', { name: 'Enviar recordatorio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reenviar recordatorio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('renders accessible status badges, compact file metadata, and no redundant labels', async () => {
    const technicalVersion = documentVersion({ originalFilename: 'seeded-smoke-document.pdf' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          currentVersion: technicalVersion,
          status: 'SUBMITTED',
          versions: [technicalVersion]
        })
      ])
    );

    renderPropertyDocumentRequests();

    const statusBadge = await screen.findByRole('status', {
      name: 'Estado del documento: subido'
    });
    expect(statusBadge).toHaveTextContent('Subido');
    expect(statusBadge).toHaveClass('bg-amber-50');
    expect(statusBadge.querySelector('svg')).toBeInTheDocument();
    const fileRow = screen.getByRole('button', { name: 'Abrir documento DNI del propietario' });
    expect(fileRow).toHaveAttribute('data-testid', 'document-version-summary');
    expect(fileRow).toHaveClass('w-fit', 'min-h-11', 'bg-muted/20', 'border-border/60');
    expect(within(fileRow).getByText('DNI del propietario')).toBeInTheDocument();
    expect(within(fileRow).getByText('v1 · PDF')).toHaveClass('text-foreground/70');
    expect(screen.queryByText('seeded-smoke-document.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF · 1 KB/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/v1 · 28 may/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Versión actual del documento')).not.toBeInTheDocument();
    expect(screen.queryByText('Subida')).not.toBeInTheDocument();
    expect(screen.queryByText(/Para Patricia Demo/i)).not.toBeInTheDocument();
  });

  it('renders a real image thumbnail when a signed image read URL is available', async () => {
    const imageVersion = documentVersion({
      id: 'version-image',
      mimeType: 'image/png',
      originalFilename: 'frente-dni.png',
      storageKey: 'document-requests/request-1/frente-dni.png'
    });
    const readResponse: ProductDocumentVersionUrlResponse = {
      version: imageVersion,
      readUrl: {
        url: 'http://localhost:3001/api/document-storage/read/image-token',
        storageKey: imageVersion.storageKey,
        expiresInSeconds: 300
      }
    };
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([
        documentRequest({
          currentVersion: imageVersion,
          status: 'SUBMITTED',
          versions: [imageVersion]
        })
      ])
    );
    createProductDocumentReadUrlMock.mockResolvedValueOnce(readResponse);

    renderPropertyDocumentRequests();

    expect(await screen.findByAltText('Vista previa de DNI del propietario')).toHaveAttribute(
      'src',
      readResponse.readUrl.url
    );
  });

  it('keeps archived properties blocked from creating new document requests', async () => {
    const user = userEvent.setup();
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([]));

    renderPropertyDocumentRequests({ isArchived: true });

    const createButton = await screen.findByRole('button', { name: 'Solicitar documento' });
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveClass('border-border/70', 'bg-transparent');
    expect(createButton).not.toHaveClass('bg-primary');
    await user.click(createButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createProductDocumentRequestMock).not.toHaveBeenCalled();
  });
});

function renderPropertyDocumentRequests(
  overrides: Partial<Parameters<typeof PropertyDocumentRequests>[0]> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  render(
    <QueryClientProvider client={queryClient}>
      <PropertyDocumentRequests
        isArchived={false}
        owners={[linkedOwner]}
        productId={productId}
        tenantId={tenantId}
        {...overrides}
      />
    </QueryClientProvider>
  );

  return { queryClient };
}

function documentRequestsResponse(
  items: ProductDocumentRequest[]
): ProductDocumentRequestsResponse {
  return {
    items,
    page: 1,
    pageSize: 10,
    total: items.length
  };
}

const linkedOwner: PropertyLinkedOwner = {
  id: 'owner-link-1',
  userId: 'owner-1',
  email: 'propietario.demo@viewpro.local',
  firstName: 'Patricia',
  lastName: 'Demo',
  ownerFirstName: 'Patricia',
  ownerLastName: 'Demo',
  isPrimary: true,
  accessStatus: 'ACTIVE'
};

function documentVersion(overrides: Partial<ProductDocumentVersion> = {}): ProductDocumentVersion {
  return {
    ...currentVersion,
    ...overrides
  };
}

const currentVersion: ProductDocumentVersion = {
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

function documentRequest(overrides: Partial<ProductDocumentRequest> = {}): ProductDocumentRequest {
  return {
    id: 'request-1',
    tenantId,
    propertyEngagementId: productId,
    propertyAssetOwnerId: linkedOwner.id,
    ownerUserId: linkedOwner.userId,
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
    versions: [currentVersion],
    ...overrides
  };
}
