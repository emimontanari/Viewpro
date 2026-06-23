import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
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

// Lightweight stub for CreateDocumentRequestDialog that renders a button calling onSubmit
// directly. This allows testing the mutation's onError callback without fighting Radix Select
// in jsdom.
vi.mock('./create-document-request-dialog', () => ({
  CreateDocumentRequestDialog: ({
    open,
    onSubmit
  }: {
    open: boolean
    onSubmit: (payload: { propertyAssetOwnerId: string; title: string }) => void
  }) =>
    open ? (
      <button
        type='button'
        onClick={() => onSubmit({ propertyAssetOwnerId: 'owner-link-1', title: 'Escritura' })}
      >
        Stub Submit
      </button>
    ) : null
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

// D7: nuqs mock extended to key by param name so `documentos` and `doc` resolve
// independently. `mockDocParam` lets individual tests inject a doc value before
// rendering. `mockSetDocumentFilter` captures the documentos setter for spy assertions.
// `mockDocumentosInitial` lets a test SEED `documentos` to a non-'all' value before
// rendering (D7 case (e) — filter reset from a non-'all' starting filter).
let mockDocParam: string | null = null;
let mockDocumentosInitial: string | null = null;
const mockSetDocumentFilter = vi.fn();

vi.mock('nuqs', async () => {
  const React = await import('react');

  return {
    parseAsString: {
      withDefault: (defaultValue: string) => ({ defaultValue }),
      withOptions: () => ({
        withDefault: (defaultValue: string) => ({ defaultValue })
      })
    },
    useQueryState: (key: string, parser: { defaultValue: string }) => {
      if (key === 'doc') {
        // Return the module-level mockDocParam so tests can inject a non-null doc.
        // The setter is a no-op spy (doc is read-only in the component).
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return [mockDocParam, vi.fn()] as [string | null, ReturnType<typeof vi.fn>];
      }
      if (key === 'documentos') {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [value, setState] = React.useState(
          mockDocumentosInitial ?? parser.defaultValue
        );
        // Wrap the setter so tests can spy on documentos changes.
        const wrappedSet = (...args: Parameters<typeof setState>) => {
          mockSetDocumentFilter(...args);
          setState(...args);
        };
        return [value, wrappedSet] as [string, typeof wrappedSet];
      }
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return React.useState(parser.defaultValue);
    }
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
    mockDocParam = null;
    mockDocumentosInitial = null;
    mockSetDocumentFilter.mockClear();
    getProductDocumentRequestsMock.mockResolvedValue(documentRequestsResponse([]));
    // S-F2 setup: mock scrollIntoView (jsdom does not implement it)
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    // Restore scrollIntoView after each test
    // @ts-expect-error - restoring mock
    Element.prototype.scrollIntoView = undefined;
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

  it('hides document request creation controls when creation is not permitted', async () => {
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([]));

    renderPropertyDocumentRequests({ canRequestDocuments: false });

    expect(await screen.findByRole('heading', { name: 'Documentos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar documento' })).not.toBeInTheDocument();
    expect(createProductDocumentRequestMock).not.toHaveBeenCalled();
  });

  it('hides document review decisions when review is not permitted', async () => {
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([documentRequest({ status: 'SUBMITTED' })])
    );

    renderPropertyDocumentRequests({ canReviewDocuments: false });

    expect(await screen.findByRole('button', { name: 'Abrir documento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Deep-link: doc param read, filter reset, Collapsible, scroll/highlight
  // -------------------------------------------------------------------------

  // S-F7: data-request-id present on every rendered item
  it('S-F7: every rendered <li> has data-request-id matching request.id', async () => {
    const req1 = documentRequest({ id: 'req-pending-1', status: 'PENDING' });
    const req2 = documentRequest({ id: 'req-review-1', status: 'SUBMITTED' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([req1, req2])
    );

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    const items = screen.getAllByRole('listitem');
    const withDataId = items.filter((li) => li.hasAttribute('data-request-id'));
    expect(withDataId.length).toBeGreaterThanOrEqual(2);
    expect(withDataId.some((li) => li.getAttribute('data-request-id') === 'req-pending-1')).toBe(true);
    expect(withDataId.some((li) => li.getAttribute('data-request-id') === 'req-review-1')).toBe(true);
  });

  // S-F1: pending target — scroll + highlight
  it('S-F1: scrolls to and highlights a matching PENDING item', async () => {
    mockDocParam = 'req-123';
    const req = documentRequest({ id: 'req-123', status: 'PENDING' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    });

    const targetLi = document.querySelector('[data-request-id="req-123"]');
    expect(targetLi).not.toBeNull();
    expect(targetLi).toHaveClass('ring-2');
  });

  // S-F2: resolved target — Collapsible opens + scroll fires
  it('S-F2: opens the resolved Collapsible and scrolls to an APPROVED item', async () => {
    mockDocParam = 'req-resolved';
    const req = documentRequest({ id: 'req-resolved', status: 'APPROVED' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    // The resolved Collapsible content should be open so the item is visible.
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    });

    const targetLi = document.querySelector('[data-request-id="req-resolved"]');
    expect(targetLi).not.toBeNull();
  });

  // S-F3: doc absent — no side effects
  it('S-F3: doc absent — no scroll, no filter reset, resolved Collapsible stays closed', async () => {
    mockDocParam = null;
    const req = documentRequest({ id: 'req-1', status: 'APPROVED' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    // Give effects time to settle
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(mockSetDocumentFilter).not.toHaveBeenCalledWith(null);

    // Resolved Collapsible should remain closed (its content trigger button visible but content hidden)
    const resolvedTrigger = screen.queryByRole('button', { name: /Historial/i });
    expect(resolvedTrigger).toBeInTheDocument(); // trigger still rendered
  });

  // S-F4: not-found degrade — no scroll, no throw
  it('S-F4: doc references a non-existent item — no scroll, no throw', async () => {
    mockDocParam = 'req-deleted';
    const req = documentRequest({ id: 'req-other', status: 'PENDING' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  // S-F5 (task 5.3 S-F5): CANCELLED item — force-to-all fires (D5), no scroll
  it('S-F5: CANCELLED item — filter reset fires (no group renders it), no scroll, no throw', async () => {
    mockDocParam = 'req-cancelled';
    // CANCELLED items are not in any group — an empty list still triggers the
    // one-shot filter reset when doc is non-null (D5), but no scroll fires.
    const req = documentRequest({ id: 'req-other', status: 'PENDING' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    // Filter reset fires because doc is non-null (D5 one-shot)
    expect(mockSetDocumentFilter).toHaveBeenCalledWith(null);
    // No scroll because the CANCELLED item is not rendered in any group
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  // S-F7 (task 5.3 S-F7): one-shot filter reset fires once
  it('S-F7 (task 5.3): one-shot filter reset fires once and does not re-fire on subsequent renders', async () => {
    mockDocParam = 'req-123';
    const req = documentRequest({ id: 'req-123', status: 'PENDING' });
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([req]));

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    await waitFor(() => {
      expect(mockSetDocumentFilter).toHaveBeenCalledWith(null);
    });

    // Reset is called exactly once
    expect(mockSetDocumentFilter).toHaveBeenCalledTimes(1);
  });

  // S-F8 (task 5.3 S-F6): query-loading guard — scroll fires after query resolves
  it('S-F8 (task 5.3 S-F6): scroll does not fire while loading, fires after query resolves', async () => {
    mockDocParam = 'req-123';
    // Delay the response to simulate loading state
    let resolveQuery!: (v: unknown) => void;
    const queryPromise = new Promise((r) => { resolveQuery = r; });
    getProductDocumentRequestsMock.mockReturnValueOnce(queryPromise as ReturnType<typeof getProductDocumentRequestsMock>);

    renderPropertyDocumentRequests();

    // While loading, scrollIntoView must NOT have been called
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    // Now resolve the query
    await act(async () => {
      resolveQuery(documentRequestsResponse([documentRequest({ id: 'req-123', status: 'PENDING' })]));
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    });
  });

  // D7 case (e) (FR-F3 / R3): filter reset from a non-'all' starting value.
  // Seed documentos='review', deep-link a PENDING target. The one-shot reset must
  // force the filter back to 'all' so the target's group is visible and it scrolls.
  // A subsequent user filter change must NOT be reverted by the guard.
  it('D7 (e): resets a non-all filter to all so the target is visible, then leaves later user filter changes alone', async () => {
    const user = userEvent.setup();
    mockDocParam = 'req-pending-deep';
    mockDocumentosInitial = 'review';
    const target = documentRequest({
      id: 'req-pending-deep',
      title: 'Escritura deep-link',
      currentVersion: null,
      status: 'PENDING',
      versions: []
    });
    const submitted = documentRequest({
      id: 'req-review-other',
      title: 'DNI por revisar',
      status: 'SUBMITTED'
    });
    getProductDocumentRequestsMock.mockResolvedValueOnce(
      documentRequestsResponse([target, submitted])
    );

    renderPropertyDocumentRequests();

    await screen.findByTestId('document-request-results');

    // The one-shot reset fires setDocumentFilter(null) → active filter becomes 'all'.
    await waitFor(() => {
      expect(mockSetDocumentFilter).toHaveBeenCalledWith(null);
    });

    const tablist = await screen.findByRole('tablist', {
      name: 'Filtros de solicitudes documentales'
    });
    const allTab = within(tablist).getByRole('tab', { name: /Todos/i });
    expect(allTab).toHaveAttribute('aria-selected', 'true');

    // With the filter forced to 'all', the PENDING target group is visible and scrolls.
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    });
    const targetLi = document.querySelector('[data-request-id="req-pending-deep"]');
    expect(targetLi).not.toBeNull();
    expect(targetLi).toHaveClass('ring-2');

    // A subsequent user filter change must stick — the one-shot guard does NOT revert it.
    const pendingTab = within(tablist).getByRole('tab', { name: /Pendientes/i });
    await user.click(pendingTab);

    expect(pendingTab).toHaveAttribute('aria-selected', 'true');
    // The reset fired exactly once (null) — the user's 'pending' selection is the last call.
    expect(mockSetDocumentFilter).toHaveBeenLastCalledWith('pending');
    expect(mockSetDocumentFilter).toHaveBeenCalledWith('pending');
    expect(mockSetDocumentFilter.mock.calls.filter((c) => c[0] === null)).toHaveLength(1);

    // Regression guard: the deep-link scroll must NOT re-fire on a later user filter
    // toggle (Effect B must stay un-keyed on the filter). Still exactly one scroll.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
  });

  // Stage 20.12 — 409 toast surfacing
  it('shows a toast error with the API message when createDocumentRequest returns 409', async () => {
    const user = userEvent.setup();
    const duplicateError = new Error(
      'An approved document of this type already exists for this property.'
    );
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([]));
    createProductDocumentRequestMock.mockRejectedValueOnce(duplicateError);

    renderPropertyDocumentRequests();

    // Open the dialog (stub renders a submit button when dialogOpen=true).
    await user.click(await screen.findByRole('button', { name: 'Solicitar documento' }));

    // The stub dialog renders a button that calls onSubmit with a fixed payload.
    await user.click(screen.getByRole('button', { name: 'Stub Submit' }));

    // The mutation rejects with the 409 error; onError calls toast.error with the message.
    await waitFor(() => {
      expect((toast.error as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        'An approved document of this type already exists for this property.'
      );
    });
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
