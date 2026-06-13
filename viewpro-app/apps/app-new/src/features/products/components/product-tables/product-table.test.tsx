import { useActiveTenant } from '@/lib/session-context';
import { TENANT_PERMISSIONS, type TenantMembership } from '@/lib/session';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductTable } from '.';

vi.mock('@/lib/session-context', () => ({
  useActiveTenant: vi.fn()
}));

vi.mock('../../api/queries', () => ({
  productsQueryOptions: vi.fn(() => ({
    queryKey: ['products', 'empty-test'],
    queryFn: async () => ({ items: [], total: 0 })
  }))
}));

vi.mock('nuqs', () => ({
  parseAsInteger: { withDefault: (defaultValue: number) => ({ defaultValue }) },
  parseAsString: { withDefault: (defaultValue: string) => ({ defaultValue }) },
  useQueryStates: vi.fn(() => [
    {
      archived: 'active',
      operationType: null,
      page: 1,
      perPage: 10,
      status: null
    },
    vi.fn()
  ])
}));

describe('ProductTable', () => {
  it('hides the empty-state create CTA for sellers', async () => {
    renderProductTable({ activeMembership: createMembership({ permissions: [] }) });

    expect(await screen.findByText('No hay propiedades para mostrar')).toBeInTheDocument();
    expect(screen.getByText('Cuando tengas propiedades asignadas van a aparecer acá para seguimiento.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nueva propiedad/i })).not.toBeInTheDocument();
  });

  it('shows the empty-state create CTA for managers', async () => {
    renderProductTable({
      activeMembership: createMembership({ permissions: [TENANT_PERMISSIONS.ENGAGEMENTS_CREATE] })
    });

    const createLinks = await screen.findAllByRole('link', { name: /nueva propiedad/i });

    expect(createLinks.map((link) => link.getAttribute('href'))).toContain('/dashboard/product/new');
  });
});

function renderProductTable({
  activeMembership
}: {
  activeMembership: TenantMembership;
}) {
  vi.mocked(useActiveTenant).mockReturnValue({
    activeMembership,
    activeTenantId: activeMembership.tenant.id,
    hasMemberships: true,
    isTenantLoading: false,
    memberships: [activeMembership],
    needsTenantSelection: false,
    selectedTenantId: activeMembership.tenant.id
  });

  return render(<ProductTable />, { wrapper: createQueryClientWrapper() });
}

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createMembership({ permissions }: { permissions: string[] }): TenantMembership {
  return {
    id: 'membership-1',
    permissions,
    role: permissions.includes(TENANT_PERMISSIONS.ENGAGEMENTS_CREATE) ? 'PRINCIPAL_MANAGER' : 'AGENT',
    tenant: {
      id: 'tenant-1',
      name: 'Demo Inmobiliaria',
      slug: 'demo-inmobiliaria',
      status: 'ACTIVE'
    }
  };
}
