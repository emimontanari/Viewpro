import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productKeys } from '../api/queries';
import type { ProductMovement, ProductMovementMutationPayload } from '../api/types';
import { usePropertyMovementsController } from './use-property-movements-controller';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess
  }
}));

const movement: ProductMovement = {
  createdAt: '2026-05-30T10:00:00.000Z',
  createdBy: {
    email: 'agent@example.com',
    firstName: 'Ana',
    id: 'user-1'
  },
  id: 'movement-1',
  interestCount: null,
  interestLevel: null,
  newStatus: null,
  nextStep: null,
  observation: 'Primer contacto',
  offerAmountCents: null,
  previousStatus: null,
  propertyEngagementId: 'product-1',
  source: 'MANUAL',
  tenantId: 'tenant-1',
  type: 'GENERAL_UPDATE',
  visitCount: null,
  builtInOutcome: null,
  customOutcomeLabel: null
};

describe('usePropertyMovementsController', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('loads movement history with the existing movements endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [movement], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness();

    expect(await screen.findByText('items:1')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/product-1/movements?pageSize=8&order=desc',
      expect.objectContaining({ cache: 'no-store', credentials: 'include' })
    );
  });

  it('creates a movement without status change and invalidates movements plus detail', async () => {
    const user = userEvent.setup();
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const fetchMock = mockMovementFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness({ invalidateQueries });

    await user.click(screen.getByRole('button', { name: 'open dialog' }));
    await user.click(screen.getByRole('button', { name: 'create movement' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/movements',
        expect.objectContaining({
          body: JSON.stringify(createMovementPayload()),
          method: 'POST'
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('dialog:false')).toBeInTheDocument();
    });
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: productKeys.movements('product-1', 'tenant-1') },
      undefined
    );
    expect(invalidateQueries).toHaveBeenCalledWith(
      { queryKey: productKeys.detail('product-1', 'tenant-1') },
      undefined
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Actualización agregada');
  });

  it('creates a status-changing movement and invalidates movements plus all products', async () => {
    const user = userEvent.setup();
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', mockMovementFetch());
    renderControllerHarness({
      invalidateQueries,
      payload: createMovementPayload({ newStatus: 'ACTIVE_PUBLICATION' })
    });

    await user.click(screen.getByRole('button', { name: 'create movement' }));

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith(
        { queryKey: productKeys.movements('product-1', 'tenant-1') },
        undefined
      );
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: productKeys.all }, undefined);
  });

  it('does not create movements when archived', async () => {
    const user = userEvent.setup();
    const fetchMock = mockMovementFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderControllerHarness({ isArchived: true });

    await user.click(screen.getByRole('button', { name: 'create movement' }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/products/product-1/movements',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

function renderControllerHarness({
  invalidateQueries,
  isArchived = false,
  payload = createMovementPayload()
}: {
  invalidateQueries?: (
    ...args: Parameters<QueryClient['invalidateQueries']>
  ) => ReturnType<QueryClient['invalidateQueries']>;
  isArchived?: boolean;
  payload?: ProductMovementMutationPayload;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  if (invalidateQueries) {
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters, options) =>
      invalidateQueries(filters, options)
    );
  }

  return render(<MovementControllerHarness isArchived={isArchived} payload={payload} />, {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
  });
}

function MovementControllerHarness({
  isArchived,
  payload
}: {
  isArchived: boolean;
  payload: ProductMovementMutationPayload;
}) {
  const controller = usePropertyMovementsController({
    isArchived,
    productId: 'product-1',
    tenantId: 'tenant-1'
  });

  return (
    <div>
      <p>dialog:{String(controller.dialogOpen)}</p>
      <p>items:{controller.items.length}</p>
      <p>loading:{String(controller.isLoading)}</p>
      <p>error:{String(controller.isError)}</p>
      <p>creating:{String(controller.isCreatingMovement)}</p>
      <button type='button' onClick={() => controller.setDialogOpen(true)}>
        open dialog
      </button>
      <button type='button' onClick={() => controller.handleCreateMovement(payload)}>
        create movement
      </button>
    </div>
  );
}

function mockMovementFetch() {
  return vi.fn((path: string, init?: RequestInit) => {
    if (path === '/api/products/product-1/movements?pageSize=8&order=desc') {
      return Promise.resolve(jsonResponse({ items: [], total: 0 }));
    }

    if (path === '/api/products/product-1/movements' && init?.method === 'POST') {
      return Promise.resolve(jsonResponse(movement, { status: 201 }));
    }

    return Promise.resolve(jsonResponse({}, { status: 404 }));
  });
}

function createMovementPayload(
  overrides: Partial<ProductMovementMutationPayload> = {}
): ProductMovementMutationPayload {
  return {
    observation: 'Primer contacto',
    type: 'GENERAL_UPDATE',
    ...overrides
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: init.status ?? 200,
    ...init
  });
}
