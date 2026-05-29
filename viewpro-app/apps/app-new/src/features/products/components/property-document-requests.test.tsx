import { render, screen, waitFor } from '@testing-library/react';
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
    success: vi.fn()
  }
}));

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

    expect(await screen.findByText('DNI del propietario')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir documento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Abrir documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('keeps archived properties blocked from creating new document requests', async () => {
    const user = userEvent.setup();
    getProductDocumentRequestsMock.mockResolvedValueOnce(documentRequestsResponse([]));

    renderPropertyDocumentRequests({ isArchived: true });

    const createButton = await screen.findByRole('button', { name: 'Solicitar documento' });
    expect(createButton).toBeDisabled();
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
