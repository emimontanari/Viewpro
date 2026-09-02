import { useActiveTenant } from '@/lib/session-context';
import { TENANT_PERMISSIONS, type TenantMembership } from '@/lib/session';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductListItem, ProductsResponse } from '../../api/types';
import { ProductTable } from '.';

type TenantState = Exclude<ReturnType<typeof useActiveTenant>, null>;

type TestState = {
  filters: unknown;
  isLoadingTenant: boolean;
  params: {
    archived: string;
    operationType: string | null;
    page: number;
    perPage: number;
    status: string | null;
  };
  queryError: Error | 'loading' | null;
  queryFnCalls: number;
  response: ProductsResponse;
  setParams: ReturnType<typeof vi.fn>;
  tenant: TenantState | null;
};

const state = vi.hoisted(
  (): TestState => ({
    filters: null as unknown,
    isLoadingTenant: false,
    params: { archived: 'active', operationType: null, page: 1, perPage: 10, status: null },
    queryError: null as Error | 'loading' | null,
    queryFnCalls: 0,
    response: { items: [], page: 1, pageSize: 10, total: 0 } as ProductsResponse,
    setParams: vi.fn(),
    tenant: null
  })
);

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('../../api/queries', () => ({
  productsQueryOptions: vi.fn((filters) => {
    state.filters = filters;
    return {
      queryKey: ['products', filters],
      queryFn: async () => {
        state.queryFnCalls += 1;
        if (state.queryError === 'loading') return new Promise<ProductsResponse>(() => {});
        if (state.queryError) throw state.queryError;
        return state.response;
      }
    };
  })
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('nuqs', () => ({
  parseAsInteger: { withDefault: (defaultValue: number) => ({ defaultValue }) },
  parseAsString: { withDefault: (defaultValue: string) => ({ defaultValue }) },
  useQueryStates: vi.fn(() => [state.params, state.setParams])
}));

describe('ProductTable', () => {
  beforeEach(() => {
    state.filters = null;
    state.isLoadingTenant = false;
    state.params = { archived: 'active', operationType: null, page: 1, perPage: 10, status: null };
    state.queryError = null;
    state.queryFnCalls = 0;
    state.response = { items: [], page: 1, pageSize: 10, total: 0 };
    state.setParams.mockReset();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    state.tenant = createTenantState(createMembership({ permissions: [] }));
    vi.mocked(useActiveTenant).mockImplementation(
      () => state.tenant as ReturnType<typeof useActiveTenant>
    );
  });

  it('shows tenant loading and missing-tenant states without executing the inventory query', () => {
    state.isLoadingTenant = true;
    state.tenant = createTenantState(createMembership({ permissions: [] }));
    const { container, rerender } = renderProductTable();

    expect(container.querySelectorAll('[data-slot="skeleton"]')).not.toHaveLength(0);
    expect(state.queryFnCalls).toBe(0);
    state.isLoadingTenant = false;
    state.tenant = createTenantState(null);
    rerender(<ProductTable />);
    expect(state.queryFnCalls).toBe(0);
    expect(screen.getByText('Seleccioná una inmobiliaria')).toBeInTheDocument();
    state.tenant = createTenantState(createMembership({ permissions: [] }));
    state.queryError = 'loading';
    rerender(<ProductTable />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).not.toHaveLength(0);
  });

  it('uses the exact default URL-backed filters and renders an unfiltered empty state', async () => {
    renderProductTable();

    expect(await screen.findByText('No hay propiedades para mostrar')).toBeInTheDocument();
    expect(state.filters).toEqual({ archived: 'active', limit: 10, page: 1, tenantId: 'tenant-1' });
    expect(screen.getByText('Todavía no hay propiedades cargadas.')).toBeInTheDocument();
  });

  it('shows query failure and retries through the public action', async () => {
    state.queryError = new Error('offline');
    renderProductTable();

    expect(await screen.findByText('No se pudieron cargar las propiedades')).toBeInTheDocument();
    state.queryError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay propiedades para mostrar')).toBeInTheDocument();
  });

  it('updates exact filter payloads, labels, count, and clears every filter', async () => {
    state.params = {
      archived: 'archived',
      operationType: 'SALE',
      page: 3,
      perPage: 10,
      status: 'CAPTURE'
    };
    state.response = { items: [createProduct()], page: 3, pageSize: 10, total: 1 };
    renderProductTable();

    expect(await screen.findByText('3 filtros activos')).toBeInTheDocument();
    expect(state.filters).toEqual({
      archived: 'archived',
      limit: 10,
      operationType: 'SALE',
      page: 3,
      status: 'CAPTURE',
      tenantId: 'tenant-1'
    });
    expect(screen.getByText('Operación: Venta')).toBeInTheDocument();
    expect(screen.getByText('Estado: Captación')).toBeInTheDocument();
    expect(screen.getByText('Archivo: Archivadas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo el inventario' }));
    expect(state.setParams).toHaveBeenLastCalledWith({
      archived: null,
      operationType: null,
      page: 1,
      status: null
    });
  });

  it('renders filtered-empty clear behavior and resets page size', async () => {
    state.params = {
      archived: 'active',
      operationType: 'RENT',
      page: 2,
      perPage: 10,
      status: null
    };
    const { rerender } = renderProductTable();

    expect(
      await screen.findByText(
        'Los filtros actuales no tienen resultados. Probá limpiarlos para volver al inventario completo.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todo el inventario' }));
    expect(state.setParams).toHaveBeenLastCalledWith({
      archived: null,
      operationType: null,
      page: 1,
      status: null
    });
    fireEvent.click(screen.getByText('10 / pág.'));
    fireEvent.click(await screen.findByText('20 / pág.'));
    expect(state.setParams).toHaveBeenLastCalledWith({ page: 1, perPage: 20 });
    expect(screen.queryByRole('link', { name: /nueva propiedad/i })).not.toBeInTheDocument();
    state.params = { archived: 'active', operationType: null, page: 1, perPage: 10, status: null };
    state.tenant = createTenantState(
      createMembership({ permissions: [TENANT_PERMISSIONS.ENGAGEMENTS_CREATE] })
    );
    rerender(<ProductTable />);
    const createLinks = await screen.findAllByRole('link', { name: /nueva propiedad/i });
    expect(createLinks).toHaveLength(2);
    expect(
      createLinks.every((link) => link.getAttribute('href') === '/dashboard/product/new')
    ).toBe(true);
  });

  it('keeps ranges and disabled controls while clamping out-of-range page commands', async () => {
    state.params.page = 0;
    state.response = { items: [createProduct()], page: 1, pageSize: 10, total: 15 };
    const { rerender } = renderProductTable();

    expect(await screen.findByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(state.setParams).toHaveBeenLastCalledWith({ page: 1 });
    state.params.page = 3;
    rerender(<ProductTable />);
    expect(await screen.findByRole('button', { name: 'Siguiente' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(state.setParams).toHaveBeenLastCalledWith({ page: 2 });
    state.params.page = 1;
    rerender(<ProductTable />);
    expect(await screen.findByText('Mostrando 1-10 de 15')).toBeInTheDocument();
    state.params.page = 2;
    rerender(<ProductTable />);
    expect(await screen.findByText('Mostrando 11-15 de 15')).toBeInTheDocument();
  });

  it('keeps desktop and mobile identity, status, owner, price, archive, actions, and first API-ordered seller aligned', async () => {
    state.response = {
      items: [createProduct({ archivedAt: '2026-01-01T00:00:00.000Z' })],
      page: 1,
      pageSize: 10,
      total: 1
    };
    renderProductTable({
      activeMembership: createMembership({ permissions: [TENANT_PERMISSIONS.ENGAGEMENTS_CREATE] })
    });

    expect(await screen.findAllByText('Propiedad API primero')).toHaveLength(2);
    for (const label of [
      'Venta',
      'Casa',
      'Captación',
      'Lucía API +1',
      'owner@example.com',
      'Archivada'
    ]) {
      expect(screen.getAllByText(label)).toHaveLength(2);
    }
    expect(screen.getAllByText(/1\.500\.000/)).toHaveLength(2);
    expect(
      screen.getAllByRole('combobox', { name: /cambiar estado de propiedad api primero/i })
    ).toHaveLength(2);
    const managerActions = screen.getAllByRole('button', { name: 'Abrir menú' });
    expect(managerActions).toHaveLength(2);
    for (const action of managerActions) {
      fireEvent.pointerDown(action, { button: 0 });
      expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Restaurar propiedad' })).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
    }
  });

  it('keeps seller controls read-only while managers receive status and lifecycle actions', async () => {
    state.response = { items: [createProduct()], page: 1, pageSize: 10, total: 1 };
    const { rerender } = renderProductTable();

    expect(await screen.findAllByText('Captación')).toHaveLength(2);
    expect(screen.queryByRole('combobox', { name: /cambiar estado/i })).not.toBeInTheDocument();
    const sellerActions = screen.getAllByRole('button', { name: 'Abrir menú' });
    expect(sellerActions).toHaveLength(2);
    for (const action of sellerActions) {
      fireEvent.pointerDown(action, { button: 0 });
      expect(await screen.findByRole('menuitem', { name: 'Ver detalle' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
    }

    state.tenant = createTenantState(
      createMembership({ permissions: [TENANT_PERMISSIONS.ENGAGEMENTS_CREATE] })
    );
    rerender(<ProductTable />);
    expect(await screen.findAllByRole('combobox', { name: /cambiar estado/i })).toHaveLength(2);
  });

  it('retains rows and shows Actualizando while a background refetch is pending', async () => {
    state.response = { items: [createProduct()], page: 1, pageSize: 10, total: 1 };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<ProductTable />, {
      wrapper: createQueryClientWrapper(queryClient)
    });
    expect(await screen.findAllByText('Propiedad API primero')).toHaveLength(2);

    state.queryError = 'loading';
    void queryClient.invalidateQueries();
    expect(await screen.findByText('Actualizando')).toBeInTheDocument();
    expect(screen.getAllByText('Propiedad API primero')).toHaveLength(2);
    await queryClient.cancelQueries();
    unmount();
  });
});

function renderProductTable({ activeMembership }: { activeMembership?: TenantMembership } = {}) {
  if (activeMembership) state.tenant = createTenantState(activeMembership);
  return render(<ProductTable />, { wrapper: createQueryClientWrapper() });
}

function createQueryClientWrapper(
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  })
) {
  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createTenantState(activeMembership: TenantMembership | null): TenantState {
  return {
    activeMembership,
    activeTenantId: activeMembership?.tenant.id ?? null,
    hasMemberships: Boolean(activeMembership),
    isTenantLoading: state.isLoadingTenant,
    memberships: activeMembership ? [activeMembership] : [],
    needsTenantSelection: !activeMembership,
    selectedTenantId: activeMembership?.tenant.id ?? null
  };
}

function createMembership({ permissions }: { permissions: string[] }): TenantMembership {
  return {
    id: 'membership-1',
    permissions,
    role: permissions.length ? 'PRINCIPAL_MANAGER' : 'AGENT',
    tenant: {
      id: 'tenant-1',
      name: 'Demo Inmobiliaria',
      slug: 'demo-inmobiliaria',
      status: 'ACTIVE'
    }
  };
}

function createProduct(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    agents: [
      {
        email: 'lucia@example.com',
        firstName: 'Lucía API',
        id: 'agent-first',
        userId: 'user-first'
      },
      {
        email: 'second@example.com',
        firstName: 'Segunda API',
        id: 'agent-second',
        userId: 'user-second'
      }
    ],
    archiveReason: null,
    archivedAt: null,
    archivedByUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    currency: 'ARS',
    id: 'property-1',
    operationType: 'SALE',
    property: {
      addressLine: 'Siempre Viva 742',
      ageYears: null,
      bathrooms: 1,
      bedrooms: 2,
      city: 'Rosario',
      coveredAreaSqm: 80,
      garages: null,
      id: 'asset-1',
      images: [],
      orientation: null,
      ownerEmail: 'owner@example.com',
      ownerName: 'Olivia Owner',
      owners: [],
      primaryImage: null,
      propertyType: 'HOUSE',
      province: 'Santa Fe',
      rooms: 3,
      title: 'Propiedad API primero',
      totalAreaSqm: 100
    },
    publishedPriceCents: 150000000,
    status: 'CAPTURE',
    tenantId: 'tenant-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}
