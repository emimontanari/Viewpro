import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { OperationalHomepage } from './operational-homepage';
import type { ActivityFeedResponse } from '@/features/activity/api/types';
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

const activityResponse: ActivityFeedResponse = {
  counters: {
    attentionCount: 3,
    staleCount: 4,
    todayCount: 2
  },
  items: [
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
      createdAt: '2026-05-24T09:00:00.000Z',
      createdBy: {
        email: 'sofia@example.com',
        firstName: 'Sofía',
        id: 'user-1'
      },
      id: 'movement-2',
      interestCount: 3,
      interestLevel: 'HIGH',
      kind: 'movement',
      newStatus: null,
      nextStep: 'Enviar tasación actualizada',
      observation: 'Ingresaron tres consultas por publicación',
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
      type: 'INQUIRY',
      visitCount: null
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
    },
    {
      createdAt: '2026-05-23T17:00:00.000Z',
      createdBy: {
        email: 'martin@example.com',
        firstName: 'Martín',
        id: 'user-2'
      },
      id: 'movement-3',
      interestCount: null,
      interestLevel: null,
      kind: 'movement',
      newStatus: null,
      nextStep: null,
      observation: 'Se actualizó el estado de documentación',
      offerAmountCents: null,
      previousStatus: null,
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
      source: 'MANUAL',
      tenantId: 'tenant-1',
      type: 'DOCUMENTATION_UPDATE',
      visitCount: null
    }
  ],
  page: 1,
  pageSize: 20,
  total: 4
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
  activity = activityResponse,
  products = productsResponse,
  isLoading = false
}: {
  activity?: ActivityFeedResponse;
  products?: ProductsResponse;
  isLoading?: boolean;
} = {}) {
  useQueryMock.mockImplementation((options) => {
    const queryKey = options.queryKey as readonly unknown[];
    const queryScope = queryKey[0];

    if (queryScope === 'activity') {
      return {
        data: isLoading ? undefined : activity,
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

  it('renders operational summary, recent activity, and property preview', () => {
    render(<OperationalHomepage />);

    expect(
      screen.getByRole('heading', { name: /Inicio operativo de Costa Norte Propiedades/i })
    ).toBeVisible();
    expect(screen.getAllByText('2')[0]).toBeVisible();
    expect(screen.getAllByText('3')[0]).toBeVisible();
    expect(screen.getAllByText('4')[0]).toBeVisible();
    expect(screen.getByText('4 gestiones necesitan una actualización visible.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Ver 4 gestiones sin novedades en seguimiento' })
    ).toHaveAttribute('href', '/dashboard/seguimiento');
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
    expect(screen.getAllByText('Departamento con vista abierta')[0]).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver seguimiento' })).toHaveAttribute(
      'href',
      '/dashboard/seguimiento'
    );
  });

  it('surfaces recent top properties and seller movement insights', () => {
    render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Propiedades con más movimiento' })).toBeVisible();
    expect(screen.getByText('2 actividades recientes')).toBeVisible();
    expect(screen.getByText('Último: Se coordinó una visita para mañana')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Abrir propiedad Departamento con vista abierta' })
    ).toHaveAttribute('href', '/dashboard/product/engagement-1');

    expect(screen.getByRole('heading', { name: 'Vendedores con más movimiento' })).toBeVisible();
    expect(screen.getByText('Sofía')).toBeVisible();
    expect(screen.getByText(/2 movimientos/)).toBeVisible();
    expect(screen.getAllByText(/1 propiedad tocada/)[0]).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver movimientos de Sofía' })).toHaveAttribute(
      'href',
      '/dashboard/seguimiento?sellerId=user-1'
    );
  });

  it('renders bordered, centered open actions for scan-friendly rows', () => {
    render(<OperationalHomepage />);

    const openLinks = screen.getAllByRole('link', { name: /^Abrir (actividad|propiedad)/ });

    expect(openLinks.length).toBeGreaterThan(0);
    for (const link of openLinks) {
      expect(link).toHaveClass('border');
      expect(link).toHaveClass('justify-center');
      expect(link).toHaveClass('h-10');
      expect(link).toHaveClass('min-w-28');
    }
  });
});
