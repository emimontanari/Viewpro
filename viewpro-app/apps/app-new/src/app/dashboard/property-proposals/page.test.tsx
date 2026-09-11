import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { usePropertyProposalAccess } from '@/lib/property-proposal-access';
import PropertyProposalsPage from './page';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/lib/property-proposal-access', () => ({
  sellerPropertyProposalAccess: {}, usePropertyProposalAccess: vi.fn()
}));
vi.mock('@/features/property-proposals/components/property-proposal-list', () => ({
  PropertyProposalList: ({ tenantId, enabled }: { tenantId: string; enabled: boolean }) =>
    <p>Lista para {tenantId}: {String(enabled)}</p>
}));

describe('PropertyProposalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never);
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: true });
  });

  it('keeps loading fail-closed without mounting the seller list', () => {
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: null, isTenantLoading: true } as never);
    render(<PropertyProposalsPage />);
    expect(screen.getByText('Cargando propuestas…')).toBeVisible();
    expect(screen.queryByText(/Lista para/)).toBeNull();
  });

  it('keeps denied or tenantless direct access fail-closed without mounting the seller list', () => {
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: false });
    render(<PropertyProposalsPage />);
    expect(screen.getByText('No tenés acceso a propuestas de propiedades.')).toBeVisible();
    expect(screen.queryByText(/Lista para/)).toBeNull();
  });

  it('keeps a tenantless direct route fail-closed without mounting the seller list', () => {
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: null, enabled: true });
    render(<PropertyProposalsPage />);
    expect(screen.getByText('No tenés acceso a propuestas de propiedades.')).toBeVisible();
    expect(screen.queryByText(/Lista para/)).toBeNull();
  });

  it('mounts the seller list with the resolved active tenant and exact access predicate only', () => {
    render(<PropertyProposalsPage />);
    expect(screen.getByText('Lista para tenant-1: true')).toBeVisible();
  });
});
