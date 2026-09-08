import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useActiveTenant, useSession } from '@/lib/session-context';
import { OperationalHomepage } from './operational-homepage';
import type { ActivityFeedResponse } from '@/features/activity/api/types';
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
  useActiveTenant: vi.fn(),
  useSession: vi.fn()
}));

const useQueryMock = vi.mocked(useQuery);
const useActiveTenantMock = vi.mocked(useActiveTenant);
const useSessionMock = vi.mocked(useSession);

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

const authenticatedSession = {
  hasOwnerAccess: false,
  memberships: [],
  user: {
    email: 'patricio@example.com',
    emailVerifiedAt: '2026-05-25T00:00:00.000Z',
    firstName: 'Patricio',
    globalRole: 'USER' as const,
    id: 'user-1',
    lastName: 'Gómez',
    status: 'ACTIVE'
  }
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

const activityFeedResponse: ActivityFeedResponse = {
  counters: {
    attentionCount: 3,
    staleCount: 2,
    todayCount: 1
  },
  items: dashboardSummaryResponse.recentActivity,
  page: 1,
  pageSize: 6,
  total: 2
};

function mockDashboardQueries({
  activity = activityFeedResponse,
  products = productsResponse,
  summary = dashboardSummaryResponse,
  isLoading = false
}: {
  activity?: ActivityFeedResponse;
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
        isLoading,
        isSuccess: !isLoading
      } as ReturnType<typeof useQuery>;
    }

    if (queryScope === 'activity') {
      return {
        data: isLoading ? undefined : activity,
        isError: false,
        isLoading,
        isSuccess: !isLoading
      } as ReturnType<typeof useQuery>;
    }

    return {
      data: isLoading ? undefined : products,
      isError: false,
      isLoading,
      isSuccess: !isLoading
    } as ReturnType<typeof useQuery>;
  });
}

