import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { getAdminDashboardData, updateAdminTenantStatus } from '@/features/admin/api/service';
import type { AdminDashboardData, AdminTenant } from '@/features/admin/api/types';
import type { Session } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import { AdminTenantManagementPage } from './admin-tenant-management-page';

vi.mock('@/features/admin/api/service', () => ({
  getAdminDashboardData: vi.fn(),
  updateAdminTenantStatus: vi.fn()
}));

vi.mock('@/lib/session-context', () => ({
  useSession: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn()
  }
}));

const getAdminDashboardDataMock = vi.mocked(getAdminDashboardData);
const updateAdminTenantStatusMock = vi.mocked(updateAdminTenantStatus);
const useSessionMock = vi.mocked(useSession);
const toastMock = vi.mocked(toast);

const adminSession: Session = {
  user: {
    id: 'admin-1',
    email: 'admin@viewpro.test',
    firstName: 'Admin',
    lastName: 'ViewPro',
    status: 'ACTIVE',
    globalRole: 'VIEWPRO_ADMIN'
  },
  memberships: []
};

const userSession: Session = {
  ...adminSession,
  user: {
    ...adminSession.user,
    globalRole: 'USER'
  }
};

const trialTenant = createTenant({
  id: 'tenant-trial',
  name: 'Trial Propiedades',
  slug: 'trial',
  status: 'TRIAL'
});
const activeTenant = createTenant({
  id: 'tenant-active',
  name: 'Costa Norte',
  slug: 'costa-norte',
  status: 'ACTIVE'
});
const suspendedTenant = createTenant({
  id: 'tenant-suspended',
  name: 'Río Sur',
  slug: 'rio-sur',
  status: 'SUSPENDED'
});
const cancelledTenant = createTenant({
  id: 'tenant-cancelled',
  name: 'Cancelada SA',
  slug: 'cancelada',
  status: 'CANCELLED'
});

const dashboardData: AdminDashboardData = {
  summary: {
    totals: {
      tenants: 4,
      activeTenants: 1,
      users: 12,
      activeEngagements: 8,
      documentRequests: 6,
      analyticsEvents: 30
    },
    recentActivityCount: 3,
    generatedAt: '2026-06-04T10:00:00.000Z'
  },
  tenants: {
    total: 4,
    page: 1,
    pageSize: 10,
    items: [trialTenant, activeTenant, suspendedTenant, cancelledTenant]
  },
  activity: {
    total: 1,
    page: 1,
    pageSize: 10,
    items: [
      {
        id: 'event-1',
        tenantId: 'tenant-active',
        eventName: 'TENANT_STATUS_CHANGED',
        actorType: 'INTERNAL_USER',
        propertyEngagementId: null,
        propertyAssetId: null,
        documentRequestId: null,
        movementId: null,
        occurredAt: '2026-06-04T10:00:00.000Z'
      }
    ]
  }
};

