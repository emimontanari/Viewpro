import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTenant } from '@/lib/session-context';
import { usePropertyProposalAccess } from '@/lib/property-proposal-access';
import NewPropertyProposalPage from './page';

vi.mock('@/lib/session-context', () => ({ useActiveTenant: vi.fn() }));
vi.mock('@/lib/property-proposal-access', () => ({ sellerPropertyProposalAccess: {}, usePropertyProposalAccess: vi.fn() }));
vi.mock('@/features/property-proposals/components/property-proposal-form', () => ({ PropertyProposalForm: ({ tenantId }: { tenantId: string }) => <p>Formulario para {tenantId}</p> }));
describe('NewPropertyProposalPage', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: 'tenant-1', isTenantLoading: false } as never); vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: true }); });
  it('keeps loading fail-closed without mounting the seller form', () => {
    vi.mocked(useActiveTenant).mockReturnValue({ activeTenantId: null, isTenantLoading: true } as never); render(<NewPropertyProposalPage />);
    expect(screen.getByText('Cargando propuesta…')).toBeVisible(); expect(screen.queryByText(/Formulario/)).toBeNull();
  });
  it('keeps denied direct access fail-closed without mounting the seller form', () => {
    vi.mocked(usePropertyProposalAccess).mockReturnValue({ activeTenantId: 'tenant-1', enabled: false }); render(<NewPropertyProposalPage />);
    expect(screen.getByText('No tenés acceso a propuestas de propiedades.')).toBeVisible(); expect(screen.queryByText(/Formulario/)).toBeNull();
  });
  it('mounts the seller form only for a resolved authorized active tenant', () => {
    render(<NewPropertyProposalPage />); expect(screen.getByText('Formulario para tenant-1')).toBeVisible();
  });
});
