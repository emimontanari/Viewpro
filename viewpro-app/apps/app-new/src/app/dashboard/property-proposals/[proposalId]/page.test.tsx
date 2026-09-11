import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParams } from 'next/navigation';
import { useActiveTenant } from '@/lib/session-context';
import { usePropertyProposalAccess } from '@/lib/property-proposal-access';
import PropertyProposalPage from './page';

vi.mock('next/navigation', () => ({ useParams: vi.fn() }));
vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/lib/property-proposal-access', () => ({
  sellerPropertyProposalAccess: {},
  usePropertyProposalAccess: vi.fn()
}));
vi.mock('@/features/property-proposals/components/property-proposal-detail', () => ({
  PropertyProposalDetail: ({
    tenantId,
    proposalId,
    enabled
  }: {
    tenantId: string;
    proposalId: string;
    enabled: boolean;
  }) => (
    <p>
      Detalle para {tenantId}/{proposalId}: {String(enabled)}
    </p>
  )
}));

describe('PropertyProposalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ proposalId: 'proposal-1' });
    vi.mocked(useActiveTenant).mockReturnValue({
      activeTenantId: 'tenant-1',
      isTenantLoading: false
    } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({
      activeTenantId: 'tenant-1',
      enabled: true
    });
  });

  it.each([
    [
      'loading',
      { activeTenantId: null, isTenantLoading: true },
      { activeTenantId: null, enabled: false },
      'Cargando propuesta…'
    ],
    [
      'denied',
      { activeTenantId: 'tenant-1', isTenantLoading: false },
      { activeTenantId: 'tenant-1', enabled: false },
      'No tenés acceso a propuestas de propiedades.'
    ],
    [
      'missing tenant',
      { activeTenantId: null, isTenantLoading: false },
      { activeTenantId: null, enabled: true },
      'No tenés acceso a propuestas de propiedades.'
    ]
  ])(
    'fails closed while %s without mounting the detail query component',
    (_, tenant, access, copy) => {
      vi.mocked(useActiveTenant).mockReturnValue(tenant as never);
      vi.mocked(usePropertyProposalAccess).mockReturnValue(access);
      render(<PropertyProposalPage />);
      expect(screen.getByText(copy)).toBeVisible();
      expect(screen.queryByText(/Detalle para/)).toBeNull();
    }
  );

  it('mounts detail only with the resolved seller tenant, route id, and exact enabled predicate', () => {
    render(<PropertyProposalPage />);
    expect(screen.getByText('Detalle para tenant-1/proposal-1: true')).toBeVisible();
  });
});