describe('AdminTenantManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue(createSessionContext(adminSession));
    getAdminDashboardDataMock.mockResolvedValue(dashboardData);
    updateAdminTenantStatusMock.mockResolvedValue({
      tenantId: 'tenant-active',
      previousStatus: 'ACTIVE',
      status: 'SUSPENDED',
      unchanged: false,
      updatedAt: '2026-06-04T10:00:00.000Z'
    });
  });

  it('shows the initial loading state', () => {
    useSessionMock.mockReturnValue(createSessionContext(null, true));

    renderAdminPage();

    expect(screen.getByText('Cargando consola admin…')).toBeInTheDocument();
  });

  it('shows restricted access for non ViewPro admins', async () => {
    useSessionMock.mockReturnValue(createSessionContext(userSession));

    renderAdminPage();

    expect(await screen.findByText('Acceso restringido a ViewPro Admin')).toBeInTheDocument();
    expect(
      screen.getByText(/Necesitás rol global VIEWPRO_ADMIN para abrir este comando operativo/i)
    ).toBeInTheDocument();
    expect(getAdminDashboardDataMock).not.toHaveBeenCalled();
  });

  it('shows a Spanish error state when admin data cannot load', async () => {
    getAdminDashboardDataMock.mockRejectedValueOnce(new Error('Backend caído'));

    renderAdminPage();

    expect(await screen.findByText('No pudimos cargar el admin')).toBeInTheDocument();
    expect(screen.getByText('Backend caído')).toBeInTheDocument();
  });

  it('renders tenant list and status badges with existing admin copy', async () => {
    renderAdminPage();

    expect(await screen.findByText('Frontera segura')).toBeInTheDocument();
    expect(screen.getByText('Trial Propiedades')).toBeInTheDocument();
    expect(screen.getByText('Costa Norte')).toBeInTheDocument();
    expect(screen.getByText('Río Sur')).toBeInTheDocument();
    expect(screen.getByText('Cancelada SA')).toBeInTheDocument();
    expect(screen.getByText('Trial')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });

  it('opens confirmation before activating a trial tenant', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Activar' }));

    expect(updateAdminTenantStatusMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Activar tenant' });
    await user.click(within(dialog).getByRole('button', { name: 'Activar' }));

    await waitFor(() => {
      expect(updateAdminTenantStatusMock).toHaveBeenCalledWith('tenant-trial', {
        status: 'ACTIVE'
      });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Tenant activado.');
  });

  it('suspends an active tenant after confirmation', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Suspender' }));

    expect(updateAdminTenantStatusMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Suspender tenant' });
    await user.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(updateAdminTenantStatusMock).toHaveBeenCalledWith('tenant-active', {
        status: 'SUSPENDED'
      });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Tenant suspendido.');
    await waitFor(() => {
      expect(getAdminDashboardDataMock).toHaveBeenCalledTimes(2);
    });
  });

  it('reactivates a suspended tenant after confirmation', async () => {
    const user = userEvent.setup();
    renderAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Reactivar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Reactivar tenant' });
    await user.click(within(dialog).getByRole('button', { name: 'Reactivar' }));

    await waitFor(() => {
      expect(updateAdminTenantStatusMock).toHaveBeenCalledWith('tenant-suspended', {
        status: 'ACTIVE'
      });
    });
    expect(toastMock.success).toHaveBeenCalledWith('Tenant reactivado.');
  });

  it('does not expose a status action for cancelled tenants', async () => {
    renderAdminPage();

    const cancelledRow = await screen.findByText('Cancelada SA');
    expect(within(cancelledRow.closest('tr')!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(cancelledRow.closest('tr')!).getByText('Sin acción')).toBeInTheDocument();
  });

  it('shows unchanged and mutation error feedback in Spanish', async () => {
    const user = userEvent.setup();
    updateAdminTenantStatusMock.mockResolvedValueOnce({
      tenantId: 'tenant-active',
      previousStatus: 'ACTIVE',
      status: 'SUSPENDED',
      unchanged: true,
      updatedAt: '2026-06-04T10:00:00.000Z'
    });
    renderAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Suspender' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Suspender' })
    );

    await waitFor(() => {
      expect(toastMock.info).toHaveBeenCalledWith('El tenant ya tenía ese estado.');
    });

    vi.clearAllMocks();
    useSessionMock.mockReturnValue(createSessionContext(adminSession));
    getAdminDashboardDataMock.mockResolvedValue(dashboardData);
    updateAdminTenantStatusMock.mockRejectedValueOnce(new Error('No autorizado'));
    renderAdminPage();

    await user.click(await screen.findByRole('button', { name: 'Suspender' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Suspender' })
    );

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('No se pudo actualizar el estado del tenant.');
    });
  });
});

function renderAdminPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminTenantManagementPage />
    </QueryClientProvider>
  );
}

function createSessionContext(
  session: Session | null,
  isLoading = false
): ReturnType<typeof useSession> {
  return {
    session,
    memberships: session?.memberships ?? [],
    selectedTenantId: null,
    activeMembership: null,
    activeTenantId: null,
    hasMemberships: Boolean(session?.memberships.length),
    isLoading,
    isTenantLoading: false,
    needsTenantSelection: false,
    isAuthenticated: Boolean(session),
    signOut: vi.fn(async () => undefined)
  };
}

function createTenant(input: Pick<AdminTenant, 'id' | 'name' | 'slug' | 'status'>): AdminTenant {
  return {
    ...input,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z',
    counts: {
      memberships: 3,
      propertyAssets: 4,
      propertyEngagements: 5,
      documentRequests: 6,
      analyticsEvents: 7
    },
    lastActivityAt: '2026-06-01T10:00:00.000Z'
  };
}
