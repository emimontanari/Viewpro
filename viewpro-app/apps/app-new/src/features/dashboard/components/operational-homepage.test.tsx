import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { OperationalHomepage } from './operational-homepage';
import type { DashboardSummaryResponse } from '@/features/dashboard/api/types';
import type { ProductsResponse } from '@/features/products/api/types';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn()
  };
});

vi.mock('@/lib/session-context', () => ({
  useActiveTenant: vi.fn()
}));

const useQueryMock = vi.mocked(useQuery);
const useActiveTenantMock = vi.mocked(useActiveTenant);

const activeTenantContext = {
  activeMembership: {
    id: 'membership-1',
    permissions: ['engagements:view:all'],
    role: 'MANAGER',
    tenant: {
      id: 'tenant-1',
      name: 'Costa Norte Propiedades',
      slug: 'costa-norte',
      status: 'ACTIVE'
    }
  },
  activeTenantId: 'tenant-1',
  hasMemberships: true,
  isTenantLoading: false,
  memberships: [],
  needsTenantSelection: false,
  selectedTenantId: 'tenant-1'
};

const dashboardSummaryResponse: DashboardSummaryResponse = {
  counters: {
    activeProperties: 2,
    attentionNeeded: 3,
    movementsInRange: 5,
    staleProperties: 4
  },
  range: {
    from: '2026-05-18T10:00:00.000Z',
    preset: '7d',
    to: '2026-05-25T10:00:00.000Z'
  },
  recentActivity: [
    {
      createdAt: '2026-05-24T10:00:00.000Z',
      createdBy: {
        email: 'sofia@example.com',
        firstName: 'Sofía',
        id: 'user-1'
      },
      id: 'movement-1',
      interestCount: null,
      interestLevel: null,
      kind: 'movement',
      newStatus: null,
      nextStep: 'Llamar al propietario',
      observation: 'Se coordinó una visita para mañana',
      offerAmountCents: null,
      previousStatus: null,
      property: {
        addressLine: 'Av. Libertador 1234',
        agents: [
          {
            email: 'sofia@example.com',
            firstName: 'Sofía',
            id: 'agent-1',
            userId: 'user-1'
          }
        ],
        assetId: 'asset-1',
        city: 'Vicente López',
        engagementId: 'engagement-1',
        id: 'property-1',
        operationType: 'SALE',
        province: 'Buenos Aires',
        status: 'ACTIVE_PUBLICATION',
        title: 'Departamento con vista abierta'
      },
      propertyEngagementId: 'engagement-1',
      source: 'MANUAL',
      tenantId: 'tenant-1',
      type: 'VISIT_SCHEDULED',
      visitCount: 1
    },
    {
      createdAt: '2026-05-24T08:30:00.000Z',
      documentRequest: {
        currentVersion: null,
        description: null,
        status: 'PENDING',
        title: 'Escritura'
      },
      documentRequestId: 'document-request-1',
      id: 'document-activity-1',
      kind: 'document_request',
      owner: null,
      property: {
        addressLine: 'Calle Mendoza 456',
        agents: [
          {
            email: 'martin@example.com',
            firstName: 'Martín',
            id: 'agent-2',
            userId: 'user-2'
          }
        ],
        assetId: 'asset-2',
        city: 'San Isidro',
        engagementId: 'engagement-2',
        id: 'property-2',
        operationType: 'RENT',
        province: 'Buenos Aires',
        status: 'DOCUMENTATION_PENDING',
        title: 'Casa en alquiler temporal'
      },
      propertyEngagementId: 'engagement-2',
      requestedBy: {
        email: 'admin@example.com',
        firstName: 'Admin',
        id: 'user-admin'
      },
      tenantId: 'tenant-1'
    }
  ],
  topProperties: [
    {
      addressLine: 'Av. Libertador 1234',
      agents: [
        {
          email: 'sofia@example.com',
          firstName: 'Sofía',
          id: 'agent-1',
          userId: 'user-1'
        }
      ],
      city: 'Vicente López',
      documentRequestCount: 1,
      engagementId: 'engagement-1',
      lastActivityAt: '2026-05-24T10:00:00.000Z',
      lastActivityTitle: 'Se coordinó una visita para mañana',
      movementCount: 2,
      operationType: 'SALE',
      propertyId: 'asset-1',
      province: 'Buenos Aires',
      status: 'ACTIVE_PUBLICATION',
      title: 'Departamento con vista abierta'
    }
  ],
  topSellers: [
    {
      email: 'sofia@example.com',
      lastMovementAt: '2026-05-24T10:00:00.000Z',
      movementCount: 2,
      name: 'Sofía',
      touchedPropertiesCount: 1,
      userId: 'user-1'
    }
  ]
};

const productsResponse: ProductsResponse = {
  items: [
    {
      agents: [
        {
          email: 'sofia@example.com',
          firstName: 'Sofía',
          id: 'agent-1',
          userId: 'user-1'
        }
      ],
      archivedAt: null,
      archivedByUserId: null,
      archiveReason: null,
      createdAt: '2026-05-24T09:00:00.000Z',
      currency: 'USD',
      id: 'engagement-1',
      operationType: 'SALE',
      property: {
        addressLine: 'Av. Libertador 1234',
        ageYears: null,
        bathrooms: 1,
        bedrooms: 2,
        city: 'Vicente López',
        coveredAreaSqm: 70,
        garages: 1,
        id: 'asset-1',
        images: [],
        orientation: null,
        ownerEmail: null,
        ownerName: null,
        owners: [],
        primaryImage: null,
        propertyType: 'APARTMENT',
        province: 'Buenos Aires',
        rooms: 3,
        title: 'Departamento con vista abierta',
        totalAreaSqm: 80
      },
      publishedPriceCents: 18000000,
      status: 'ACTIVE_PUBLICATION',
      tenantId: 'tenant-1',
      updatedAt: '2026-05-24T09:00:00.000Z'
    }
  ],
  page: 1,
  pageSize: 6,
  total: 2
};