function hasQueryScope(scope: string) {
  return useQueryMock.mock.calls.some(([options]) => {
    const queryKey = options.queryKey as readonly unknown[];
    return queryKey[0] === scope;
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
    useSessionMock.mockReturnValue({ session: authenticatedSession } as unknown as ReturnType<
      typeof useSession
    >);
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

    expect(screen.getByRole('heading', { name: 'Hola, Patricio Gómez' })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
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
    expect(screen.getByRole('link', { name: 'Ver todo' })).toHaveAttribute(
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

  it('renders mobile-first row actions that collapse to compact desktop controls', () => {
    render(<OperationalHomepage />);

    const openLinks = screen.getAllByRole('link', { name: /^Abrir (actividad|propiedad)/ });

    expect(openLinks.length).toBeGreaterThan(0);
    for (const link of openLinks) {
      expect(link).toHaveClass('w-full');
      expect(link).toHaveClass('rounded-xl');
      expect(link).toHaveClass('sm:size-8');
      expect(link).toHaveClass('sm:rounded-full');
      expect(link).toHaveTextContent('Abrir');
    }
  });

  it('renders a seller-focused dashboard for agent memberships without manager summary queries', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: {
        ...activeTenantContext.activeMembership,
        id: 'membership-agent',
        permissions: ['tenant.view', 'engagements.view_assigned', 'movements.create'],
        role: 'AGENT'
      }
    });

    render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Patricio Gómez' })).toBeVisible();
    expect(screen.getByText('Costa Norte Propiedades')).toBeVisible();
    expect(hasQueryScope('dashboard')).toBe(false);
    expect(hasQueryScope('products')).toBe(true);
    expect(hasQueryScope('activity')).toBe(true);
    expect(screen.queryByRole('link', { name: 'Nueva propiedad' })).not.toBeInTheDocument();
    expect(screen.queryByText('Propiedades con más movimiento')).not.toBeInTheDocument();
    expect(screen.queryByText('Vendedores con más movimiento')).not.toBeInTheDocument();
  });

  it('fails closed without seller queries for non-exact roles, missing identity, or tenant-membership mismatch', () => {
    const agentMembership = { ...activeTenantContext.activeMembership, id: 'membership-agent', role: 'AGENT' };

    useActiveTenantMock.mockReturnValue({ ...activeTenantContext, activeMembership: { ...agentMembership, role: 'AGENT_MANAGER' } });
    const nonExactRole = render(<OperationalHomepage />);
    expect(screen.getByRole('heading', { name: 'Inicio no disponible para tu rol' })).toBeVisible();
    expect(hasQueryScope('products')).toBe(false);
    expect(hasQueryScope('activity')).toBe(false);
    nonExactRole.unmount();

    useQueryMock.mockClear();
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: { ...agentMembership, tenant: { ...agentMembership.tenant, id: 'tenant-other' } }
    });
    const mismatch = render(<OperationalHomepage />);
    expect(screen.getByLabelText('Preparando inicio operativo')).toBeVisible();
    expect(hasQueryScope('products')).toBe(false);
    expect(hasQueryScope('activity')).toBe(false);
    mismatch.unmount();

    useQueryMock.mockClear();
    useActiveTenantMock.mockReturnValue({ ...activeTenantContext, activeMembership: agentMembership });
    useSessionMock.mockReturnValue({
      session: { ...authenticatedSession, user: { ...authenticatedSession.user, email: ' ', firstName: null, lastName: null } }
    } as unknown as ReturnType<typeof useSession>);
    render(<OperationalHomepage />);
    expect(screen.getByRole('heading', { name: 'Inicio no disponible para tu rol' })).toBeVisible();
    expect(hasQueryScope('products')).toBe(false);
    expect(hasQueryScope('activity')).toBe(false);
  });

  it('keeps failures, retained data, and retries local to their seller owner', async () => {
    const productRetry = vi.fn();
    const activityRetry = vi.fn();
    useActiveTenantMock.mockReturnValue({ ...activeTenantContext, activeMembership: { ...activeTenantContext.activeMembership, role: 'AGENT' } });
    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? undefined : activityFeedResponse,
        isError: productsQuery,
        isFetching: false,
        isLoading: false,
        isSuccess: !productsQuery,
        refetch: productsQuery ? productRetry : activityRetry
      } as unknown as ReturnType<typeof useQuery>;
    });

    const productFailure = render(<OperationalHomepage />);
    expect(screen.getByRole('alert', { name: 'Propiedades asignadas no disponibles' })).toBeVisible();
    expect(screen.getByText('Actividad de mis propiedades')).toBeVisible();
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
    expect(screen.queryByText('Sin propiedades asignadas')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar propiedades asignadas' }));
    expect(productRetry).toHaveBeenCalledTimes(1);
    expect(activityRetry).not.toHaveBeenCalled();
    productFailure.unmount();

    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? undefined : activityFeedResponse,
        isError: productsQuery,
        isFetching: productsQuery,
        isLoading: false,
        isSuccess: !productsQuery,
        refetch: productsQuery ? productRetry : activityRetry
      } as unknown as ReturnType<typeof useQuery>;
    });
    const productRetrying = render(<OperationalHomepage />);
    expect(screen.getByRole('button', { name: 'Reintentando propiedades asignadas…' })).toBeDisabled();
    productRetrying.unmount();

    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? productsResponse : undefined,
        isError: !productsQuery,
        isFetching: false,
        isLoading: false,
        isSuccess: productsQuery,
        refetch: productsQuery ? productRetry : activityRetry
      } as unknown as ReturnType<typeof useQuery>;
    });
    render(<OperationalHomepage />);
    expect(screen.getByRole('alert', { name: 'Actividad no disponible' })).toBeVisible();
    expect(screen.getAllByText('Mis propiedades asignadas')[0]).toBeVisible();
    expect(screen.getByText('Departamento con vista abierta')).toBeVisible();
    expect(screen.queryByText('Sin movimientos recientes')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar actividad' }));
    expect(activityRetry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes same-tenant refresh and retained refresh error from initial loading', () => {
    useActiveTenantMock.mockReturnValue({ ...activeTenantContext, activeMembership: { ...activeTenantContext.activeMembership, role: 'AGENT' } });
    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? productsResponse : undefined,
        isError: false,
        isFetching: productsQuery,
        isLoading: !productsQuery,
        isSuccess: productsQuery,
        refetch: vi.fn()
      } as unknown as ReturnType<typeof useQuery>;
    });
    const refresh = render(<OperationalHomepage />);
    expect(screen.getAllByText('Actualizando…')).toHaveLength(2);
    expect(screen.getByText('Departamento con vista abierta')).toBeVisible();
    expect(screen.getByLabelText('Preparando movimientos en las últimas 24 horas')).toBeVisible();
    refresh.unmount();

    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? productsResponse : activityFeedResponse,
        isError: productsQuery,
        isFetching: false,
        isLoading: false,
        isSuccess: !productsQuery,
        refetch: vi.fn()
      } as unknown as ReturnType<typeof useQuery>;
    });
    const productRetained = render(<OperationalHomepage />);
    expect(screen.getByText('Última información disponible')).toBeVisible();
    expect(screen.getByText('Departamento con vista abierta')).toBeVisible();
    expect(screen.queryByText('Sin propiedades asignadas')).not.toBeInTheDocument();
    productRetained.unmount();

    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? productsResponse : activityFeedResponse,
        isError: false,
        isFetching: !productsQuery,
        isLoading: false,
        isSuccess: true,
        refetch: vi.fn()
      } as unknown as ReturnType<typeof useQuery>;
    });
    const activityRefresh = render(<OperationalHomepage />);
    expect(screen.getAllByText('Actualizando…')).toHaveLength(6);
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
    activityRefresh.unmount();

    useQueryMock.mockImplementation((options) => {
      const productsQuery = (options.queryKey as readonly unknown[])[0] === 'products';
      return {
        data: productsQuery ? productsResponse : activityFeedResponse,
        isError: !productsQuery,
        isFetching: false,
        isLoading: false,
        isSuccess: productsQuery,
        refetch: vi.fn()
      } as unknown as ReturnType<typeof useQuery>;
    });
    render(<OperationalHomepage />);
    expect(screen.getAllByText('Última información disponible')).toHaveLength(5);
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
  });

  it('mounts principal managers but fails closed for unknown roles and absent identities', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: {
        ...activeTenantContext.activeMembership,
        role: 'PRINCIPAL_MANAGER'
      }
    });

    const principalManager = render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Hola, Patricio Gómez' })).toBeVisible();
    expect(hasQueryScope('dashboard')).toBe(true);
    principalManager.unmount();

    useQueryMock.mockClear();
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: {
        ...activeTenantContext.activeMembership,
        role: 'UNKNOWN'
      }
    });

    const unknownRole = render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Inicio no disponible para tu rol' })).toBeVisible();
    expect(hasQueryScope('dashboard')).toBe(false);
    unknownRole.unmount();

    useQueryMock.mockClear();
    useActiveTenantMock.mockReturnValue(activeTenantContext);
    useSessionMock.mockReturnValue({ session: null } as unknown as ReturnType<typeof useSession>);

    render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Inicio no disponible para tu rol' })).toBeVisible();
    expect(hasQueryScope('dashboard')).toBe(false);
  });

  it('shows assigned properties and assigned activity on the seller dashboard', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: {
        ...activeTenantContext.activeMembership,
        id: 'membership-agent',
        permissions: ['tenant.view', 'engagements.view_assigned', 'movements.create'],
        role: 'AGENT'
      }
    });

    render(<OperationalHomepage />);

    expect(screen.getByText('Movimientos en las últimas 24 horas')).toBeVisible();
    expect(screen.getByText('Sin movimientos en los últimos 7 días')).toBeVisible();
    expect(screen.getAllByText('Mis propiedades asignadas')[0]).toBeVisible();
    expect(screen.getByText('Requieren seguimiento')).toBeVisible();
    expect(screen.getAllByText('Departamento con vista abierta')[0]).toBeVisible();
    expect(screen.getByText('Actividad de mis propiedades')).toBeVisible();
    expect(screen.getByText('Se coordinó una visita para mañana')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Abrir propiedad: Departamento con vista abierta' })
    ).toHaveAttribute('href', '/dashboard/product/engagement-1');
  });

  it('uses seller-safe copy when an agent has no active assigned properties', () => {
    useActiveTenantMock.mockReturnValue({
      ...activeTenantContext,
      activeMembership: {
        ...activeTenantContext.activeMembership,
        id: 'membership-agent',
        permissions: ['tenant.view', 'engagements.view_assigned', 'movements.create'],
        role: 'AGENT'
      }
    });
    mockDashboardQueries({
      products: {
        ...productsResponse,
        items: [],
        total: 0
      }
    });

    render(<OperationalHomepage />);

    expect(screen.getByText('Sin propiedades asignadas')).toBeVisible();
    expect(
      screen.getByText(
        'Todavía no tenés propiedades activas asignadas. Cuando una gestión quede a tu cargo, va a aparecer acá.'
      )
    ).toBeVisible();
    expect(screen.queryByText(/Creá una propiedad/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva propiedad' })).not.toBeInTheDocument();
  });
});