function mockDashboardQueries({
  products = productsResponse,
  summary = dashboardSummaryResponse,
  isLoading = false
}: {
  products?: ProductsResponse;
  summary?: DashboardSummaryResponse;
  isLoading?: boolean;
} = {}) {
  useQueryMock.mockImplementation((options) => {
    const queryKey = options.queryKey as readonly unknown[];
    const queryScope = queryKey[0];

    if (queryScope === 'dashboard') {
      return {
        data: isLoading ? undefined : summary,
        isError: false,
        isLoading
      } as ReturnType<typeof useQuery>;
    }

    return {
      data: isLoading ? undefined : products,
      isError: false,
      isLoading
    } as ReturnType<typeof useQuery>;
  });
}

function hasDashboardSummaryQueryForRange(range: string) {
  return useQueryMock.mock.calls.some(([options]) => {
    const queryKey = options.queryKey as readonly unknown[];
    return queryKey[0] === 'dashboard' && queryKey.includes(range);
  });
}

describe('OperationalHomepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActiveTenantMock.mockReturnValue(activeTenantContext);
    mockDashboardQueries();
  });

  it('renders a neutral loading state while tenant context is resolving', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: null,
      activeTenantId: null,
      isTenantLoading: true
    });

    render(<OperationalHomepage />);

    expect(screen.getByLabelText('Preparando inicio operativo')).toBeVisible();
    expect(screen.queryByText(/Elegí una inmobiliaria/i)).not.toBeInTheDocument();
  });

  it('renders an action-oriented missing inmobiliaria state after loading', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: null,
      activeTenantId: null,
      hasMemberships: false,
      selectedTenantId: null
    });

    render(<OperationalHomepage />);

    expect(
      screen.getByRole('heading', { name: 'Elegí una inmobiliaria para continuar' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ir a inmobiliarias' })).toHaveAttribute(
      'href',
      '/dashboard/workspaces'
    );
  });

  it('defaults to 7 days and renders backend-owned summary, recent activity, and property preview', () => {
    render(<OperationalHomepage />);

    expect(
      screen.getByRole('heading', { name: /Inicio operativo de Costa Norte Propiedades/i })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(hasDashboardSummaryQueryForRange('7d')).toBe(true);
    expect(screen.getAllByText('Sin novedades en 7 días')[0]).toBeVisible();
    expect(screen.getByText('Movimientos del período')).toBeVisible();
    expect(screen.getByText('4 gestiones no tuvieron novedades en 7 días.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Ver 4 gestiones sin novedades en 7 días en seguimiento' })
    ).toHaveAttribute('href', '/dashboard/seguimiento');
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
    expect(screen.getAllByText('Departamento con vista abierta')[0]).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver seguimiento' })).toHaveAttribute(
      'href',
      '/dashboard/seguimiento'
    );
  });

  it('updates the summary range selector for 14 and 30 days', async () => {
    const user = userEvent.setup();

    render(<OperationalHomepage />);

    await user.click(screen.getByRole('button', { name: '14 días' }));

    expect(screen.getByRole('button', { name: '14 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Últimos 14 días')[0]).toBeVisible();
    expect(hasDashboardSummaryQueryForRange('14d')).toBe(true);

    await user.click(screen.getByRole('button', { name: '30 días' }));

    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Últimos 30 días')[0]).toBeVisible();
    expect(hasDashboardSummaryQueryForRange('30d')).toBe(true);
  });

  it('surfaces backend top properties and seller movement insights', () => {
    render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Propiedades con más movimiento' })).toBeVisible();
    expect(screen.getAllByText(/2 movimientos/)[0]).toBeVisible();
    expect(screen.getByText(/1 documento/)).toBeVisible();
    expect(screen.getByText('Último: Se coordinó una visita para mañana')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Abrir propiedad Departamento con vista abierta' })
    ).toHaveAttribute('href', '/dashboard/product/engagement-1');

    expect(screen.getByRole('heading', { name: 'Vendedores con más movimiento' })).toBeVisible();
    expect(screen.getByText('Sofía')).toBeVisible();
    expect(screen.getAllByText(/2 movimientos/)[1]).toBeVisible();
    expect(screen.getByText(/1 propiedad tocada/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver movimientos de Sofía' })).toHaveAttribute(
      'href',
      '/dashboard/seguimiento?sellerId=user-1'
    );
  });

  it('renders compact icon-only open actions for scan-friendly rows', () => {
    render(<OperationalHomepage />);

    const openLinks = screen.getAllByRole('link', { name: /^Abrir (actividad|propiedad)/ });

    expect(openLinks.length).toBeGreaterThan(0);
    for (const link of openLinks) {
      expect(link).toHaveClass('border');
      expect(link).toHaveClass('justify-center');
      expect(link).toHaveClass('size-8');
      expect(link).toHaveClass('rounded-full');
      expect(link).toHaveTextContent('');
    }
  });
});
